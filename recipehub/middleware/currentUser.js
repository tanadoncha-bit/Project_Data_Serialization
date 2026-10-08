// middleware/currentUser.js — โหลดผู้ใช้ที่ login อยู่ ให้ทุกหน้าใช้ผ่าน currentUser
const mongoose = require('mongoose');
const Client = require('../models/Client');

module.exports = async function currentUser(req, res, next) {
  res.locals.currentUser = null;
  const id = req.session && req.session.userId;
  if (!id || mongoose.connection.readyState !== 1) return next();
  try {
    const user = await Client.findById(id).select('name email role avatar');
    req.user = user;
    res.locals.currentUser = user;
  } catch (err) {
    console.error('[currentUser] โหลดผู้ใช้ไม่สำเร็จ:', err.message);
  }
  next();
};
