var express = require('express');
var router = express.Router();

const SingleCourse = require('../models/SingleCourse');
const Recipe = require('../models/Recipe');

const mockCategories = [
    { name: 'อาหารไทย', count: 24, icon_url: 'https://cdn-icons-png.flaticon.com/512/3274/3274099.png' },
    { name: 'อาหารนานาชาติ', count: 18, icon_url: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png' },
    { name: 'เบเกอรี่ & ขนมหวาน', count: 12, icon_url: 'https://cdn-icons-png.flaticon.com/512/992/992747.png' },
    { name: 'อาหารเพื่อสุขภาพ', count: 9, icon_url: 'https://cdn-icons-png.flaticon.com/512/1206/1206583.png' }
];

router.get('/', async function(req, res, next) {
  try {
      const rawCourses = await SingleCourse.find().populate('baseRecipe').lean();

      // แปลงข้อมูลและต้องมีคำว่า return เสมอ
      const formattedCourses = rawCourses.map(course => {
          const totalMinutes = course.videos ? course.videos.reduce((sum, v) => sum + (v.duration || 0), 0) : 0;
          const hours = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;
          const durationText = hours > 0 ? `${hours} ชม. ${mins} นาที` : `${mins} นาที`;

          return {
              title: course.title || 'ไม่มีชื่อคอร์ส',
              category: course.baseRecipe?.category || 'ทั่วไป',
              cover_image_url: course.baseRecipe?.image || 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=600&q=80',
              rating: '5.0',
              lesson_count: course.videos ? course.videos.length : 0,
              duration_text: durationText,
              student_count: '0',
              description: course.detailedInstruction || ''
          };
      });

      res.render('homepage', { 
          courses: formattedCourses,
          categories: mockCategories
      });

  } catch (error) {
      console.error("Database Error:", error);
      next(error);
  }
});

module.exports = router;