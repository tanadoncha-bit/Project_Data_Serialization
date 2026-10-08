const express = require('express');
const router = express.Router();

/** GET /chef  เด้งไปหน้า dashboard */
router.get('/', (req, res) => {
  res.redirect('/chef/dashboard');
});

/** GET /chef/dashboard  แสดงหน้า Dashboard ของเชฟ */
router.get('/dashboard', (req, res) => {
  res.render('chef/dashboard', { title: 'Dashboard', active: 'dashboard' });
});

/** GET /chef/courses  หน้าจัดการคอร์สของเชฟ */
router.get('/courses', (req, res) => {
  res.render('chef/courses', { title: 'จัดการคอร์ส', active: 'courses' });
});

/** GET /chef/profile  ย้ายไปใช้หน้า /profile ร่วมกับผู้เรียนแล้ว */
router.get('/profile', (req, res) => res.redirect('/profile'));

module.exports = router;
