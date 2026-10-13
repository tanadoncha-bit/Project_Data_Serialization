const express = require('express');
const router = express.Router();

const pages = require('../services/userPages');
const catalog = require('../services/courseCatalog');
const recipeBrowseRedirect = require('../helpers/recipeBrowseRedirect');
const { asyncRoute, databaseReady } = require('../services/recipeSupport');

router.use(databaseReady);

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

router.get('/profile', (req, res) => res.redirect(302, '/profile'));

module.exports = router;
