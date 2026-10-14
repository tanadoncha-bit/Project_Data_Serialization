var express = require('express');
var router = express.Router();


router.get('/', function(req, res, next) {
  res.redirect(302, '/home');
});

module.exports = router;
