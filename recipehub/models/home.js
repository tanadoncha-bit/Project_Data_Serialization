var express = require('express');
var router = express.Router();

// 1. นำเข้า Model
const SingleCourse = require('../models/SingleCourse');
// นำเข้า Recipe หากต้องการให้ Mongoose รู้จักความเชื่อมโยงของ ref: 'Recipe'
require('../models/Recipe'); 

const mockCategories = [
    { name: 'อาหารไทย', count: 24, icon_url: 'https://cdn-icons-png.flaticon.com/512/3274/3274099.png' },
    { name: 'อาหารนานาชาติ', count: 18, icon_url: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png' },
    { name: 'เบเกอรี่ & ขนมหวาน', count: 12, icon_url: 'https://cdn-icons-png.flaticon.com/512/992/992747.png' },
    { name: 'อาหารเพื่อสุขภาพ', count: 9, icon_url: 'https://cdn-icons-png.flaticon.com/512/1206/1206583.png' },
    { name: 'เทคนิคการทำอาหาร', count: 15, icon_url: 'https://cdn-icons-png.flaticon.com/512/1833/1833182.png' },
    { name: 'ธุรกิจอาหาร', count: 8, icon_url: 'https://cdn-icons-png.flaticon.com/512/3448/3448057.png' }
];

/* GET home page. */
router.get('/', async function(req, res, next) {
  try {
      // 2. ดึงข้อมูลจาก SingleCourse พร้อมดึงข้อมูลจาก Recipe ผ่าน populate
      const rawCourses = await SingleCourse.find()
          .populate('baseRecipe')
          .lean();

      // 3. แปลงข้อมูล (Map) ให้มีฟิลด์ตรงกับที่ homepage.ejs เรียกใช้
      const formattedCourses = rawCourses.map(course => {
          // คำนวณเวลารวมวิดีโอ (นาที)
          const totalMinutes = course.videos ? course.videos.reduce((sum, v) => sum + (v.duration || 0), 0) : 0;
          const hours = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;
          const durationText = hours > 0 ? `${hours} ชม. ${mins} นาที` : `${mins} นาที`;

          return {
              title: course.title,
              // ดึงหมวดหมู่และรูปภาพจาก baseRecipe (หากไม่มีให้ใช้ค่าเริ่มต้น)
              category: course.baseRecipe?.category || 'อาหารไทย',
              cover_image_url: course.baseRecipe?.cover_image_url || course.baseRecipe?.image_url || 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=600&q=80',
              rating: '5.0', // ค่าเริ่มต้นสมมติ (หรือดึงจากรีวิวเพิ่มในอนาคต)
              lesson_count: course.videos ? course.videos.length : 0, // นับจำนวนวิดีโอ
              duration_text: durationText,
              student_count: '0', // ค่าเริ่มต้นสมมติ
              description: course.detailedInstruction || 'เรียนทำอาหารง่ายๆ พร้อมเทคนิคพิเศษ'
          };
      });

      // 4. ส่งข้อมูลที่ปรับฟอร์แมตแล้วไปที่ homepage.ejs
      res.render('homepage', { 
          courses: formattedCourses,
          categories: mockCategories
      });

  } catch (error) {
      console.error("Database Error:", error);
      res.status(500).send("ดึงข้อมูลจาก Database ไม่สำเร็จ");
  }
});

module.exports = router;