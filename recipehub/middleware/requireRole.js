// middleware/requireRole.js — กันหน้าที่ต้อง login หรือต้องเป็นเชฟ
const createError = require('http-errors');

/** ต้อง login ก่อน: ถ้ายังไม่ login หน้า GET เด้งกลับหน้าแรกพร้อมเปิด modal login ส่วนอื่นตอบ 401 */
function requireLogin(req, res, next) {
  if (req.user) return next();
  if (req.method === 'GET') return res.redirect('/home?login=1');
  next(createError(401, 'กรุณาเข้าสู่ระบบก่อน'));
}

/** ต้องเป็นเชฟ: ยังไม่ login ใช้กฎเดียวกับ requireLogin, login แล้วแต่ไม่ใช่เชฟตอบ 403 */
function requireChef(req, res, next) {
  requireLogin(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role === 'chef') return next();
    next(createError(403, 'หน้านี้สำหรับเชฟเท่านั้น'));
  });
}

module.exports = { requireLogin, requireChef };
