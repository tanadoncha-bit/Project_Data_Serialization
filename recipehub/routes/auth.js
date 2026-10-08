// routes/auth.js — สมัครสมาชิก / เข้าสู่ระบบ / ออกจากระบบ
const express = require('express');
const bcrypt = require('bcryptjs');
const Client = require('../models/Client');

const router = express.Router();

/** query หา username แบบตรงตัวพิมพ์ (Preem กับ preem เป็นคนละชื่อ) */
const usernameQuery = (username) => ({ username });


/** เก็บ userId ลง session ใหม่ แล้วตอบหน้าที่ต้องไปต่อ (เชฟ → dashboard, ผู้เรียน → home) */
function startSession(req, res, next, user) {
  // สร้าง session ใหม่ทุกครั้ง กันการขโมย session เดิม
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = user._id;
    res.json({ redirect: user.role === 'chef' ? '/chef/dashboard' : '/home' });
  });
}

/** GET /login, /register → กลับหน้าแรกแล้วเปิด modal ให้เลย (ใช้กับลิงก์ธรรมดา) */
router.get('/login', (req, res) => res.redirect('/home?login=1'));
router.get('/register', (req, res) => res.redirect('/home?register=1'));

/** POST /register → ตรวจข้อมูลให้ครบ แล้วสร้าง Client ใหม่ (role chef ได้ทันทีถ้ากรอกสถาบัน) */
router.post('/register', async (req, res, next) => {
  try {
    const role = req.body.role === 'chef' ? 'chef' : 'user';
    const name = String(req.body.name || '').trim();
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || '');
    const institution = String(req.body.institution || '').trim();

    if (!name || !username || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' });
    }
    if (role === 'chef' && !institution) {
      return res.status(400).json({ error: 'กรุณาระบุสถาบันการทำอาหาร' });
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'username ต้องเป็น A-Z, a-z, 0-9 หรือ _ ยาว 3–20 ตัว' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' });
    }
    if (await Client.exists({ email })) {
      return res.status(409).json({ error: 'อีเมลนี้ถูกใช้สมัครแล้ว' });
    }
    if (await Client.exists(usernameQuery(username))) {
      return res.status(409).json({ error: 'username นี้ถูกใช้แล้ว' });
    }

    const user = await Client.create({
      name,
      username,
      email,
      role,
      passwordHash: await bcrypt.hash(password, 10),
      institution: role === 'chef' ? institution : null,
    });

    // สมัครเสร็จ login ให้เลย ไม่ต้องกรอกซ้ำ
    startSession(req, res, next, user);
  } catch (err) {
    // กดสมัครพร้อมกัน 2 ครั้ง unique index ของ email/username จะกันไว้ให้
    if (err.code === 11000) {
      const field = err.keyPattern && err.keyPattern.username ? 'username' : 'อีเมล';
      return res.status(409).json({ error: `${field}นี้ถูกใช้แล้ว` });
    }
    next(err);
  }
});

/** POST /login → รับ username หรืออีเมล + รหัสผ่าน ถ้าถูกเก็บ userId ไว้ใน session */
router.post('/login', async (req, res, next) => {
  try {
    const login = String(req.body.login || '').trim();
    const password = String(req.body.password || '');
    if (!login || !password) {
      return res.status(400).json({ error: 'กรุณากรอก username/อีเมล และรหัสผ่าน' });
    }

    // มี @ ถือว่าเป็นอีเมล ไม่มี @ ถือว่าเป็น username
    const query = login.includes('@') ? { email: login.toLowerCase() } : usernameQuery(login);
    const user = await Client.findOne(query);
    // ตอบข้อความเดียวกันทั้งกรณีไม่มีบัญชีและรหัสผิด จะได้เดาไม่ได้ว่าบัญชีไหนมีในระบบ
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'username/อีเมล หรือรหัสผ่านไม่ถูกต้อง' });
    }

    startSession(req, res, next, user);
  } catch (err) {
    next(err);
  }
});

/** GET /logout → ลบ session แล้วกลับหน้าแรก */
router.get('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('cookhub.sid');
    res.redirect('/home');
  });
});

router.usernameQuery = usernameQuery;
module.exports = router;
