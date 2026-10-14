
const express = require('express');
const bcrypt = require('bcryptjs');
const Client = require('../models/Client');
const mailer = require('../services/mailer');

const router = express.Router();


const usernameQuery = (username) => ({ username });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENT_MESSAGE = 'ถ้าไม่เจอเมล ลองดูในโฟลเดอร์ Spam';


function renderLinkPage(res, status, data) {
  res.status(status).render('email-link', { title: 'CookHub', form: false, error: null, detail: '', ...data });
}


function sendInBackground(promise) {
  promise.catch((err) => console.error('[mailer] ส่งเมลไม่สำเร็จ:', err.message));
}


function startSession(req, res, next, user) {

  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = user._id;
    res.json({ redirect: user.role === 'chef' ? '/chef/dashboard' : '/user' });
  });
}


router.get('/login', (req, res) => res.redirect('/home?login=1'));
router.get('/register', (req, res) => res.redirect('/home?register=1'));


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
    if (!EMAIL_RE.test(email)) {
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
      isVerifiedChef: role === 'chef' && Boolean(institution),
    });


    try {
      await mailer.sendVerifyMail(user);
    } catch (err) {
      console.error('[mailer] ส่งเมลยืนยันไม่สำเร็จ:', err.message);
      return res.status(502).json({ error: 'สมัครสำเร็จ แต่ส่งเมลยืนยันไม่สำเร็จ กรุณาเข้าสู่ระบบแล้วกดส่งลิงก์ยืนยันอีกครั้ง' });
    }
    res.json({ message: `สมัครสำเร็จ! เราส่งลิงก์ยืนยันไปที่ ${email} แล้ว กรุณากดยืนยันก่อนเข้าสู่ระบบ (${SENT_MESSAGE})` });
  } catch (err) {

    if (err.code === 11000) {
      const field = err.keyPattern && err.keyPattern.username ? 'username' : 'อีเมล';
      return res.status(409).json({ error: `${field}นี้ถูกใช้แล้ว` });
    }
    next(err);
  }
});


router.post('/login', async (req, res, next) => {
  try {
    const login = String(req.body.login || '').trim();
    const password = String(req.body.password || '');
    if (!login || !password) {
      return res.status(400).json({ error: 'กรุณากรอก username/อีเมล และรหัสผ่าน' });
    }


    const query = login.includes('@') ? { email: login.toLowerCase() } : usernameQuery(login);
    const user = await Client.findOne(query);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'username/อีเมล หรือรหัสผ่านไม่ถูกต้อง' });
    }
    if (!user.emailVerified) {
      return res.status(403).json({ error: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ', resendEmail: user.email });
    }

    startSession(req, res, next, user);
  } catch (err) {
    next(err);
  }
});


router.post('/verify-email/resend', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = EMAIL_RE.test(email) ? await Client.findOne({ email }) : null;
    if (user && !user.emailVerified && !mailer.sentRecently(user)) sendInBackground(mailer.sendVerifyMail(user));
    res.json({ message: `ถ้าอีเมลนี้ยังไม่ได้ยืนยัน เราส่งลิงก์ยืนยันไปให้แล้ว (${SENT_MESSAGE})` });
  } catch (err) {
    next(err);
  }
});


router.get('/verify-email/:token', async (req, res, next) => {
  try {
    const user = await Client.findOne({ verifyToken: mailer.hashToken(req.params.token), verifyExpires: { $gt: new Date() } });
    if (!user) {
      return renderLinkPage(res, 400, { message: 'ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุแล้ว', detail: 'เข้าสู่ระบบแล้วกด "ส่งลิงก์ยืนยันอีกครั้ง" เพื่อรับลิงก์ใหม่' });
    }
    if (user.pendingEmail) {
      if (await Client.exists({ _id: { $ne: user._id }, email: user.pendingEmail })) {
        user.pendingEmail = null;
        await user.save();
        return renderLinkPage(res, 409, { message: 'อีเมลนี้ถูกบัญชีอื่นใช้ไปแล้ว', detail: 'อีเมลของบัญชีคุณยังเป็นอีเมลเดิม' });
      }
      user.email = user.pendingEmail;
      user.pendingEmail = null;
    }
    user.emailVerified = true;
    user.verifyToken = null;
    user.verifyExpires = null;
    await user.save();

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user._id;
      res.redirect(user.role === 'chef' ? '/chef/dashboard' : '/user');
    });
  } catch (err) {
    next(err);
  }
});


router.post('/forgot-password', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'กรุณากรอกอีเมลให้ถูกต้อง' });
    const user = await Client.findOne({ email });
    if (user && !mailer.sentRecently(user)) sendInBackground(mailer.sendResetMail(user));
    res.json({ message: `ถ้ามีบัญชีที่ใช้อีเมลนี้ เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว ลิงก์ใช้ได้ 30 นาที (${SENT_MESSAGE})` });
  } catch (err) {
    next(err);
  }
});

const findByResetToken = (token) =>
  Client.findOne({ resetToken: mailer.hashToken(token), resetExpires: { $gt: new Date() } });

const RESET_INVALID = { message: 'ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว', detail: 'กด "ลืมรหัสผ่าน?" ในหน้าเข้าสู่ระบบเพื่อขอลิงก์ใหม่' };


router.get('/reset-password/:token', async (req, res, next) => {
  try {
    if (!(await findByResetToken(req.params.token))) return renderLinkPage(res, 400, RESET_INVALID);
    renderLinkPage(res, 200, { form: true, message: 'ตั้งรหัสผ่านใหม่' });
  } catch (err) {
    next(err);
  }
});


router.post('/reset-password/:token', async (req, res, next) => {
  try {
    const user = await findByResetToken(req.params.token);
    if (!user) return renderLinkPage(res, 400, RESET_INVALID);

    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || '');
    let error = null;
    if (password.length < 6) error = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    else if (password !== confirmPassword) error = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
    if (error) return renderLinkPage(res, 400, { form: true, message: 'ตั้งรหัสผ่านใหม่', error });

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = null;
    user.resetExpires = null;
    user.emailVerified = true;                                               
    await user.save();
    renderLinkPage(res, 200, { message: 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว', detail: 'เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย', loginLink: true });
  } catch (err) {
    next(err);
  }
});


router.get('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('cookhub.sid');
    res.redirect('/home');
  });
});

router.usernameQuery = usernameQuery;
module.exports = router;