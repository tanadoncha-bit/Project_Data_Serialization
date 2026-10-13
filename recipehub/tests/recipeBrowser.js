const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');

module.exports = async function browserChecks(base, ownerId) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const output = path.resolve('node_modules/.cache/recipe-ui');
  const Recipe = require('../models/Recipe');
  const Client = require('../models/Client');
  await fs.mkdir(output, { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const fixtureChef = await Client.create({ name: 'เชฟทดสอบ', role: 'chef', email: 'browser-chef@example.invalid', passwordHash: 'test-only' });
    await context.request.post(base + '/test-login/' + fixtureChef._id);
    await page.goto(base + '/chef/recipes');
    assert.equal(await page.locator('.recipe-empty').count(), 1);
    await page.locator('a[data-recipe-modal=form]').first().click();
    await page.locator('#recipe-content-dialog[open] .recipe-form').waitFor();
    assert.equal(new URL(page.url()).pathname, '/chef/recipes');
    assert.equal(await page.locator('[name=description], [name=videoUrl]').count(), 0);
    const form = page.locator('#recipe-content-dialog .recipe-form');
    await form.locator('[name=title]').fill('ครัวซองต์ผลไม้');
    await form.locator('[name=category]').selectOption('เบเกอรี่ & ขนมหวาน');
    await form.locator('[name=difficulty]').selectOption('MEDIUM');
    await form.locator('[name=image]').fill(base + '/images/recipes/recipe-hero.png');
    await form.locator('[name=ingredientName]').fill('ครัวซองต์');
    await form.locator('[name=ingredientAmount]').fill('2 ชิ้น');
    await form.locator('[name=stepDescription]').fill('เตรียมครัวซองต์และผลไม้สด');
    await form.locator('[data-add=ingredient]').click();
    assert.equal(await form.locator('[name=ingredientName]').count(), 2);
    await form.locator('[data-rows=ingredient] [data-remove-row]').last().click();
    assert.equal(await form.locator('[name=ingredientName]').count(), 1);
    await form.locator('[data-add=ingredient]').click();
    await form.locator('[name=ingredientName]').last().fill('สตรอว์เบอร์รี');
    await form.locator('[name=ingredientAmount]').last().fill('6 ลูก');
    await form.locator('[data-add=step]').click();
    await form.locator('[name=stepDescription]').last().fill('จัดเสิร์ฟพร้อมไอศกรีม');
    assert.equal(await form.locator('[data-step-label]').last().textContent(), '2');
    await page.screenshot({ path: path.join(output, 'create-desktop.png'), fullPage: true });
    await form.locator('button[type=submit]').click();
    await page.waitForURL(/\/chef\/recipes\/\d+\?saved=1$/);
    const id = Number(page.url().match(/recipes\/(\d+)/)[1]);
    await page.locator('#recipe-content-dialog[open] .recipe-steps').waitFor();
    assert.ok((await page.locator('.recipe-steps').textContent()).includes('จัดเสิร์ฟ'));
    assert.equal(await page.locator('.recipe-ingredients li').count(), 2);
    await page.screenshot({ path: path.join(output, 'preview-desktop.png'), fullPage: true });
    await page.locator('#recipe-content-dialog [data-close-recipe]').click();
    await page.waitForURL(url => url.pathname === '/chef/recipes');
    assert.equal(new URL(page.url()).pathname, '/chef/recipes');

    // Only the isolated test database receives these screenshot fixtures.
    const mealResponse = await context.request.get(base + '/api/meals/search?q=chicken');
    const meals = (await mealResponse.json()).meals;
    assert.ok(meals.length > 0);
    const fixtures = [];
    for (let i = 0; i < 2; i++) {
      fixtures.push(await Recipe.create({
        publisher: fixtureChef._id, title: meals[i].title, category: i ? 'อาหารนานาชาติ' : 'อาหารไทย',
        difficulty: 'EASY', level: 'BEGINNER', price: i ? 150 : 0, image: meals[i].image, duration: 30 + i * 15, rating: 4.8 + i / 10,
        ingredients: [{ name: 'ไก่', amount: '200 กรัม' }, { name: 'ผัก', amount: '100 กรัม' }], steps: [{ stepNumber: 1, description: 'เตรียมวัตถุดิบ' }, { stepNumber: 2, description: 'ปรุงอาหารและจัดเสิร์ฟ' }]
      }));
    }
    await page.goto(base + '/chef/recipes');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.recipe-card img')).every(image => image.complete && image.naturalWidth > 0), null, { timeout: 15000 });
    await page.screenshot({ path: path.join(output, 'chef-list-desktop.png'), fullPage: true });
    await page.locator('a[href="/chef/recipes/' + id + '/edit"]').click();
    await page.locator('#recipe-content-dialog[open] .recipe-form').waitFor();
    assert.equal(await form.locator('[name=ingredientName]').first().inputValue(), 'ครัวซองต์');
    await form.locator('[name=price]').fill('150');
    await form.locator('[name=title]').fill('ครัวซองต์ผลไม้สด');
    await form.locator('[data-rows=ingredient] [data-remove-row]').first().click();
    await form.locator('[data-add=ingredient]').click();
    await form.locator('[name=ingredientName]').last().fill('ไอศกรีม');
    await form.locator('[name=ingredientAmount]').last().fill('1 ลูก');
    await form.locator('[data-rows=step] [data-remove-row]').first().click();
    assert.equal(await form.locator('[data-step-label]').first().textContent(), '1');
    await form.locator('[data-add=step]').click();
    await form.locator('[name=stepDescription]').last().fill('พร้อมรับประทาน');
    await form.locator('button[type=submit]').click();
    await page.waitForURL(/saved=1/);
    await page.locator('#recipe-content-dialog[open] .recipe-steps').waitFor();
    const updated = await Recipe.findById(id);
    assert.equal(updated.title, 'ครัวซองต์ผลไม้สด');
    assert.equal(updated.ingredients[0].name, 'สตรอว์เบอร์รี');
    assert.equal(updated.steps[1].stepNumber, 2);
    await page.locator('#recipe-content-dialog [data-close-recipe]').click();

    // Long edit forms must scroll inside the modal and retain accessible actions.
    await page.locator('a[href="/chef/recipes/' + id + '/edit"]').click();
    await page.locator('#recipe-content-dialog[open] .recipe-form').waitFor();
    for (let i = 0; i < 12; i++) await form.locator('[data-add=step]').click();
    assert.ok(await page.locator('#recipe-content-dialog').evaluate(dialog => dialog.scrollHeight > dialog.clientHeight));
    await form.locator('[data-close-recipe]').click();
    assert.equal((await Recipe.findById(id)).steps.length, 2);

    const publicContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const publicPage = await publicContext.newPage();
    publicPage.on('pageerror', error => errors.push(error.message));
    await publicPage.goto(base + '/recipes?search=' + encodeURIComponent('ครัวซองต์'));
    await publicPage.screenshot({ path: path.join(output, 'user-list-desktop.png'), fullPage: true });
    await publicPage.locator('.recipe-card-title [data-recipe-modal]').click();
    await publicPage.locator('#recipe-content-dialog[open] .recipe-locked').waitFor();
    assert.equal(await publicPage.locator('.recipe-steps').count(), 0);
    assert.ok(!(await publicPage.locator('#recipe-modal-content').textContent()).includes('พร้อมรับประทาน'));
    await publicPage.locator('[data-purchase-recipe]').click();
    assert.ok((await publicPage.locator('[data-purchase-status]').textContent()).includes('ยังไม่เปิด'));
    await publicPage.screenshot({ path: path.join(output, 'paid-desktop.png'), fullPage: true });
    await publicPage.locator('[data-close-recipe]').click();
    await publicPage.locator('[data-favorite-recipe]').click();
    assert.ok((await publicPage.locator('[data-favorite-status]').textContent()).includes('ยังไม่เปิด'));
    await publicPage.locator('[data-open-filter]').click();
    await publicPage.locator('#recipe-filter-dialog[open]').waitFor();
    await publicPage.locator('[name=category][value="เบเกอรี่ & ขนมหวาน"]').check();
    await publicPage.locator('[name=minPrice]').fill('100');
    await publicPage.locator('[name=maxPrice]').fill('200');
    await publicPage.locator('[data-range="Price"] [data-range-min]').evaluate(input => { input.value = '120'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await publicPage.locator('[name=minPrice]').inputValue(), '120');
    await publicPage.locator('[data-range="Price"] [data-range-min]').evaluate(input => { input.value = '100'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await publicPage.screenshot({ path: path.join(output, 'filter-desktop.png'), fullPage: true });
    await publicPage.locator('#recipe-filter-dialog button[type=submit]').click();
    await publicPage.waitForURL(/minPrice=100/);
    assert.equal(await publicPage.locator('.recipe-card').count(), 1);
    assert.equal(await publicPage.locator('[name=minPrice]').inputValue(), '100');
    await publicPage.locator('[data-sort=rating]').click();
    await publicPage.waitForURL(/sort=rating/);
    assert.equal(new URL(publicPage.url()).searchParams.get('minPrice'), '100');
    await publicPage.locator('[name=difficulty]').selectOption('MEDIUM');
    await publicPage.waitForURL(/difficulty=MEDIUM/);
    assert.equal(await publicPage.locator('.recipe-card').count(), 1);

    await publicPage.setViewportSize({ width: 390, height: 844 });
    await publicPage.screenshot({ path: path.join(output, 'list-mobile.png'), fullPage: true });
    assert.ok(await publicPage.locator('main').evaluate(main => main.scrollWidth <= main.clientWidth));
    await publicPage.locator('.recipe-card-title [data-recipe-modal]').click();
    await publicPage.locator('#recipe-content-dialog[open] .recipe-locked').waitFor();
    assert.ok(await publicPage.locator('#recipe-content-dialog').evaluate(dialog => dialog.getBoundingClientRect().width <= innerWidth));
    await publicPage.screenshot({ path: path.join(output, 'paid-mobile.png'), fullPage: true });
    await publicPage.keyboard.press('Escape');
    assert.equal(await publicPage.locator('#recipe-content-dialog[open]').count(), 0);
    await publicPage.goto(base + '/recipes/' + fixtures[0]._id);
    assert.equal(await publicPage.locator('.recipe-steps li').count(), 2);

    await publicPage.goto(base + '/recipes/inspiration');
    await publicPage.locator('[name=q]').fill('chicken');
    await publicPage.locator('#meal-search button').click();
    await publicPage.locator('#meal-results .recipe-card').first().waitFor({ timeout: 15000 });
    await publicPage.locator('#meal-results button').first().click();
    await publicPage.locator('#meal-detail:visible').waitFor({ timeout: 15000 });
    assert.ok(await publicPage.locator('#meal-detail li').count() > 0);

    await page.goto(base + '/chef/recipes');
    await page.locator('form[action="/chef/recipes/' + id + '/delete"] button').click();
    assert.equal(await page.locator('#recipe-delete-name').textContent(), 'ครัวซองต์ผลไม้สด');
    await page.locator('#recipe-delete-cancel').click();
    assert.ok(await Recipe.findById(id));
    await page.locator('form[action="/chef/recipes/' + id + '/delete"] button').click();
    await page.screenshot({ path: path.join(output, 'delete-dialog.png'), fullPage: true });
    await page.locator('#recipe-delete-confirm').click();
    await page.waitForURL(/deleted=1/);
    assert.equal(await Recipe.findById(id), null);
    for (const fixture of fixtures) await Recipe.deleteOne({ _id: fixture._id });
    assert.deepEqual(errors, []);
    console.log('PASS: modal CRUD, row reordering, long-form scrolling, screenshots, mobile filters/sort, paid lock, integration buttons, and live TheMealDB');
    console.log('Screenshots: node_modules/.cache/recipe-ui');
  } finally { await browser.close(); }
};
