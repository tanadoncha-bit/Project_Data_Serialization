// middleware/errorHandler.js — จัดการ error ทั้งเว็บที่เดียว
const createError = require('http-errors');

const DB_DOWN = /^(MongoNetworkError|MongoServerSelectionError|MongooseServerSelectionError|MongoNotConnectedError)$/;

/** แปลง error ทุกชนิดให้มี status กับข้อความภาษาไทยที่ผู้ใช้อ่านเข้าใจ */
function toHttpError(err) {
  if (err.status && err.status < 500) return err;

  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors)[0];
    return createError(400, first ? first.message : 'ข้อมูลไม่ถูกต้อง');
  }
  if (err.name === 'CastError') return createError(400, 'ข้อมูลไม่ถูกต้อง');
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    const label = { username: 'username', email: 'อีเมล' }[field] || 'ข้อมูล';
    return createError(409, `${label}นี้ถูกใช้แล้ว`);
  }
  if (err.name === 'MulterError') {
    return createError(400, err.code === 'LIMIT_FILE_SIZE' ? 'รูปต้องไม่เกิน 2MB' : 'อัปโหลดไฟล์ไม่สำเร็จ');
  }
  if (DB_DOWN.test(err.name) || /buffering timed out/.test(err.message)) {
    return createError(503, 'ฐานข้อมูลไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง');
  }
  if (err.status === 503) return err;
  return createError(500, 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง');
}

/** request ที่ส่งมาจาก fetch (ขอ JSON) ให้ตอบเป็น JSON แทนหน้า error */
function wantsJson(req) {
  return req.is('application/json') || req.accepts(['html', 'json']) === 'json';
}

/** ไม่มี route ไหนรับ → 404 */
function notFound(req, res, next) {
  next(createError(404, 'ไม่พบหน้าที่คุณต้องการ'));
}

/** ตัวจัดการ error ตัวสุดท้าย: log error ฝั่ง server แล้วตอบ JSON หรือหน้า error ตามชนิด request */
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const httpErr = toHttpError(err);
  if (httpErr.status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}`, err);

  res.status(httpErr.status);
  if (wantsJson(req)) return res.json({ error: httpErr.message });

  res.render('error', {
    title: 'เกิดข้อผิดพลาด',
    message: httpErr.message,
    status: httpErr.status,
    stack: req.app.get('env') === 'development' && httpErr.status >= 500 ? err.stack : null,
  });
}

module.exports = { notFound, errorHandler, toHttpError };
