var express = require('express');
var router = express.Router();

const SingleCourse = require('../models/SingleCourse');
const Transaction = require('../models/Transaction');
const Recipe = require('../models/Recipe');

const categoryDefinitions = [
    { name: 'อาหารไทย', icon: 'soup', values: ['อาหารไทย', 'Thai'] },
    { name: 'อาหารนานาชาติ', icon: 'globe', values: ['อาหารนานาชาติ', 'International', 'British', 'English', 'Chinese', 'Japanese', 'Korean', 'South Korean', 'North Korean', 'อาหารอังกฤษ', 'อาหารจีน', 'อาหารญี่ปุ่น', 'อาหารเกาหลี'] },
    { name: 'เบเกอรี่ & ขนมหวาน', icon: 'cake-slice', values: ['เบเกอรี่ & ขนมหวาน', 'เบเกอรี่และขนมหวาน', 'Dessert'] },
    { name: 'อาหารเพื่อสุขภาพ', icon: 'leaf', values: ['อาหารเพื่อสุขภาพ', 'Healthy'] },
    { name: 'เทคนิคการทำอาหาร', icon: 'chef-hat', values: ['เทคนิคการทำอาหาร', 'Cooking Techniques'] },
    { name: 'ธุรกิจอาหาร', icon: 'utensils', values: ['ธุรกิจอาหาร', 'Food Business'] }
];

router.get('/', async function(req, res, next) {
  try {
      // นับคอร์สทั้งหมดในแต่ละหมวด ไม่จำกัดเฉพาะคอร์สยอดนิยม 6 รายการ
      const categoryCounts = await SingleCourse.aggregate([
          { $lookup: { from: Recipe.collection.name, localField: 'baseRecipe', foreignField: '_id', as: 'recipe' } },
          { $unwind: '$recipe' },
          { $group: { _id: { $trim: { input: '$recipe.category' } }, count: { $sum: 1 } } }
      ]);
      const categories = categoryDefinitions.map(category => ({
          name: category.name,
          icon: category.icon,
          count: categoryCounts.reduce((total, row) => total + (category.values.includes(row._id) ? row.count : 0), 0)
      }));
      // นับผู้ซื้อจริงที่ไม่ซ้ำกันต่อคอร์ส ไม่รวมการซื้อจำลอง/ทดสอบ
      const rankedCourses = await SingleCourse.aggregate([
          { $lookup: {
              from: Transaction.collection.name,
              let: { courseId: '$_id' },
              pipeline: [
                  { $match: { itemType: 'SingleCourse', paymentMode: 'real',
                      $expr: { $eq: ['$itemId', '$$courseId'] } } },
                  { $group: { _id: '$buyer' } },
                  { $count: 'count' }
              ],
              as: 'purchaseStats'
          } },
          { $addFields: { studentCount: { $ifNull: [{ $arrayElemAt: ['$purchaseStats.count', 0] }, 0] } } },
          { $sort: { studentCount: -1, createdAt: -1, _id: -1 } },
          { $limit: 6 },
          { $project: { purchaseStats: 0 } }
      ]);
      const rawCourses = await SingleCourse.populate(rankedCourses, { path: 'baseRecipe' });

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
              lesson_count: course.videos ? course.videos.length : 0,
              duration_text: durationText,
              student_count: course.studentCount,
              description: course.detailedInstruction || ''
          };
      });

      res.render('homepage', { 
          courses: formattedCourses,
          categories
      });

  } catch (error) {
      console.error("Database Error:", error);
      next(error);
  }
});


module.exports = router;
