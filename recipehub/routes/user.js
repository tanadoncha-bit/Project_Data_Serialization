/* ===========================================================
   หน้าฝั่งผู้ใช้ของมุกดา (อยู่ใต้ /user ทั้งหมด จะได้ไม่ชนกับ /home /recipes /profile ของเพื่อน)
     GET  /user            หน้าแรก (คอร์สยอดนิยม / สูตรแนะนำ / เชฟยอดนิยม)
     GET  /user/recipes    ส่งต่อไปหน้าหลัก /recipes
     GET  /user/profile    โปรไฟล์ (?tab=info | favorites | history)   ต้อง login
     POST /user/profile    บันทึกข้อมูลส่วนตัว                          ต้อง login
   ข้อมูลทั้งหมดมาจาก MongoDB ผ่าน services/userPages.js
   =========================================================== */
const express = require('express');
const router = express.Router();

const pages = require('../services/userPages');
const catalog = require('../services/courseCatalog');
const recipeBrowseRedirect = require('../helpers/recipeBrowseRedirect');
const { asyncRoute, databaseReady } = require('../services/recipeSupport');
const { requireLogin } = require('../middleware/requireRole');

router.use(databaseReady);   // database ล่ม → หน้า 503 ของเพื่อน แทนที่จะ error

/* หน้าแรก */
router.get('/', asyncRoute(async (req, res) => {
  const clientId = req.user && req.user._id;
  const [data, favoriteKeys, favoriteIds] = await Promise.all([
    pages.loadHome(),
    catalog.favoriteKeys(clientId),
    pages.favoriteRecipeIds(clientId),
  ]);
  res.render('user/home', Object.assign(data, { favoriteKeys, favoriteIds }));
}));

/* หน้าสูตรหลักใช้ /recipes; รองรับลิงก์เดิมและแปลงตัวกรอง */
router.get('/recipes', (req, res) => res.redirect(302, recipeBrowseRedirect(req.query)));

/* โปรไฟล์ */
async function renderProfile(req, res, extra = {}) {
  const tab = ['info', 'favorites', 'history'].includes(req.query.tab) ? req.query.tab : 'info';
  const data = await pages.loadProfile(req.user._id);
  if (!data) return res.redirect('/home?login=1');
  res.status(extra.error ? 400 : 200).render('user/profile', Object.assign(data, {
    tab: extra.error ? 'info' : tab,
    difficultyLabel: pages.difficultyLabel,
    saved: req.query.saved === '1',
    error: extra.error || null,
  }, extra.form ? { user: Object.assign(data.user, extra.form) } : {}));
}

router.get('/profile', requireLogin, asyncRoute((req, res) => renderProfile(req, res)));

router.post('/profile', requireLogin, asyncRoute(async (req, res) => {
  const error = await pages.saveProfile(req.user._id, req.body);
  if (error) {
    const { firstName, lastName, email, bio } = req.body;
    return renderProfile(req, res, { error, form: { firstName, lastName, email, bio } });
  }
  res.redirect('/user/profile?tab=info&saved=1');
}));

module.exports = router;
