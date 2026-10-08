const express = require('express');
const createError = require('http-errors');
const Recipe = require('../models/Recipe');
const Transaction = require('../models/Transaction');
const support = require('../services/recipeSupport');
const router = express.Router();

router.use(support.sessionContext, support.viewContext);
router.use((req, res, next) => {
  res.locals.active = 'recipes';
  res.locals.levels = support.levels;
  res.locals.levelLabels = support.levelLabels;
  next();
});

router.get('/inspiration', (req, res) => res.render('recipes/inspiration', { title: 'ไอเดียจาก TheMealDB' }));
router.use(support.databaseReady);

router.get('/', support.asyncRoute(async (req, res) => {
  const { filters, criteria, sort } = support.parseFilters(req.query);
  const page = req.query.page === undefined ? 1 : support.numericId(req.query.page);
  if (!page || page > 100000) throw createError(400, 'หมายเลขหน้าไม่ถูกต้อง');
  const pageSize = 12;
  const [recipes, categories, total] = await Promise.all([
    Recipe.find(criteria).select('-ingredients -steps -videoUrl').populate('publisher', 'name')
      .sort(sort).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Recipe.distinct('category'), Recipe.countDocuments(criteria)
  ]);
  res.render('recipes/index', { title: 'สูตรอาหาร', recipes: recipes.map(support.recipeView), categories: categories.filter(Boolean).sort(),
    filters, page, total, pages: Math.ceil(total / pageSize), pageQuery: support.filterQuery(filters) });
}));

router.get('/:id', support.asyncRoute(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const id = support.numericId(req.params.id);
  if (!id) throw createError(400, 'รหัสสูตรอาหารไม่ถูกต้อง');
  const record = await Recipe.findById(id).populate('publisher', 'name').lean();
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
