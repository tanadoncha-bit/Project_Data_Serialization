
module.exports = function chefPageBoundary(req, res, next) {
  if (req.user?.role !== 'chef' || !['GET','HEAD'].includes(req.method)) return next();
  const path = req.path;
  if (/^\/recipes\/[1-9]\d*$/.test(path)) {
    const suffix = req.query.saved === '1' ? '?saved=1' : '';
    return res.redirect(302, '/chef' + path + suffix);
  }
  if (path === '/' || /^\/home(?:\/|$)/.test(path) || /^\/user(?:\/|$)/.test(path)) return res.redirect(302, '/chef');
  if (/^\/courses(?:\/|$)/.test(path) || path === '/recipes' || /^\/recipes\/(external|inspiration)(?:\/|$)/.test(path)) return res.redirect(302, path.startsWith('/courses') ? '/chef/courses' : '/chef/recipes');
  next();
};
