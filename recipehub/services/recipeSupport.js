const createError = require('http-errors');
const mongoose = require('mongoose');
const { randomBytes } = require('crypto');
const session = require('express-session');
const Client = require('../models/Client');

const levels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const levelLabels = { BEGINNER: 'เริ่มต้น', INTERMEDIATE: 'ปานกลาง', ADVANCED: 'ขั้นสูง' };
const difficulties = ['EASY', 'MEDIUM', 'HARD'];
const difficultyLabels = { EASY: 'ง่าย', MEDIUM: 'ปานกลาง', HARD: 'ยาก' };
const difficultyLevels = { EASY: 'BEGINNER', MEDIUM: 'INTERMEDIATE', HARD: 'ADVANCED' };
const categories = ['อาหารไทย', 'อาหารนานาชาติ', 'อาหารญี่ปุ่น', 'อาหารจีน', 'อาหารอินเดีย', 'เบเกอรี่ & ขนมหวาน', 'เครื่องดื่ม'];
const categoryLabels = { Thai: 'อาหารไทย', International: 'อาหารนานาชาติ', Dessert: 'เบเกอรี่ & ขนมหวาน', Healthy: 'อาหารเพื่อสุขภาพ' };
const demoMode = process.env.RECIPE_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production';
const demoSession = demoMode ? session({
  name: 'recipe.demo', secret: randomBytes(32).toString('hex'), resave: false,
  saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', maxAge: 86400000 }
}) : null;

function sessionContext(req, res, next) {
  // TODO: The team's authentication middleware must run before recipe routers and set req.session.userId.
  if (req.session || !demoSession) return next();
  demoSession(req, res, next);
}

function numericId(value) {
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function asyncRoute(handler) {
  return async (req, res, next) => {
    try { await handler(req, res, next); }
    catch (error) {
      if (/^(Mongo|Mongoose)/.test(error.name)) return next(createError(503, 'ฐานข้อมูลไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง'));
      next(error);
    }
  };
}

function databaseReady(req, res, next) {
  if (mongoose.connection.readyState !== 1) return next(createError(503, 'ฐานข้อมูลไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง'));
  next();
}

const chefContext = asyncRoute(async (req, res, next) => {
  let id = numericId(req.session && req.session.userId);
  if (!id && demoMode && req.session) {
    id = numericId(req.session.recipeDemoChefId);
    if (!id) {
      const chef = await Client.create({ name: 'เชฟทดลอง', role: 'chef',
        email: `recipe-demo-${randomBytes(16).toString('hex')}@example.invalid`,
        passwordHash: randomBytes(48).toString('hex') });
      id = chef._id;
      req.session.recipeDemoChefId = id;
    }
  }
  if (!id) throw createError(401, 'กรุณาเข้าสู่ระบบด้วยบัญชีเชฟ');
  const chef = await Client.findById(id).select('name role');
  if (!chef || chef.role !== 'chef') throw createError(403, 'เฉพาะเชฟเท่านั้นที่จัดการสูตรอาหารได้');
  req.recipeChefId = id;
  res.locals.recipeChefName = chef.name;
  req.session.recipeCsrf = req.session.recipeCsrf || randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.recipeCsrf;
  res.locals.demoMode = demoMode && !req.session.userId;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (typeof req.body._csrf !== 'string' || req.body._csrf !== req.session.recipeCsrf)) {
    throw createError(403, 'ฟอร์มหมดอายุ กรุณาเปิดหน้าใหม่แล้วลองอีกครั้ง');
  }
  next();
});

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function list(value) { return Array.isArray(value) ? value : value === undefined ? [] : [value]; }
function safeUrl(value) {
  if (!value) return true;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch (_) { return false; }
}

function parseRecipe(body, existing) {
  const names = list(body.ingredientName);
  const amounts = list(body.ingredientAmount);
  const difficulty = text(body.difficulty) || Object.keys(difficultyLevels).find(key => difficultyLevels[key] === text(body.level));
  const recipe = { title: text(body.title || body.name),
    category: text(body.category), difficulty, level: difficultyLevels[difficulty], price: Number(body.price),
    image: text(body.image || body.imageUrl),
    duration: body.duration === undefined ? (existing && existing.duration) ?? null : text(body.duration) ? Number(body.duration) : null,
    ingredients: names.map((name, i) => ({ name: text(name), amount: text(amounts[i]) }))
      .filter(item => item.name || item.amount),
    steps: list(body.stepDescription).map(text).filter(Boolean)
      .map((description, i) => ({ stepNumber: i + 1, description })) };
  const errors = [];
  if (!recipe.title || recipe.title.length > 200) errors.push('กรุณาระบุชื่อสูตรไม่เกิน 200 ตัวอักษร');
  if (!recipe.category || recipe.category.length > 80) errors.push('กรุณาระบุหมวดหมู่ไม่เกิน 80 ตัวอักษร');
  if (!difficulties.includes(recipe.difficulty)) errors.push('กรุณาเลือกระดับความยาก');
  if (!text(body.price) || !Number.isFinite(recipe.price) || recipe.price < 0) errors.push('ราคาต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
  if (!recipe.image || recipe.image.length > 2000 || !safeUrl(recipe.image)) errors.push('กรุณาระบุ URL รูปภาพเมนูเป็น http หรือ https');
  if (recipe.duration !== null && (!Number.isFinite(recipe.duration) || recipe.duration < 0)) errors.push('ระยะเวลาต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
  if (names.length > 100 || amounts.length > 100 || list(body.stepDescription).length > 100) errors.push('เพิ่มวัตถุดิบและขั้นตอนได้ไม่เกินอย่างละ 100 รายการ');
  if (names.length !== amounts.length || !recipe.ingredients.length || recipe.ingredients.some(item => !item.name || !item.amount || item.name.length > 200 || item.amount.length > 100)) errors.push('กรุณาระบุวัตถุดิบและปริมาณให้ครบ');
  if (!recipe.steps.length || recipe.steps.some(step => step.description.length > 4000)) errors.push('กรุณาระบุขั้นตอนทำอาหาร แต่ละขั้นตอนไม่เกิน 4000 ตัวอักษร');
  return { recipe, errors };
}

function parseFilters(query) {
  const filters = { search: text(query.search), category: list(query.category).filter(value => value !== '').map(text),
    level: text(query.level), difficulty: text(query.difficulty), sort: text(query.sort) || 'popular',
    minPrice: text(query.minPrice), maxPrice: text(query.maxPrice), minDuration: text(query.minDuration),
    maxDuration: text(query.maxDuration), minRating: text(query.minRating) };
  if (Object.keys(filters).filter(key => key !== 'category').some(key => query[key] !== undefined && typeof query[key] !== 'string') || list(query.category).some(value => typeof value !== 'string')) throw createError(400, 'ตัวกรองไม่ถูกต้อง');
  if (filters.search.length > 200 || filters.category.length > 20 || filters.category.some(value => value.length > 80)) throw createError(400, 'คำค้นหายาวเกินกำหนด');
  if (filters.level && !levels.includes(filters.level)) throw createError(400, 'ระดับความยากไม่ถูกต้อง');
  if (!filters.difficulty && filters.level) filters.difficulty = Object.keys(difficultyLevels).find(key => difficultyLevels[key] === filters.level);
  if (filters.difficulty && !difficulties.includes(filters.difficulty)) throw createError(400, 'ระดับความยากไม่ถูกต้อง');
  if (!['popular', 'rating', 'newest'].includes(filters.sort)) throw createError(400, 'การเรียงลำดับไม่ถูกต้อง');
  const clauses = [];
  if (filters.search) {
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clauses.push({ $or: ['title', 'description', 'category'].map(field => ({ [field]: { $regex: escaped, $options: 'i' } })) });
  }
  if (filters.category.length) {
    const values = filters.category.flatMap(category => [category, ...Object.keys(categoryLabels).filter(key => categoryLabels[key] === category)]);
    clauses.push({ category: { $in: values } });
  }
  if (filters.difficulty) {
    const legacy = { difficulty: { $exists: false }, level: difficultyLevels[filters.difficulty] };
    if (filters.difficulty === 'EASY') {
      delete legacy.level;
      legacy.$or = [{ level: 'BEGINNER' }, { level: { $exists: false } }];
    }
    clauses.push({ $or: [{ difficulty: filters.difficulty }, legacy] });
  }
  for (const [field, min, max] of [['price', 'minPrice', 'maxPrice'], ['duration', 'minDuration', 'maxDuration']]) {
    const range = {};
    for (const [key, operator] of [[min, '$gte'], [max, '$lte']]) {
      if (!filters[key]) continue;
      const value = Number(filters[key]);
      if (!Number.isFinite(value) || value < 0) throw createError(400, 'ช่วงราคาและเวลาต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
      range[operator] = value;
    }
    if (filters[min] && filters[max] && Number(filters[min]) > Number(filters[max])) throw createError(400, 'ค่าต่ำสุดต้องไม่เกินค่าสูงสุด');
    if (Object.keys(range).length) clauses.push({ [field]: range });
  }
  if (filters.minRating) {
    const rating = Number(filters.minRating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) throw createError(400, 'คะแนนต้องอยู่ระหว่าง 0 ถึง 5');
    clauses.push({ rating: { $gte: rating } });
  }
  const sort = { popular: { favoriteCount: -1, reviewCount: -1, createdAt: -1, _id: -1 }, rating: { rating: -1, reviewCount: -1, _id: -1 }, newest: { createdAt: -1, _id: -1 } }[filters.sort];
  return { filters, criteria: clauses.length ? { $and: clauses } : {}, sort };
}

function recipeView(record) {
  const recipe = record.toObject ? record.toObject() : { ...record };
  recipe.difficulty = recipe.difficulty || Object.keys(difficultyLevels).find(key => difficultyLevels[key] === recipe.level) || 'EASY';
  recipe.ingredientCount = recipe.ingredients ? recipe.ingredients.length : recipe.ingredientCount || 0;
  recipe.stepCount = recipe.steps ? recipe.steps.length : recipe.stepCount || 0;
  return recipe;
}

function filterQuery(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (key === 'level') return;
    (Array.isArray(value) ? value : [value]).filter(Boolean).forEach(item => params.append(key, item));
  });
  return params.toString();
}

function viewContext(req, res, next) {
  Object.assign(res.locals, { levels, levelLabels, difficulties, difficultyLabels, recipeCategories: categories, categoryLabels, brandName: 'CookHub' });
  next();
}

function videoEmbed(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    let id;
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1];
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id || '') ? `https://www.youtube-nocookie.com/embed/${id}` : '';
  } catch (_) { return ''; }
}

module.exports = { levels, levelLabels, sessionContext, numericId, asyncRoute, databaseReady,
  chefContext, parseRecipe, parseFilters, safeUrl, videoEmbed, recipeView, filterQuery, viewContext };
