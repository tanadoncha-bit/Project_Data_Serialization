/* ===========================================================
   หน้าคอร์สเรียน
     GET /courses?level=&sort=&page=&type=&rating=&minDur=&maxDur=&minPrice=&maxPrice=
     PUT /courses/favorites/:kind/:id   (kind = single | multi, body: { favorite: true/false })
   ข้อมูลมาจาก MongoDB: SingleCourse + MultiCourse (+ Recipe, Client, Transaction, Favorite)
   =========================================================== */
const express = require('express');
const router = express.Router();

const catalog = require('../services/courseCatalog');
const pages = require('../services/userPages');
const { buildListPage } = require('../helpers/list-filters');
const { asyncRoute, databaseReady, numericId } = require('../services/recipeSupport');

/* รายการคอร์ส */
router.get('/', databaseReady, asyncRoute(async (req, res) => {
  const [courses, favorites] = await Promise.all([
    catalog.loadCourses(),
    catalog.favoriteKeys(req.user && req.user._id),
  ]);
  const data = buildListPage(req, courses, '/courses', { level: 'level', minutes: 'durMin' });

  res.render('user/courses', Object.assign(data, {
    title: 'คอร์สเรียน',
    active: 'courses',
    courses: data.list,
    levels: catalog.levelOptions,
    favoriteKeys: favorites,
    loggedIn: Boolean(req.user),
  }));
}));

/* รายละเอียดคอร์ส  GET /courses/:id (คอร์สเดี่ยว)  และ  GET /courses/pack/:id (แพ็กคอร์ส) */
async function showDetail(kind, req, res, next) {
  const id = numericId(req.params.id);
  if (!id) return next();                                  // ไม่ใช่ตัวเลข → 404 ของเพื่อน
  const data = await pages.loadCourseDetail(kind, id, req.user && req.user._id);
  if (!data) return next();                                // ไม่มีคอร์สนี้ → 404
  res.render('user/course-detail', Object.assign(data, { loggedIn: Boolean(req.user) }));
}
router.get('/pack/:id', databaseReady, asyncRoute((req, res, next) => showDetail('multi', req, res, next)));
router.get('/:id', databaseReady, asyncRoute((req, res, next) => showDetail('single', req, res, next)));

/* กดใจ / เลิกกดใจ (เรียกจาก JavaScript ในหน้า) */
router.put('/favorites/:kind/:id', databaseReady, asyncRoute(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนเพิ่มรายการโปรด' });
  const id = numericId(req.params.id);
  if (!id || typeof (req.body && req.body.favorite) !== 'boolean') {
    return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
  }
  const result = await catalog.setFavorite(req.user._id, req.params.kind, id, req.body.favorite);
  if (result === null) return res.status(404).json({ error: 'ไม่พบคอร์สนี้' });
  res.json({ favorite: result });
}));

module.exports = router;
