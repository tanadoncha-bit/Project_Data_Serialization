

const express = require('express');
const createError = require('http-errors');
const Client = require('../models/Client');
const SingleCourse = require('../models/SingleCourse');
const MultiCourse = require('../models/MultiCourse');
const Transaction = require('../models/Transaction');
const support = require('../services/chefSupport');

const router = express.Router();
const { asyncRoute } = support;


router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.use(support.csrf);


router.get('/', (req, res) => {
  res.redirect('/chef/dashboard');
});


router.use('/dashboard', require('./dashboard'));


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
    listingType: req.query.type === 'package' ? 'package' : 'single',
    pageData: support.safeJson({ courses, recipes, chef, csrfToken: res.locals.csrfToken }),
    notice: { saved: 'บันทึกคอร์สเรียบร้อยแล้ว', deleted: 'ลบคอร์สเรียบร้อยแล้ว' }[req.query.status] || '',
    error: errorText[req.query.error] || '',
  });
}));

async function renderCoursePage(req, res, mode, type, id) {
  if (!['single', 'package'].includes(type)) throw createError(404, 'ไม่พบคอร์ส');
  const [courses, recipes, chef] = await Promise.all([support.loadCourses(req.user._id), support.loadRecipeOptions(req.user._id), Client.findById(req.user._id).select('name institution avatar').lean()]);
  const selected = mode === 'create' ? null : courses.find(c => c.type === type && c.id === Number(id));
  if (mode !== 'create' && !selected) throw createError(404, 'ไม่พบคอร์สของคุณ');
  const pageMode = { mode, type, id: selected?.id || null };
  res.render('chef/courses', { title: mode === 'create' ? 'สร้างคอร์ส' : mode === 'edit' ? 'แก้ไขคอร์ส' : 'รายละเอียดคอร์ส', active: 'courses', courses, recipes, chef, notice: '', error: '', pageMode, pageData: support.safeJson({ courses, recipes, chef, csrfToken: res.locals.csrfToken, pageMode }) });
}
router.get('/courses/:type/create', asyncRoute((req, res) => renderCoursePage(req, res, 'create', req.params.type)));
router.get('/courses/create', asyncRoute((req, res) => renderCoursePage(req, res, 'create', req.query.type || 'single')));
router.get('/courses/:type/:id/edit', asyncRoute((req, res) => renderCoursePage(req, res, 'edit', req.params.type, req.params.id)));
router.get('/courses/:type/:id', asyncRoute((req, res) => renderCoursePage(req, res, 'show', req.params.type, req.params.id)));


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
  res.status(201).json({ location: '/chef/courses?type=' + type + '&status=saved' });
}));


const findOwnCourse = asyncRoute(async (req, res, next) => {
  const Model = { single: SingleCourse, package: MultiCourse }[req.params.type];
  const id = Number(req.params.id);
  if (!Model || !Number.isSafeInteger(id) || id < 1) throw createError(404, 'ไม่พบคอร์ส');
  const course = await Model.findOne({ _id: id, publisher: req.user._id });
  if (!course) throw createError(404, 'ไม่พบคอร์ส');
  req.course = course;
  next();
});


router.post('/courses/:type/:id', findOwnCourse, asyncRoute(async (req, res) => {
  const { type, data, errors } = await support.parseCourse({ ...req.body, type: req.params.type }, req.user._id);
  if (errors.length) return res.status(422).json({ errors });
  if (type === 'single') support.applySingle(req.course, data);
  else Object.assign(req.course, data);
  await req.course.save();
  res.json({ location: '/chef/courses?type=' + type + '&status=saved' });
}));


router.post('/courses/:type/:id/delete', findOwnCourse, asyncRoute(async (req, res) => {
  const itemType = req.params.type === 'single' ? 'SingleCourse' : 'MultiCourse';
  if (await Transaction.exists({ itemType, itemId: req.course._id })) {
    return res.redirect(303, '/chef/courses?error=has-students');
  }

  if (itemType === 'SingleCourse' && await MultiCourse.exists({ includedCourses: req.course._id })) {
    return res.redirect(303, '/chef/courses?error=in-package');
  }
  await req.course.deleteOne();
  res.redirect(303, '/chef/courses?type=' + req.params.type + '&status=deleted');
}));


router.get('/profile', (req, res) => res.redirect('/profile'));

module.exports = router;
