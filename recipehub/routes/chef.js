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

// ข้อมูลเชฟตัวอย่าง ใช้แทนฐานข้อมูลไปก่อน
// TODO: เปลี่ยนเป็นข้อมูลจาก MongoDB ของผู้ใช้ที่ login (req.user) เมื่อระบบ Auth เสร็จ
let mockChef = {
  firstName: 'ปวริศา',
  lastName: 'สีดาชมภู',
  email: 'pawarisa2548@gmail.com',
  institution: 'Le Cordon Bleu Dusit',
  bio: '',
  avatar: '', // path รูปโปรไฟล์ ว่าง = ยังไม่มีรูป
};

/** GET /chef/profile → แสดงหน้าโปรไฟล์ พร้อมข้อความแจ้งเมื่อบันทึกสำเร็จ */
router.get('/profile', (req, res) => {
  res.render('chef/profile', {
    title: 'โปรไฟล์',
    active: '',
    user: mockChef,
    saved: req.query.saved === '1',
  });
});

/** POST /chef/profile → รับข้อมูลจากฟอร์มแก้ไขโปรไฟล์ แล้วกลับไปหน้าโปรไฟล์ */
router.post('/profile', (req, res) => {
  const { firstName, lastName, email, institution, bio } = req.body;

  mockChef = {
    ...mockChef,
    firstName: (firstName || '').trim(),
    lastName: (lastName || '').trim(),
    email: (email || '').trim(),
    institution: (institution || '').trim(),
    bio: (bio || '').trim().slice(0, 300), // กันไม่ให้เกิน 300 ตัวอักษร
  };

  // redirect กลับแทนการ render ตรงๆ กันฟอร์มถูกส่งซ้ำตอนกดรีเฟรช
  res.redirect('/chef/profile?saved=1');
});

module.exports = router;