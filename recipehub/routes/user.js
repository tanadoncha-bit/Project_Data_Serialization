/* ===========================================================
   หน้าฝั่งผู้ใช้ (อยู่ใต้ /user)
     GET  /user            หน้าแรก (คอร์สยอดนิยม / สูตรแนะนำ / เชฟยอดนิยม)
     GET  /user/recipes    ส่งต่อไปหน้าหลัก /recipes
     GET  /user/profile    ส่งต่อไปหน้าโปรไฟล์ /profile
   ข้อมูลทั้งหมดมาจาก MongoDB ผ่าน services/userPages.js
   =========================================================== */
const express = require('express');
const router = express.Router();

const pages = require('../services/userPages');
const catalog = require('../services/courseCatalog');
const recipeBrowseRedirect = require('../helpers/recipeBrowseRedirect');
const { asyncRoute, databaseReady } = require('../services/recipeSupport');

router.use(databaseReady);

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

/* โปรไฟล์: ใช้ /profile — รองรับลิงก์เดิม */
router.get('/profile', (req, res) => res.redirect(302, '/profile'));

module.exports = router;
