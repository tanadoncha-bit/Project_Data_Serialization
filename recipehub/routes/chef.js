// routes/chef.js — เราต์ทั้งหมดของฝั่งเชฟ (ขึ้นต้นด้วย /chef)
const express = require('express');
const router = express.Router();

/** GET /chef → เด้งไปหน้า dashboard */
router.get('/', (req, res) => {
  res.redirect('/chef/dashboard');
});

/** GET /chef/dashboard → แสดงหน้า Dashboard ของเชฟ */
router.get('/dashboard', (req, res) => {
  res.render('chef/dashboard', { title: 'Dashboard', active: 'dashboard' });
});

/** GET /chef/courses → หน้าจัดการคอร์สของเชฟ */
router.get('/courses', (req, res) => {
  res.render('chef/courses', { title: 'จัดการคอร์ส', active: 'courses' });
});

/** GET /chef/recipes → หน้าจัดการสูตรอาหารของเชฟ */
router.get('/recipes', (req, res) => {
  res.render('chef/recipes', { title: 'จัดการสูตรอาหาร', active: 'recipes' });
});

/** GET /chef/profile → หน้าโปรไฟล์ของเชฟ */
router.get('/profile', (req, res) => {
  // TODO: เปลี่ยนเป็นข้อมูลจริงจากผู้ใช้ที่ login (req.user) เมื่อระบบ Auth เสร็จ
  const user = {
    name: 'Chef Example',
    email: 'chef@example.com',
    role: 'chef',
    bio: 'เชฟผู้หลงใหลในอาหารไทย',
  };

  res.render('chef/profile', { title: 'โปรไฟล์', active: '', user });
});

module.exports = router;