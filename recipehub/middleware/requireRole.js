
const createError = require('http-errors');


function requireLogin(req, res, next) {
  if (req.user) return next();
  if (req.method === 'GET') return res.redirect('/home?login=1');
  next(createError(401, 'กรุณาเข้าสู่ระบบก่อน'));
}


function requireChef(req, res, next) {
  requireLogin(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role === 'chef') return next();
    next(createError(403, 'หน้านี้สำหรับเชฟเท่านั้น'));
  });
}

module.exports = { requireLogin, requireChef };
