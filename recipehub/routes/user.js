/* ===========================================================
   หน้าฝั่งผู้ใช้ของมุกดา (อยู่ใต้ /user ทั้งหมด จะได้ไม่ชนกับ /home /recipes /profile ของเพื่อน)
     GET  /user            หน้าแรก (คอร์สยอดนิยม / สูตรแนะนำ / เชฟยอดนิยม)
     GET  /user/recipes    ส่งต่อไปหน้าหลัก /recipes
     GET  /user/profile    ส่งต่อไปหน้าโปรไฟล์หลัก /profile (ของเพื่อน — ทีมตกลงใช้หน้านี้)
   ข้อมูลทั้งหมดมาจาก MongoDB ผ่าน services/userPages.js
   =========================================================== */
const express = require('express');
const router = express.Router();

const pages = require('../services/userPages');
const catalog = require('../services/courseCatalog');
const recipeBrowseRedirect = require('../helpers/recipeBrowseRedirect');
const { asyncRoute, databaseReady } = require('../services/recipeSupport');

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

/* โปรไฟล์: ใช้ /profile ของเพื่อน — รองรับลิงก์เดิม */
router.get('/profile', (req, res) => res.redirect(302, '/profile'));

module.exports = router;
