// services/mailer.js — ส่งเมลยืนยันอีเมล / ลิงก์ตั้งรหัสผ่านใหม่ ผ่าน Gmail (MAIL_USER, MAIL_PASS ใน .env)
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const VERIFY_MS = 24 * 60 * 60 * 1000;
const RESET_MS = 30 * 60 * 1000;
const RESEND_GAP_MS = 60 * 1000;

let transporter = null;

function getTransporter() {
  const { MAIL_USER, MAIL_PASS } = process.env;
  if (!MAIL_USER || !MAIL_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: MAIL_USER, pass: MAIL_PASS.replace(/\s/g, '') },
    });
  }
  return transporter;
}

// ลิงก์ในเมลต้องใช้ APP_URL ห้ามใช้ Host จาก request ไม่งั้นคนอื่นปลอม Host ให้ลิงก์ชี้ไปเว็บตัวเองได้
const appUrl = () => (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/** สร้าง token สุ่มสำหรับใส่ในลิงก์ ใน DB เก็บแค่ hash */
function newToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

/** กันกดส่งเมลรัวๆ ส่งได้ 1 ครั้งต่อนาทีต่อบัญชี */
const sentRecently = (user) => Boolean(user.mailSentAt && Date.now() - user.mailSentAt.getTime() < RESEND_GAP_MS);

/** ส่งเมลที่มีปุ่มลิงก์ ถ้ายังไม่ได้ตั้ง MAIL_USER/MAIL_PASS จะพิมพ์ลิงก์ใน Terminal แทน */
async function sendLinkMail(to, subject, intro, buttonText, link) {
  const t = getTransporter();
  if (!t) {
    console.log(`[mailer] ยังไม่ได้ตั้ง MAIL_USER/MAIL_PASS → ${subject} (${to}): ${link}`);
    return;
  }
  await t.sendMail({
    from: `"CookHub" <${process.env.MAIL_USER}>`,
    to,
    subject,
    text: `${intro}\n\n${link}\n\nถ้าคุณไม่ได้ทำรายการนี้ ไม่ต้องทำอะไร`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">
      <h2 style="color:#F26B2A;margin:0 0 12px">CookHub</h2>
      <p>${escapeHtml(intro)}</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#F26B2A;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none">${buttonText}</a></p>
      <p style="font-size:12px;color:#777">ถ้าปุ่มกดไม่ได้ ก๊อปลิงก์นี้ไปเปิด: <br>${link}</p>
      <p style="font-size:12px;color:#777">ถ้าคุณไม่ได้ทำรายการนี้ ไม่ต้องทำอะไร</p>
    </div>`,
  });
}

/** ส่งลิงก์ยืนยันอีเมล ไปที่อีเมลใหม่ที่รอยืนยัน (ถ้ามี) หรืออีเมลปัจจุบัน */
async function sendVerifyMail(user) {
  const { token, hash } = newToken();
  user.verifyToken = hash;
  user.verifyExpires = new Date(Date.now() + VERIFY_MS);
  user.mailSentAt = new Date();
  await user.save();
  await sendLinkMail(user.pendingEmail || user.email, 'ยืนยันอีเมลของคุณ - CookHub',
    `สวัสดีคุณ ${user.name} กดปุ่มด้านล่างเพื่อยืนยันอีเมล ลิงก์ใช้ได้ 24 ชั่วโมง`,
    'ยืนยันอีเมล', `${appUrl()}/verify-email/${token}`);
}

/** ส่งลิงก์ตั้งรหัสผ่านใหม่ */
async function sendResetMail(user) {
  const { token, hash } = newToken();
  user.resetToken = hash;
  user.resetExpires = new Date(Date.now() + RESET_MS);
  user.mailSentAt = new Date();
  await user.save();
  await sendLinkMail(user.email, 'ตั้งรหัสผ่านใหม่ - CookHub',
    `สวัสดีคุณ ${user.name} กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์ใช้ได้ 30 นาทีและใช้ได้ครั้งเดียว`,
    'ตั้งรหัสผ่านใหม่', `${appUrl()}/reset-password/${token}`);
}

module.exports = { hashToken, sentRecently, sendVerifyMail, sendResetMail };