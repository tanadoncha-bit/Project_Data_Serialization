/* ===========================================================
   หน้าคอร์สเรียน  GET /courses?level=&sort=&page=&type=...
   =========================================================== */
var express = require('express');
var router = express.Router();

const { allCourses, courseLevels } = require('../data/mock-courses');
const { buildListPage } = require('../helpers/list-filters');

router.get('/', function (req, res) {
  // TODO(model): เปลี่ยน allCourses เป็นข้อมูลจาก Course.find()
  const data = buildListPage(req, allCourses, '/courses', { level: 'level', minutes: 'durMin' });

  res.render('user/courses', Object.assign(data, {
    courses: data.list,
    levels: courseLevels,
  }));
});

module.exports = router;
