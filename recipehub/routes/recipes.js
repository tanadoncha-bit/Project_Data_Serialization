const express = require('express');
const createError = require('http-errors');
const Recipe = require('../models/Recipe');
const Favorite = require('../models/Favorite');
const Client = require('../models/Client');
const Transaction = require('../models/Transaction');
const support = require('../services/recipeSupport');
const mealApi = require('../services/mealApiService');
const countries = require('../services/recipeCountries');
const router = express.Router();

router.use(support.sessionContext, support.viewContext);
router.use((req, res, next) => {
  res.locals.active = 'recipes';
  res.locals.levels = support.levels;
  res.locals.levelLabels = support.levelLabels;
  next();
});

router.get('/inspiration', (req, res) => res.render('recipes/inspiration', { title: 'ไอเดียจาก TheMealDB' }));
// External IDs have their own namespace so they cannot collide with MongoDB recipe IDs.
router.get('/external/:id', support.asyncRoute(async (req, res) => {
  if (!/^[1-9]\d{0,9}$/.test(req.params.id)) throw createError(400, 'รหัสเมนูไม่ถูกต้อง');
  let meal;
  try { meal = await mealApi.lookup(req.params.id); }
  catch (_) { throw createError(502, 'TheMealDB ไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง'); }
  if (!meal) throw createError(404, 'ไม่พบเมนู');
  const locals = { title: meal.title, meal, videoEmbed: support.videoEmbed(meal.videoUrl) };
  if (req.query.fragment === '1') return res.render('recipes/_externalDetail', locals);
  res.render('recipes/external', locals);
}));
router.use(support.databaseReady);

router.put('/favorites/:type/:id', support.asyncRoute(async (req, res) => {
  const client = support.numericId(req.user?._id || req.session?.userId);
  if (!client || !await Client.exists({_id:client})) return res.status(401).json({error:'กรุณาเข้าสู่ระบบก่อนเพิ่มรายการโปรด'});
  const id = support.numericId(req.params.id);
  const itemType = {local:'Recipe',external:'ExternalRecipe'}[req.params.type];
  if (!id || !itemType || typeof req.body?.favorite !== 'boolean') return res.status(400).json({error:'รายการโปรดไม่ถูกต้อง'});
  const key = {client,itemType,itemId:id};
  if (!req.body.favorite) { await Favorite.deleteOne(key); return res.json({favorite:false}); }
  let item;
  if (itemType === 'Recipe') item = await Recipe.findById(id).select('title image').lean();
  else { try { item = await mealApi.lookup(String(id)); } catch (_) { return res.status(502).json({error:'โหลดสูตรไม่สำเร็จ กรุณาลองใหม่'}); } }
  if (!item) return res.status(404).json({error:'ไม่พบสูตรอาหาร'});
  if (!await Favorite.exists(key)) {
    try { await Favorite.create({...key, ...(itemType === 'ExternalRecipe' ? {title:item.title,image:item.image} : {})}); }
    catch (error) { if (error.code !== 11000) throw error; }
  }
  return res.json({favorite:true});
}));

router.get('/', support.asyncRoute(async (req, res) => {
  const { filters, criteria, sort } = support.parseFilters(req.query);
  const page = req.query.page === undefined ? 1 : support.numericId(req.query.page);
  if (!page || page > 100000) throw createError(400, 'หมายเลขหน้าไม่ถูกต้อง');
  const pageSize = 12;
  // Keep local recipes available even if the external service fails.
  let externalError = '';
  const hasUnsupportedFilter = filters.difficulty || filters.minRating || Number(filters.minDuration) > 0 || filters.maxDuration || Number(filters.minPrice) > 0;
  const externalRequest = (filters.source === 'chef' || hasUnsupportedFilter ? Promise.resolve([]) : filters.search ? mealApi.search(filters.search) : mealApi.browse())
    .catch(() => { externalError = 'โหลดเมนูจาก TheMealDB ไม่สำเร็จ กรุณาลองใหม่ภายหลัง'; return []; });
  const [allMeals, categories, localTotal] = await Promise.all([
    externalRequest, Recipe.distinct('category'), filters.source === 'general' ? Promise.resolve(0) : Recipe.countDocuments(criteria)
  ]);
  const countryOptions = countries.countryOptions;

  const meals = hasUnsupportedFilter ? [] : allMeals.filter(meal => (!filters.country.length || filters.country.includes(countries.mealCountry(meal))) && (!filters.category.length || filters.category.some(category => {
    const label = res.locals.categoryLabels[category] || category;
    return [meal.category, meal.area].includes(category) ||
      ((label || category) === 'อาหารไทย' && meal.area === 'Thai') ||
      ((label || category) === 'อาหารญี่ปุ่น' && meal.area === 'Japanese') ||
      ((label || category) === 'อาหารจีน' && meal.area === 'Chinese') ||
      ((label || category) === 'อาหารอินเดีย' && meal.area === 'Indian') ||
      ((label || category) === 'เบเกอรี่ & ขนมหวาน' && meal.category === 'Dessert') ||
      ((label || category) === 'อาหารนานาชาติ' && !['Thai', 'Japanese', 'Chinese', 'Indian'].includes(meal.area));
  })));
  const offset = (page - 1) * pageSize;
  const recipes = filters.source === 'general' ? [] : await Recipe.find(criteria).select('-ingredients -steps -videoUrl').populate('publisher', 'name role')
    .sort(sort).skip(offset).limit(pageSize).lean();
  const externalMeals = meals.slice(Math.max(0, offset - localTotal), Math.max(0, offset - localTotal) + pageSize - recipes.length);
  const total = localTotal + meals.length;
  const client = support.numericId(req.user?._id || req.session?.userId);
  const favorites = client ? await Favorite.find({client,itemType:{$in:['Recipe','ExternalRecipe']},itemId:{$in:[...recipes.map(r=>r._id),...externalMeals.map(m=>Number(m.id))]}}).select('itemType itemId').lean() : [];
  const favoriteKeys = new Set(favorites.map(f=>f.itemType+':'+f.itemId));
  res.render('recipes/index', { title: 'สูตรอาหาร', recipes: recipes.map(support.recipeView), externalMeals, externalError, countryOptions,
    favoriteKeys, categories: categories.filter(Boolean).sort(),
    cataloguePending: filters.source !== 'chef' && !hasUnsupportedFilter && !filters.search && !!mealApi.cataloguePending?.(),
    filters, page, total, pages: Math.ceil(total / pageSize), pageQuery: support.filterQuery(filters) });
}));

router.get('/:id', support.asyncRoute(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const id = support.numericId(req.params.id);
  if (!id) throw createError(400, 'รหัสสูตรอาหารไม่ถูกต้อง');
  const record = await Recipe.findById(id).populate('publisher', 'name role').lean();
  const recipe = record && support.recipeView(record);
  if (!recipe) throw createError(404, 'ไม่พบสูตรอาหาร');
  const userId = support.numericId(req.session && req.session.userId);
  const demoChefId = support.numericId(req.session && req.session.recipeDemoChefId);
  let canAccess = recipe.price === 0 || (recipe.publisher && [userId, demoChefId].includes(recipe.publisher._id));
  // Transaction is the existing purchase integration point; payment stays with the team's purchase system.
  if (!canAccess && userId) canAccess = !!(await Transaction.exists({ buyer: userId, itemType: 'Recipe', itemId: id }));
  if (!canAccess) {
    delete recipe.ingredients;
    delete recipe.steps;
    delete recipe.videoUrl;
  }
  const locals = { title: recipe.title, recipe, canAccess, videoEmbed: support.videoEmbed(recipe.videoUrl) };
  if (req.query.fragment === '1') return res.render('recipes/_detail', locals);
  res.render('recipes/show', locals);
}));

module.exports = router;
