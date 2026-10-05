// Run against an isolated, newly named database on the configured MongoDB server.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
require('dotenv').config({ quiet: true });
process.env.RECIPE_DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';
const mongoose = require('mongoose');
const dbName = `cookhub_recipe_test_${randomBytes(8).toString('hex')}`;
let server;
let memoryServer;
let connected = false;
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }

async function main() {
  if (process.env.RECIPE_TEST_MEMORY === 'true') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = memoryServer.getUri();
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 10000 });
  connected = true;
  const dbModule = require.resolve('../config/db');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: () => {} };
  const app = require('../app');
  const Recipe = require('../models/Recipe');
  const Client = require('../models/Client');
  const Transaction = require('../models/Transaction');
  const session = require('express-session');
  const authApp = require('express')();
  authApp.use(session({ secret: randomBytes(32).toString('hex'), resave: false, saveUninitialized: false }));
  // Only this test app has an authentication fixture; it is never installed in the product app.
  authApp.post('/test-login/:id', (req, res) => { req.session.userId = Number(req.params.id); res.sendStatus(204); });
  authApp.use(app);
  server = await new Promise(resolve => { const s = authApp.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  function browser() {
    let cookie = '';
    return async (path, body, method = body ? 'POST' : 'GET') => {
      const encoded = new URLSearchParams();
      if (body) Object.entries(body).forEach(([key, value]) => (Array.isArray(value) ? value : [value]).forEach(item => encoded.append(key, item)));
      const response = await fetch(base + path, { method, redirect: 'manual',
        headers: { cookie, ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) }, body: body ? encoded : undefined });
      const setCookies = response.headers.getSetCookie();
      if (setCookies.length) cookie = setCookies.map(item => item.split(';')[0]).join('; ');
      return { status: response.status, location: response.headers.get('location'), text: await response.text() };
    };
  }
  const chef = browser();
  const stranger = browser();
  const visitor = browser();
  let response = await chef('/chef/recipes');
  check(response.status === 200 && response.text.includes('ยังไม่มีสูตรอาหาร'), 'Chef empty state');
  const csrf = response.text.match(/name="_csrf" value="([^"]+)"/);
  // Empty lists have no delete form; obtain the CSRF token from the create form.
  response = await chef('/chef/recipes/create');
  check(response.status === 200, 'Create form');
  const token = (csrf || response.text.match(/name="_csrf" value="([^"]+)"/))[1];
  const payload = { _csrf: token, title: 'ไก่ทดสอบ',
    category: 'Thai', level: 'BEGINNER', price: '0', image: 'https://example.com/food.jpg',
    ingredientName: 'SECRET_INGREDIENT', ingredientAmount: '200 g', stepDescription: 'SECRET_STEP' };
  response = await chef('/chef/recipes', { ...payload, _csrf: 'bad' });
  check(response.status === 403, 'CSRF required');
  for (const invalid of [{ title: '' }, { category: '' }, { price: '-1' }, { price: 'NaN' }, { image: '' }, { image: 'javascript:alert(1)' }, { difficulty: 'INVALID' }, { duration: '-1' }, { ingredientName: '' }, { stepDescription: '' }]) {
    response = await chef('/chef/recipes', { ...payload, ...invalid });
    check(response.status === 422, `Validation: ${Object.keys(invalid)[0]}`);
  }
  response = await chef('/chef/recipes', payload);
  check(response.status === 303, 'Create redirect');
  const id = Number(response.location.match(/recipes\/(\d+)/)[1]);
  let record = await Recipe.findById(id);
  check(record && record.ingredients[0].name === payload.ingredientName && record.isFree, 'MongoDB persisted recipe');
  // Existing metadata from other integrations remains intact although it is absent from the screenshot-based form.
  record.description = 'Thai chicken integration fixture';
  record.videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  record.duration = 30;
  record.rating = 4.6;
  record.favoriteCount = 20;
  await record.save();
  response = await chef(`/chef/recipes/${id}`, { ...payload, ingredientName: ['SECRET_INGREDIENT', 'SECOND_INGREDIENT'],
    ingredientAmount: ['200 g', '1 tsp'], stepDescription: ['SECRET_STEP', 'SECOND_STEP'] }, 'PUT');
  check(response.status === 303, 'PUT update with multiple rows');
  record = await Recipe.findById(id);
  check(record.ingredients.length === 2 && record.steps.length === 2 && record.steps[1].stepNumber === 2, 'Array persistence and step numbering');
  check(record.description.includes('chicken') && record.videoUrl.includes('dQw4w9WgXcQ') && record.duration === 30, 'Editing preserves metadata absent from the form');
  const ownerId = record.publisher;
  response = await chef(`/chef/recipes/${id}`);
  check(response.status === 200 && response.text.includes('SECRET_STEP'), 'Chef detail');
  response = await chef(`/chef/recipes/${id}/edit`);
  check(response.status === 200 && response.text.includes('SECRET_INGREDIENT'), 'Edit prefill');
  response = await chef(`/chef/recipes/${id}/edit?fragment=1`);
  check(response.status === 200 && response.text.includes('recipe-form') && !response.text.includes('<!DOCTYPE'), 'Modal fragment without duplicate layout');
  check(!response.text.includes('name="description"') && !response.text.includes('name="videoUrl"'), 'Form fields match screenshot scope');
  response = await visitor(`/recipes/${id}`);
  check(response.status === 200 && response.text.includes('SECRET_STEP') && response.text.includes('youtube-nocookie.com'), 'Free recipe content and video');
  response = await visitor('/recipes?search=chicken&category=Thai&level=BEGINNER&minPrice=0&maxPrice=200');
  check(response.status === 200 && response.text.includes('ไก่ทดสอบ'), 'Combined search/filter');
  const fixtureBase = { publisher: ownerId, category: 'อาหารไทย', difficulty: 'EASY', level: 'BEGINNER', image: 'https://example.com/fixture.jpg', ingredients: [{ name: 'fixture', amount: '1' }], steps: [{ stepNumber: 1, description: 'fixture' }] };
  const fixtures = await Promise.all([
    Recipe.create({ ...fixtureBase, title: 'FILTER_LOW', price: 50, duration: 10, rating: 2, favoriteCount: 1, createdAt: new Date('2027-01-01') }),
    Recipe.create({ ...fixtureBase, title: 'FILTER_RATING', price: 200, duration: 80, rating: 4.9, favoriteCount: 2, createdAt: new Date('2027-01-02') }),
    Recipe.create({ ...fixtureBase, title: 'FILTER_POPULAR', price: 80, duration: 20, rating: 3, favoriteCount: 80, createdAt: new Date('2027-01-03') }),
    Recipe.create({ ...fixtureBase, title: 'FILTER_JAPAN', category: 'อาหารญี่ปุ่น', difficulty: 'HARD', level: 'ADVANCED', price: 120, duration: 30, rating: 4.8, favoriteCount: 50, createdAt: new Date('2027-01-04') })
  ]);
  const encoded = value => encodeURIComponent(value);
  response = await visitor(`/recipes?category=${encoded('อาหารไทย')}&difficulty=EASY&minDuration=15&maxDuration=40&minPrice=0&maxPrice=100&minRating=3&sort=rating`);
  check(response.status === 200 && response.text.includes('ไก่ทดสอบ') && response.text.includes('FILTER_POPULAR') && !response.text.includes('FILTER_LOW') && !response.text.includes('FILTER_RATING') && !response.text.includes('FILTER_JAPAN'), 'Combined category/difficulty/duration/price/rating/sort with legacy category alias');
  response = await visitor(`/recipes?category=${encoded('อาหารไทย')}&category=${encoded('อาหารญี่ปุ่น')}&minRating=4.5`);
  check(response.status === 200 && response.text.includes('FILTER_JAPAN') && response.text.includes('FILTER_RATING') && !response.text.includes('FILTER_LOW'), 'Multiple category checkboxes');
  response = await visitor('/recipes?sort=popular');
  check(response.text.indexOf('FILTER_POPULAR') < response.text.indexOf('FILTER_JAPAN') && response.text.indexOf('FILTER_JAPAN') < response.text.indexOf('FILTER_RATING'), 'Popular sorting from persisted favorite counts');
  response = await visitor('/recipes?sort=rating');
  check(response.text.indexOf('FILTER_RATING') < response.text.indexOf('FILTER_JAPAN') && response.text.indexOf('FILTER_JAPAN') < response.text.indexOf('FILTER_POPULAR'), 'Rating sorting from persisted ratings');
  response = await visitor('/recipes?sort=newest');
  check(response.text.indexOf('FILTER_JAPAN') < response.text.indexOf('FILTER_POPULAR') && response.text.indexOf('FILTER_POPULAR') < response.text.indexOf('FILTER_RATING'), 'Newest sorting');
  response = await visitor('/recipes?difficulty=HARD');
  check(response.status === 200 && response.text.includes('FILTER_JAPAN') && !response.text.includes('FILTER_POPULAR'), 'Difficulty filter');
  response = await visitor('/recipes?maxDuration=30');
  check(response.status === 200 && response.text.includes('FILTER_LOW') && !response.text.includes('FILTER_RATING'), 'Duration filter');
  response = await visitor('/recipes?search=does-not-exist');
  check(response.status === 200 && response.text.includes('ไม่พบสูตรอาหาร'), 'Search empty state');
  response = await visitor('/recipes?search=.*');
  check(response.status === 200 && !response.text.includes('ไก่ทดสอบ'), 'Regex metacharacters treated literally');
  for (const path of ['/recipes/not-an-id', '/recipes/1.5', '/recipes?minPrice=-1', '/recipes?minPrice=20&maxPrice=10', '/recipes?level=INVALID', '/recipes?difficulty=INVALID', '/recipes?sort=bad', '/recipes?minDuration=-1', '/recipes?minDuration=50&maxDuration=10', '/recipes?minRating=6', '/recipes?page=oops', '/recipes?search=a&search=b']) {
    check((await visitor(path)).status === 400, `Invalid query or ID: ${path}`);
  }
  check((await visitor('/recipes/999999')).status === 404, 'Missing recipe');
  response = await stranger('/chef/recipes/create');
  const otherToken = response.text.match(/name="_csrf" value="([^"]+)"/)[1];
  check((await stranger(`/chef/recipes/${id}/edit`)).status === 404, 'Other chef cannot read edit form');
  check((await stranger(`/chef/recipes/${id}`, { ...payload, _csrf: otherToken })).status === 404, 'Other chef cannot edit');
  check((await stranger(`/chef/recipes/${id}/delete`, { _csrf: otherToken })).status === 404, 'Other chef cannot delete');
  response = await chef(`/chef/recipes/${id}`, { ...payload, price: '100', title: 'สูตรเสียเงิน' });
  check(response.status === 303, 'Update redirect');
  record = await Recipe.findById(id);
  check(record.price === 100 && !record.isFree, 'Updated MongoDB and isFree');
  response = await visitor(`/recipes/${id}`);
  check(response.status === 200 && !response.text.includes('SECRET_STEP') && !response.text.includes('SECRET_INGREDIENT') && !response.text.includes('dQw4w9WgXc'), 'Paid content hidden in HTML');
  response = await visitor(`/recipes/${id}?fragment=1`);
  check(response.status === 200 && response.text.includes('data-purchase-recipe') && !response.text.includes('SECRET_STEP') && !response.text.includes('SECRET_INGREDIENT'), 'Paid modal fragment never leaks locked content');
  check((await chef(`/recipes/${id}`)).text.includes('SECRET_STEP'), 'Owner can access paid recipe');
  const buyer = await Client.create({ email: 'test-buyer@example.invalid', passwordHash: 'test-only', name: 'ผู้ซื้อทดสอบ' });
  const buyerBrowser = browser();
  await buyerBrowser(`/test-login/${buyer._id}`, {});
  check(!(await buyerBrowser(`/recipes/${id}`)).text.includes('SECRET_STEP'), 'Logged-in nonbuyer locked');
  await Transaction.create({ buyer: buyer._id, itemType: 'Recipe', itemId: id, amountPaid: 100 });
  check((await buyerBrowser(`/recipes/${id}`)).text.includes('SECRET_STEP'), 'Existing Transaction unlocks recipe');
  check((await buyerBrowser('/chef/recipes')).status === 403, 'User role cannot manage recipes');
  const ownerBrowser = browser();
  await ownerBrowser(`/test-login/${ownerId}`, {});
  check((await ownerBrowser(`/chef/recipes/${id}`)).status === 200, 'Session userId integration');
  check((await visitor('/recipes/inspiration')).status === 200, 'Inspiration view');
  check((await visitor('/api/meals/search')).status === 400, 'API validates search');
  check((await visitor('/api/meals/invalid')).status === 400, 'API validates meal ID');
  const mealService = require('../services/mealApiService');
  const originalSearch = mealService.search;
  const originalLookup = mealService.lookup;
  mealService.search = async () => [{ id: '12345', title: 'Fixture meal' }];
  response = await visitor('/api/meals/search?q=chicken');
  check(response.status === 200 && JSON.parse(response.text).meals[0].title === 'Fixture meal', 'API success response');
  mealService.search = async () => { throw new Error('upstream offline'); };
  check((await visitor('/api/meals/search?q=chicken')).status === 502, 'API failure handling');
  mealService.lookup = async () => null;
  check((await visitor('/api/meals/12345')).status === 404, 'API missing meal');
  mealService.search = originalSearch; mealService.lookup = originalLookup;
  if (process.env.RECIPE_TEST_BROWSER === 'true') await require('./recipeBrowser')(base, ownerId);
  check((await visitor('/chef/courses')).status === 200 && (await visitor('/chef/profile')).status === 200 && (await visitor('/chef/dashboard')).status === 200, 'Existing team screens still render');
  response = await chef(`/chef/recipes/${id}/delete`, { _csrf: token });
  check(response.status === 303 && response.location === '/chef/recipes?deleted=1', 'Delete redirect');
  check(!(await Recipe.findById(id)), 'Deleted from MongoDB');
  check((await visitor(`/recipes/${id}`)).status === 404, 'Deleted recipe unavailable');
  for (const fixture of fixtures) await Recipe.deleteOne({ _id: fixture._id });
  await mongoose.disconnect();
  check((await visitor('/recipes')).status === 503, 'Database unavailable handled');
  check((await visitor('/recipes/inspiration')).status === 200, 'External inspiration independent of MongoDB');
  console.log(`PASS: ${checks} integration checks`);
}

main().catch(error => { console.error(error.name + ': ' + error.message); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  try {
    if (!connected) return;
    if (mongoose.connection.readyState !== 1) await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 10000 });
    // Only this randomly named test database may be cleaned. Never touch the configured application database.
    assert.match(mongoose.connection.name, /^cookhub_recipe_test_[a-f0-9]{16}$/);
    assert.equal(mongoose.connection.name, dbName);
    for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  } catch (error) { console.error('Test cleanup: ' + error.name); process.exitCode = 1; }
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
});
