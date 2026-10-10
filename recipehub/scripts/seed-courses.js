// scripts/seed-courses.js — ใส่คอร์สตัวอย่างลง MongoDB (ใช้สูตรอาหารที่มีอยู่แล้วเป็น baseRecipe)
//
// รัน:   node scripts/seed-courses.js
// ลบ:    node scripts/seed-courses.js --remove
//
// - ใส่เฉพาะตอนที่ยังไม่มีคอร์สใน database (กันใส่ซ้ำ)
// - คอร์สตัวอย่างทุกอันมีคำว่า [ตัวอย่าง] ในชื่อ เพื่อให้ลบทีหลังได้ง่าย
// - ต้องมีสูตรอาหาร (Recipe) อย่างน้อย 2 สูตรใน database ก่อน
require('dotenv').config();
const mongoose = require('mongoose');
const Recipe = require('../models/Recipe');
const SingleCourse = require('../models/SingleCourse');
const MultiCourse = require('../models/MultiCourse');

const TAG = '[ตัวอย่าง]';

async function remove() {
  const singles = await SingleCourse.find({ title: { $regex: '^\\[ตัวอย่าง\\]' } }).select('_id').lean();
  const r1 = await MultiCourse.deleteMany({ title: { $regex: '^\\[ตัวอย่าง\\]' } });
  const r2 = await SingleCourse.deleteMany({ _id: { $in: singles.map(s => s._id) } });
  console.log(`ลบแพ็ก ${r1.deletedCount} อัน, คอร์สเดี่ยว ${r2.deletedCount} อัน`);
}

async function seed() {
  if (await SingleCourse.estimatedDocumentCount() > 0) {
    console.log('มีคอร์สใน database อยู่แล้ว — ไม่ใส่ซ้ำ');
    return;
  }
  const recipes = await Recipe.find().sort({ rating: -1 }).limit(6).lean();
  if (recipes.length < 2) {
    console.log('ต้องมีสูตรอาหารอย่างน้อย 2 สูตรก่อน (สร้างจากหน้าเชฟ /chef/recipes)');
    return;
  }

  const singles = [];
  for (const [i, r] of recipes.entries()) {
    const course = await SingleCourse.create({
      publisher: r.publisher,
      baseRecipe: r._id,
      title: `${TAG} คอร์ส${r.title}`,
      detailedInstruction: `เรียนทำ${r.title} ทีละขั้นตอนกับเชฟ`,
      price: [490, 690, 890, 1190][i % 4],
      videos: [
        { title: 'เตรียมวัตถุดิบ', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: 20 + i * 5 },
        { title: 'ลงมือทำ', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: 40 + i * 10 },
      ],
    });
    singles.push(course);
  }

  await MultiCourse.create({
    publisher: singles[0].publisher,
    title: `${TAG} แพ็ก 2 เมนู: ${recipes[0].title} & ${recipes[1].title}`,
    description: 'เรียน 2 คอร์สในราคาพิเศษ',
    price: Math.round((singles[0].price + singles[1].price) * 0.8),
    includedCourses: [singles[0]._id, singles[1]._id],
  });

  console.log(`ใส่คอร์สเดี่ยว ${singles.length} อัน + แพ็ก 1 อัน เรียบร้อย`);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    if (process.argv.includes('--remove')) await remove();
    else await seed();
  } finally {
    await mongoose.disconnect();
  }
})().catch((err) => { console.error(err.message); process.exit(1); });
