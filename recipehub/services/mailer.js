
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const axios = require('axios');

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


const appUrl = () => (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');


function newToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}


const sentRecently = (user) => Boolean(user.mailSentAt && Date.now() - user.mailSentAt.getTime() < RESEND_GAP_MS);


async function sendLinkMail(to, subject, intro, buttonText, link) {
  const t = process.env.RESEND_API_KEY ? null : getTransporter();
  if (!t && !process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email provider is not configured');
    console.log(`[mailer] ยังไม่ได้ตั้ง MAIL_USER/MAIL_PASS → ${subject} (${to}): ${link}`);
    return;
  }
  const mail = {
    from: process.env.MAIL_FROM || `"CookHub" <${process.env.MAIL_USER}>`,
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
  };
  if (process.env.RESEND_API_KEY) {
    if (!process.env.MAIL_FROM) throw new Error('MAIL_FROM is required for Resend');
    try {
      await axios.post('https://api.resend.com/emails', { ...mail, to: [to] }, {
        headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY }, timeout: 15000,
      });
    } catch (_) { throw new Error('ส่งอีเมลไม่สำเร็จ กรุณาตรวจการตั้งค่าผู้ให้บริการอีเมล'); }
  } else { await t.sendMail(mail); }
}


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