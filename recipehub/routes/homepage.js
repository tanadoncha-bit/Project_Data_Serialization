var express = require('express');
var router = express.Router();

const mockCourses = [
    {
        title: 'เชฟป้อมสอนต้มยำกุ้ง',
        category: 'อาหารไทย',
        cover_image_url: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=600&q=80',
        rating: '5.0',
        lesson_count: 11,
        duration_text: '2 ชม. 30 นาที',
        student_count: '1.2K',
        description: 'เรียนทำอาหารไทยยอดนิยม พร้อมเทคนิคจากเชฟมืออาชีพ'
    },
    {
        title: 'Italian Pasta Basics',
        category: 'อาหารนานาชาติ',
        cover_image_url: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=600&q=80',
        rating: '4.9',
        lesson_count: 10,
        duration_text: '2 ชม. 15 นาที',
        student_count: '980',
        description: 'เรียนทำพาสต้าสไตล์อิตาเลียนง่ายๆ ที่บ้าน'
    },
    {
        title: 'เบเกอรี่สำหรับมือใหม่',
        category: 'เบเกอรี่ & ขนมหวาน',
        cover_image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
        rating: '4.8',
        lesson_count: 8,
        duration_text: '1 ชม. 45 นาที',
        student_count: '750',
        description: 'เริ่มต้นทำขนมอบแสนอร่อย ตั้งแต่พื้นฐานจนทำเองได้'
    }
];

const mockCategories = [
    { name: 'อาหารไทย', count: 24, icon_url: 'https://cdn-icons-png.flaticon.com/512/3274/3274099.png' },
    { name: 'อาหารนานาชาติ', count: 18, icon_url: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png' },
    { name: 'เบเกอรี่ & ขนมหวาน', count: 12, icon_url: 'https://cdn-icons-png.flaticon.com/512/992/992747.png' },
    { name: 'อาหารเพื่อสุขภาพ', count: 9, icon_url: 'https://cdn-icons-png.flaticon.com/512/1206/1206583.png' },
    { name: 'เทคนิคการทำอาหาร', count: 15, icon_url: 'https://cdn-icons-png.flaticon.com/512/1833/1833182.png' },
    { name: 'ธุรกิจอาหาร', count: 8, icon_url: 'https://cdn-icons-png.flaticon.com/512/3448/3448057.png' }
];

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('homepage', { 
      courses: mockCourses,
      categories: mockCategories
  });
});

module.exports = router;