const express = require('express');
const {requireChef} = require('../middleware/requireRole');
const {loadDashboard} = require('../services/chefDashboard');
const router = express.Router();
router.get('/', requireChef, async (req,res,next) => {
  try {
    const dashboard = await loadDashboard(req.user._id);
    res.render('chef/dashboard', {title:'Dashboard',active:'dashboard',...dashboard});
  } catch(error) { next(error); }
});
module.exports = router;
