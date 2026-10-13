/* ===========================================================
   หน้าคอร์สเรียน
     GET /courses?source=&sort=&country=&maxDuration=&maxPrice=&minRating=&page=
     PUT /courses/favorites/:kind/:id   (kind = single | multi, body: { favorite: true/false })
     ซื้อคอร์ส: /courses/checkout/... และ /courses/payments/...  (ดูด้านล่าง)
   ข้อมูลมาจาก MongoDB: SingleCourse + MultiCourse (+ Recipe, Client, Transaction, Favorite)
   =========================================================== */
const express = require('express');
const router = express.Router();

const catalog = require('../services/courseCatalog');
const pages = require('../services/userPages');
const { buildListPage } = require('../helpers/list-filters');
const countries = require('../services/recipeCountries');
const { asyncRoute, databaseReady, numericId } = require('../services/recipeSupport');
const { randomBytes } = require('node:crypto');
const payments = require('../services/coursePayments');
const gateway = require('../services/omiseGateway');
const { requireLogin } = require('../middleware/requireRole');
/* รายการคอร์ส */
router.get('/', databaseReady, asyncRoute(async (req, res) => {
  const [courses, favorites] = await Promise.all([
    catalog.loadCourses(),
    catalog.favoriteKeys(req.user && req.user._id),
  ]);
  const data = buildListPage(req, courses, { level: 'level', minutes: 'durMin', country: 'country' });

  res.render('user/courses', Object.assign(data, {
    title: 'คอร์สเรียน',
    active: 'courses',
    courses: data.list,
    sourceOptions: catalog.levelOptions.map(l => [l.value, l.label]),
    countryOptions: countries.countryOptions,
    countryLabel: countries.countryLabel,
    favoriteKeys: favorites,
    loggedIn: Boolean(req.user),
  }));
}));

/* ===================== ซื้อคอร์ส (แบบเดียวกับระบบซื้อสูตร) =====================
   GET  /courses/checkout/:kind/:id        ข้อมูลก่อนซื้อ  → { owned } | { gateway:'omise', ... } | { demo:true, ... }
   POST /courses/checkout/:kind/:id        ยืนยันซื้อจำลอง (ใช้เมื่อไม่มี Omise key และ RECIPE_DEMO_PAYMENTS=true)
   POST /courses/checkout/:kind/:id/qr     สร้าง QR PromptPay (Omise)
   GET  /courses/payments/:orderId         ตรวจสถานะการจ่ายเงิน
   ตอบเป็น JSON ทั้งหมด — หน้าเว็บเรียกจาก public/javascripts/coursePurchase.js */
const checkout = express.Router();
checkout.use(databaseReady);
checkout.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
checkout.use((req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนซื้อคอร์ส', login: true });
  next();
});

/** ตรวจ :kind/:id แล้วเก็บคอร์สไว้ใน req.course */
const loadCourse = asyncRoute(async (req, res, next) => {
  const id = numericId(req.params.id);
  const course = id && ['single', 'multi'].includes(req.params.kind) ? await payments.findCourse(req.params.kind, id) : null;
  if (!course) return res.status(404).json({ error: 'ไม่พบคอร์สนี้' });
  req.course = course;
  next();
});

const sameCsrf = req => req.session && req.session.coursePurchaseCsrf && req.get('X-CSRF-Token') === req.session.coursePurchaseCsrf;

checkout.get('/checkout/:kind/:id', loadCourse, asyncRoute(async (req, res) => {
  const { kind } = req.params, course = req.course, buyer = req.user._id;
  const url = payments.watchUrl(kind, course._id);
  const base = { kind, id: course._id, title: course.title, price: course.price, url };
  if ((await payments.access(buyer, kind, course)).canWatch) return res.json({ ...base, owned: true });

  req.session.coursePurchaseCsrf = req.session.coursePurchaseCsrf || randomBytes(32).toString('hex');
  const csrf = req.session.coursePurchaseCsrf;
  if (gateway.configured()) {
    const active = await payments.activeOrder(buyer, kind, course._id);
    return res.json({ ...base, gateway: 'omise', csrf, test: !gateway.config().livemode, activeOrder: active ? payments.view(active) : null });
  }
  if (payments.demoEnabled()) return res.json({ ...base, demo: true, csrf });
  res.status(503).json({ error: 'ยังไม่เปิดระบบซื้อคอร์ส' });
}));

checkout.post('/checkout/:kind/:id', loadCourse, asyncRoute(async (req, res) => {
  if (gateway.configured()) return res.status(409).json({ error: 'กรุณาใช้การชำระเงินผ่าน QR' });
  if (!payments.demoEnabled()) return res.status(503).json({ error: 'ยังไม่เปิดระบบซื้อคอร์ส' });
  if (!sameCsrf(req)) return res.status(403).json({ error: 'ฟอร์มหมดอายุ กรุณาเปิดใหม่' });
  const { kind } = req.params;
  if (!(await payments.access(req.user._id, kind, req.course)).canWatch) await payments.demoPurchase(req.user._id, kind, req.course);
  res.json({ purchased: true, demo: true, url: payments.watchUrl(kind, req.course._id) });
}));

checkout.post('/checkout/:kind/:id/qr', loadCourse, asyncRoute(async (req, res) => {
  if (!sameCsrf(req)) return res.status(403).json({ error: 'ฟอร์มหมดอายุ กรุณาเปิดใหม่' });
  gateway.config();
  const { kind } = req.params;
  if ((await payments.access(req.user._id, kind, req.course)).canWatch) return res.status(409).json({ error: 'คุณมีสิทธิ์เรียนคอร์สนี้แล้ว' });
  res.json(payments.view(await payments.createOrder(req.user._id, kind, req.course)));
}));

checkout.get('/payments/:orderId', asyncRoute(async (req, res) => {
  if (!/^[a-f0-9]{32}$/.test(req.params.orderId)) return res.status(400).json({ error: 'คำสั่งซื้อไม่ถูกต้อง' });
  const order = await payments.checkOrder(req.user._id, req.params.orderId);
  if (!order) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
  res.json(payments.view(order));
}));

// error ของการจ่ายเงิน → JSON (แบบเดียวกับ routes/promptpay.js)
checkout.use((error, req, res, next) => {
  res.status(error.status || 502).json({ error: error.status ? error.message : 'ตรวจสอบการจ่ายเงินไม่สำเร็จ กรุณาลองใหม่' });
});

router.use((req, res, next) => (/^\/(checkout|payments)\//.test(req.path) ? checkout(req, res, next) : next()));

/* รายละเอียดคอร์ส  GET /courses/:id (คอร์สเดี่ยว)  และ  GET /courses/pack/:id (แพ็กคอร์ส) */
async function showDetail(kind, req, res, next) {
  const id = numericId(req.params.id);
  if (!id) return next();
  const data = await pages.loadCourseDetail(kind, id, req.user && req.user._id);
  if (!data) return next();
  res.render('user/course-detail', Object.assign(data, { loggedIn: Boolean(req.user) }));
}
router.get('/pack/:id', requireLogin, databaseReady, asyncRoute((req, res, next) => showDetail('multi', req, res, next)));
router.get('/:id', requireLogin, databaseReady, asyncRoute((req, res, next) => showDetail('single', req, res, next)));
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
