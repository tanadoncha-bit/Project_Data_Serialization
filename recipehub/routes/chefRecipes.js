const express = require('express');
const createError = require('http-errors');
const Recipe = require('../models/Recipe');
const support = require('../services/recipeSupport');
const router = express.Router();
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomBytes } = require('node:crypto');
const imageUpload = multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:0}}).single('image');

router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.use(support.sessionContext, support.databaseReady, support.chefContext, support.viewContext);
router.use((req, res, next) => {
  res.locals.active = 'recipes';
  res.locals.levels = support.levels;
  res.locals.levelLabels = support.levelLabels;
  next();
});

async function ownRecipes(req) {
  return (await Recipe.find({ publisher: req.recipeChefId }).select('title category level difficulty price image duration rating reviewCount ingredients.name steps.stepNumber').sort({ createdAt: -1 }).lean()).map(support.recipeView);
}

async function renderList(req, res, initialModal = null, status = 200) {
  const view = !initialModal ? 'index' : initialModal.kind === 'preview' ? 'show' : initialModal.recipe._id ? 'edit' : 'create';
  res.status(status).render(`chef/recipes/${view}`, { title: 'จัดการสูตรอาหาร', recipes: await ownRecipes(req),
    saved: req.query.saved === '1', deleted: req.query.deleted === '1', initialModal });
}

async function renderModal(req, res, kind, recipe, errors = [], status = 200) {
  const modal = { kind, recipe: support.recipeView(recipe), errors, canAccess: true, videoEmbed: support.videoEmbed(recipe.videoUrl) };
  if (req.query.fragment === '1') return res.status(status).render('chef/recipes/_modalContent', { modal });
  await renderList(req, res, modal, status);
}

function mutationResult(req, res, location) {
  if (req.query.fragment === '1') return res.json({ location });
  res.redirect(303, location);
}

router.get('/', support.asyncRoute(async (req, res) => renderList(req, res)));

router.post('/upload-image', (req,res,next)=>{
  imageUpload(req,res,async error=>{
    if(error)return res.status(400).json({error:error.code==='LIMIT_FILE_SIZE'?'รูปต้องไม่เกิน 5 MB':'อัปโหลดรูปไม่สำเร็จ'});
    if(!req.file)return res.status(400).json({error:'กรุณาเลือกรูปภาพ'});
    const b=req.file.buffer;
    const ext=b.length>3&&b[0]===255&&b[1]===216&&b[2]===255?'jpg':b.length>8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':b.length>12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'webp':null;
    if(!ext)return res.status(400).json({error:'รองรับเฉพาะรูป JPG, PNG และ WebP'});
    try { const filename=randomBytes(16).toString('hex')+'.'+ext;const dir=path.join(__dirname,'../public/uploads/recipes');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,filename),b);res.json({image:'/uploads/recipes/'+filename}); }catch(error){next(error);}
  });
});

router.get('/create', support.asyncRoute(async (req, res) => {
  await renderModal(req, res, 'form', { price: 0, difficulty: 'EASY', category: 'อาหารไทย', ingredients: [], steps: [] });
}));

router.post('/', support.asyncRoute(async (req, res) => {
  const { recipe, errors } = support.parseRecipe(req.body);
  if (errors.length) return renderModal(req, res, 'form', recipe, errors, 422);
  const created = await Recipe.create({ ...recipe, publisher: req.recipeChefId });
  mutationResult(req, res, `/chef/recipes/${created._id}?saved=1`);
}));

router.param('id', support.asyncRoute(async (req, res, next) => {
  const id = support.numericId(req.params.id);
  if (!id) throw createError(400, 'รหัสสูตรอาหารไม่ถูกต้อง');
  const recipe = await Recipe.findOne({ _id: id, publisher: req.recipeChefId });
  if (!recipe) throw createError(404, 'ไม่พบสูตรอาหาร');
  req.recipe = recipe;
  next();
}));

router.get('/:id', support.asyncRoute(async (req, res) => renderModal(req, res, 'preview', req.recipe)));

router.get('/:id/edit', support.asyncRoute(async (req, res) => renderModal(req, res, 'form', req.recipe)));

const update = support.asyncRoute(async (req, res) => {
  const { recipe, errors } = support.parseRecipe(req.body, req.recipe);
  if (errors.length) return renderModal(req, res, 'form', { ...recipe, _id: req.recipe._id }, errors, 422);
  Object.assign(req.recipe, recipe);
  await req.recipe.save();
  mutationResult(req, res, `/chef/recipes/${req.recipe._id}?saved=1`);
});
const remove = support.asyncRoute(async (req, res) => {
  const result = await Recipe.deleteOne({ _id: req.recipe._id, publisher: req.recipeChefId });
  if (!result.deletedCount) throw createError(404, 'ไม่พบสูตรอาหาร');
  res.redirect(303, '/chef/recipes?deleted=1');
});

router.post('/:id', update);
router.put('/:id', update);
router.post('/:id/delete', remove);
router.delete('/:id', remove);

module.exports = router;
