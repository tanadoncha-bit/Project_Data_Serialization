var express = require('express');
var router = express.Router();

const SingleCourse = require('../models/SingleCourse');
const Recipe = require('../models/Recipe');
const catalog = require('../services/courseCatalog');

const categoryDefinitions = [
    { name: 'อาหารไทย', icon: 'soup', values: ['อาหารไทย', 'Thai'] },
    { name: 'อาหารนานาชาติ', icon: 'globe', values: ['อาหารนานาชาติ', 'International', 'British', 'English', 'Chinese', 'Japanese', 'Korean', 'South Korean', 'North Korean', 'อาหารอังกฤษ', 'อาหารจีน', 'อาหารญี่ปุ่น', 'อาหารเกาหลี'] },
    { name: 'เบเกอรี่ & ขนมหวาน', icon: 'cake-slice', values: ['เบเกอรี่ & ขนมหวาน', 'เบเกอรี่และขนมหวาน', 'Dessert'] },
    { name: 'อาหารเพื่อสุขภาพ', icon: 'leaf', values: ['อาหารเพื่อสุขภาพ', 'Healthy'] },
    { name: 'เทคนิคการทำอาหาร', icon: 'chef-hat', values: ['เทคนิคการทำอาหาร', 'Cooking Techniques'] },
    { name: 'ธุรกิจอาหาร', icon: 'utensils', values: ['ธุรกิจอาหาร', 'Food Business'] }
];

router.get('/', async function(req, res, next) {
  if (req.user && req.user.role === 'user') return res.redirect('/user');
  try {

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

      const courses = (await catalog.loadCourses())
          .sort((a, b) => b.studentCount - a.studentCount || new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 6);

      res.render('homepage', { 
          courses,
          categories
      });

  } catch (error) {
      console.error("Database Error:", error);
      next(error);
  }
});


module.exports = router;