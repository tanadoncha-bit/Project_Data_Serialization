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

/** GET /chef → เด้งไปหน้า dashboard */
router.get('/', (req, res) => {
  res.redirect('/chef/dashboard');
});

/* =========================================================
   DASHBOARD
   ========================================================= */

/** GET /chef/dashboard → สรุปคอร์ส สูตร ผู้เรียน รายได้ และคำสั่งซื้อล่าสุดของเชฟคนนี้ */
router.get('/dashboard', asyncRoute(async (req, res) => {
  const chef = await Client.findById(req.user._id).lean();
  const range = req.query.range === '30' ? 30 : 7;
  const allOrders = req.query.orders === 'all';
  const data = await support.dashboardData(chef, { range, allOrders });
  res.render('chef/dashboard', { title: 'Dashboard', active: 'dashboard', chef, allOrders, ...data });
}));

/* =========================================================
   จัดการคอร์ส
   ========================================================= */

/** GET /chef/courses → รายการคอร์สเดี่ยว + แพ็กเกจของเชฟ (ข้อมูลส่งให้ modal ผ่าน JSON ในหน้า) */
router.get('/courses', asyncRoute(async (req, res) => {
  const [courses, chef] = await Promise.all([
    support.loadCourses(req.user._id),
    Client.findById(req.user._id).select('name institution avatarUrl').lean(),
  ]);
  res.render('chef/courses', {
    title: 'จัดการคอร์ส', active: 'courses', courses, chef,
    categories: support.categories, difficulties: support.difficulties,
    pageData: support.safeJson({ courses, chef, csrfToken: res.locals.csrfToken }),
    notice: { saved: 'บันทึกคอร์สเรียบร้อยแล้ว', deleted: 'ลบคอร์สเรียบร้อยแล้ว' }[req.query.status] || '',
    error: req.query.error === 'has-students' ? 'ลบไม่ได้ เพราะคอร์สนี้มีผู้ซื้อแล้ว (ผู้เรียนจะเข้าเรียนไม่ได้)' : '',
  });
}));

/** POST /chef/courses → สร้างคอร์สใหม่ (รับ JSON จาก modal) ตอบ { location } หรือ 422 { errors } */
router.post('/courses', asyncRoute(async (req, res) => {
  const { type, data, errors } = support.parseCourse(req.body);
  if (errors.length) return res.status(422).json({ errors });
  if (type === 'single') {
    const course = new SingleCourse({ publisher: req.user._id });
    support.applySingle(course, data);
    await course.save();
  } else {
    await MultiCourse.create({ ...data, publisher: req.user._id });
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
  const { type, data, errors } = support.parseCourse({ ...req.body, type: req.params.type });
  if (errors.length) return res.status(422).json({ errors });
  if (type === 'single') support.applySingle(req.course, data);
  else Object.assign(req.course, data);
  await req.course.save();
  res.json({ location: '/chef/courses?status=saved' });
}));

/** POST /chef/courses/:type/:id/delete → ลบคอร์ส (กันไว้ถ้ามีคนซื้อแล้ว) */
router.post('/courses/:type/:id/delete', findOwnCourse, asyncRoute(async (req, res) => {
  const itemType = req.params.type === 'single' ? 'SingleCourse' : 'MultiCourse';
  if (await Transaction.exists({ itemType, itemId: req.course._id })) {
    return res.redirect(303, '/chef/courses?error=has-students');
  }
  await req.course.deleteOne();
  // ถ้าลบคอร์สเดี่ยว เอาออกจากแพ็กเกจแบบเดิมที่อ้างถึงด้วย
  if (itemType === 'SingleCourse') {
    await MultiCourse.updateMany({ publisher: req.user._id }, { $pull: { includedCourses: req.course._id } });
  }
  res.redirect(303, '/chef/courses?status=deleted');
}));

/* =========================================================
   โปรไฟล์
   ========================================================= */

/** แปลง Client ใน DB เป็นค่าที่ฟอร์มโปรไฟล์ใช้ */
function profileView(client) {
  return {
    ...support.splitName(client.name),
    name: client.name, email: client.email, institution: client.institution || '',
    bio: client.bio || '', avatar: client.avatarUrl || '', isVerifiedChef: !!client.isVerifiedChef,
  };
}

/** GET /chef/profile → แสดงข้อมูลของเชฟที่ login อยู่จาก MongoDB */
router.get('/profile', asyncRoute(async (req, res) => {
  const client = await Client.findById(req.user._id).lean();
  res.render('chef/profile', {
    title: 'โปรไฟล์', active: '', user: profileView(client), form: profileView(client),
    saved: req.query.saved === '1', errors: [],
  });
}));

/** POST /chef/profile → ตรวจข้อมูล แล้วอัปเดต Client ใน MongoDB */
router.post('/profile', asyncRoute(async (req, res) => {
  const { values, update, errors } = support.parseProfile(req.body);
  const client = await Client.findById(req.user._id).lean();

  if (!errors.length && update.email !== client.email &&
      await Client.exists({ email: update.email, _id: { $ne: client._id } })) {
    errors.push('อีเมลนี้มีผู้ใช้อื่นใช้แล้ว');
  }
  if (errors.length) {
    // แสดงค่าที่เพิ่งกรอกกลับไปในฟอร์ม ไม่ให้ผู้ใช้ต้องพิมพ์ใหม่
    return res.status(422).render('chef/profile', {
      title: 'โปรไฟล์', active: '', user: profileView(client),
      form: { ...profileView(client), ...values }, saved: false, errors,
    });
  }

  try {
    await Client.updateOne({ _id: client._id }, { $set: update }, { runValidators: true });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(422).render('chef/profile', {
        title: 'โปรไฟล์', active: '', user: profileView(client),
        form: { ...profileView(client), ...values }, saved: false, errors: ['อีเมลนี้มีผู้ใช้อื่นใช้แล้ว'],
      });
    }
    throw err;
  }
  // redirect กลับแทนการ render ตรงๆ กันฟอร์มถูกส่งซ้ำตอนกดรีเฟรช
  res.redirect(303, '/chef/profile?saved=1');
}));

module.exports = router;
