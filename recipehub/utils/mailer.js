// utils/mailer.js — ส่งอีเมลผ่าน Gmail
const nodemailer = require('nodemailer');

const transporter = process.env.EMAIL_USER
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    })
  : null;

/** ส่งอีเมล ถ้ายังไม่ได้ตั้ง EMAIL_USER ใน .env จะพิมพ์เนื้อหาออก console แทน (ไว้ทดสอบ) */
async function sendMail({ to, subject, html, text }) {
  if (!transporter) {
    console.log(`\n[mail] ยังไม่ได้ตั้ง EMAIL_USER — ไม่ได้ส่งจริง\nถึง: ${to}\n${text}\n`);
    return;
  }
  await transporter.sendMail({ from: `CookHub <${process.env.EMAIL_USER}>`, to, subject, html, text });
}

module.exports = { sendMail };
