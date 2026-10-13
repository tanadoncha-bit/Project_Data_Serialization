// routes/chef.js — เราต์ทั้งหมดของฝั่งเชฟ (ขึ้นต้นด้วย /chef)
// ทุกเราต์ผ่าน requireChef ใน app.js แล้ว จึงมี req.user เป็นเชฟที่ login อยู่เสมอ
const express = require('express');
const createError = require('http-errors');
const Client = require('../models/Client');
const SingleCourse = require('../models/SingleCourse');
const MultiCourse = require('../models/MultiCourse');
const Transaction = require('../models/Transaction');
const support = require('../services/chefSupport');

const router = express.Router();
const { asyncRoute } = support;

// ไม่ให้เบราว์เซอร์ cache หน้าเชฟ (ข้อมูลส่วนตัว/ยอดขาย) + ตรวจ CSRF ทุกฟอร์ม
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.use(support.csrf);

/** GET /chef  เด้งไปหน้า dashboard */
router.get('/', (req, res) => {
  res.redirect('/chef/dashboard');
});

/** GET /chef/dashboard  แสดงหน้า Dashboard ของเชฟ */
router.use('/dashboard', require('./dashboard'));
/* =========================================================
   จัดการคอร์ส
   ========================================================= */

/** GET /chef/courses → รายการคอร์สเดี่ยว + แพ็กเกจของเชฟ (ข้อมูลส่งให้ modal ผ่าน JSON ในหน้า) */
router.get('/courses', asyncRoute(async (req, res) => {
  const [courses, recipes, chef] = await Promise.all([
    support.loadCourses(req.user._id),
    support.loadRecipeOptions(req.user._id),
    Client.findById(req.user._id).select('name institution avatar').lean(),
  ]);
  const errorText = {
    'has-students': 'ลบไม่ได้ เพราะคอร์สนี้มีผู้ซื้อแล้ว (ผู้เรียนจะเข้าเรียนไม่ได้)',
    'in-package': 'ลบไม่ได้ เพราะคอร์สนี้อยู่ในแพ็กเกจ ให้เอาออกจากแพ็กเกจหรือลบแพ็กเกจก่อน',
  };
  res.render('chef/courses', {
    title: 'จัดการคอร์ส', active: 'courses', courses, recipes, chef,
    difficulties: support.difficulties,
    pageData: support.safeJson({ courses, recipes, chef, csrfToken: res.locals.csrfToken }),
    notice: { saved: 'บันทึกคอร์สเรียบร้อยแล้ว', deleted: 'ลบคอร์สเรียบร้อยแล้ว' }[req.query.status] || '',
    error: errorText[req.query.error] || '',
  });
}));

/** POST /chef/courses → สร้างคอร์สใหม่ (รับ JSON จาก modal) ตอบ { location } หรือ 422 { errors } */
router.post('/courses', asyncRoute(async (req, res) => {
  const { type, data, errors } = await support.parseCourse(req.body, req.user._id);
  if (errors.length) return res.status(422).json({ errors });
  if (type === 'single') {
    const course = new SingleCourse({ publisher: req.user._id });
    support.applySingle(course, data);
    await support.saveNew(course, 'singleCourse');
  } else {
    await support.saveNew(new MultiCourse({ ...data, publisher: req.user._id }), 'multiCourse');
  }
  res.status(201).json({ location: '/chef/courses?status=saved' });
}));

/** โหลดคอร์สจาก :type/:id และเช็คว่าเป็นของเชฟคนนี้จริง ก่อนแก้ไข/ลบ */
const findOwnCourse = asyncRoute(async (req, res, next) => {
  const Model = { single: SingleCourse, package: MultiCourse }[req.params.type];
  const id = Number(req.params.id);
  if (!Model || !Number.isSafeInteger(id) || id < 1) throw createError(404, 'ไม่พบคอร์ส');
  const course = await Model.findOne({ _id: id, publisher: req.user._id });
  if (!course) throw createError(404, 'ไม่พบคอร์ส');
  req.course = course;
  next();
});

/** POST /chef/courses/:type/:id → บันทึกการแก้ไข (ประเภทคอร์สเปลี่ยนไม่ได้) */
router.post('/courses/:type/:id', findOwnCourse, asyncRoute(async (req, res) => {
  const { type, data, errors } = await support.parseCourse({ ...req.body, type: req.params.type }, req.user._id);
  if (errors.length) return res.status(422).json({ errors });
  if (type === 'single') support.applySingle(req.course, data);
  else Object.assign(req.course, data);
  await req.course.save();
  res.json({ location: '/chef/courses?status=saved' });
}));

/** POST /chef/courses/:type/:id/delete → ลบคอร์ส (กันไว้ถ้ามีคนซื้อแล้ว หรือคอร์สเดี่ยวอยู่ในแพ็กเกจ) */
router.post('/courses/:type/:id/delete', findOwnCourse, asyncRoute(async (req, res) => {
  const itemType = req.params.type === 'single' ? 'SingleCourse' : 'MultiCourse';
  if (await Transaction.exists({ itemType, itemId: req.course._id })) {
    return res.redirect(303, '/chef/courses?error=has-students');
  }
  // แพ็กเกจต้องมีคอร์สข้างในเสมอ (validate ของ MultiCourse) จึงห้ามลบคอร์สเดี่ยวที่ยังอยู่ในแพ็ก
  if (itemType === 'SingleCourse' && await MultiCourse.exists({ includedCourses: req.course._id })) {
    return res.redirect(303, '/chef/courses?error=in-package');
  }
  await req.course.deleteOne();
  res.redirect(303, '/chef/courses?status=deleted');
}));

/** GET /chef/profile → ใช้หน้า /profile ร่วมกับผู้เรียน (routes/profile.js) */
router.get('/profile', (req, res) => res.redirect('/profile'));

module.exports = router;
