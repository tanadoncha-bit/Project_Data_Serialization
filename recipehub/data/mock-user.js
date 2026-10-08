/* ===========================================================
   ข้อมูลจำลอง: ผู้ใช้ที่ login อยู่ + รายการโปรด + ประวัติการซื้อ
   ใช้ที่ routes/profile.js
   TODO(auth): เมื่อมีระบบ login ให้ใช้ req.user แทน currentUser
   =========================================================== */
// รูปภาพ: เก็บเป็นลิงก์ใน database เหมือนโปรเจคเพื่อน (Recipe.image = /uploads/recipes/xxx.jpg หรือ https://...)
//         ตอนนี้ปล่อยว่าง '' → หน้าเว็บจะแสดงกรอบ + ไอคอนแทนรูป (views/user/_image.ejs)

const { allCourses } = require('./mock-courses');
const { allRecipes } = require('./mock-recipes');

const currentUser = {
  firstName: 'รสรินทร์',
  lastName: 'ศิริวัฒนตระกูลเริศหล้านภาลัย',
  email: 'rossarin@example.com',
  bio: 'นางเงือกผู้หลงไหลในการทำอาหารและขนม เลยขึ้นบกมาแลกหางกับปีก แล้วค่อยเอาปีกไปแลกกับขาอีกที วันหยุดชอบเข้าครัวทำขนม',
  avatar: '',
};

// TODO(model): ดึงรายการโปรดของผู้ใช้จาก database
const userFavorites = [
  Object.assign({ kind: 'recipe' }, allRecipes[0], { cookMin: 35 }),
  Object.assign({ kind: 'course' }, allCourses[4]),
  Object.assign({ kind: 'course' }, allCourses[2]),
];

// TODO(model): ดึงประวัติการซื้อ (Enrollment / Order) ของผู้ใช้จาก database
const userOrders = [
  { kind: 'course', id: 1, title: 'Tomyumkung ต้มยำกุ้ง', description: 'เรียนทำอาหารไทยยอดนิยม พร้อมเทคนิคจากเชฟมืออาชีพ',
    lessons: 12, duration: '2 ชม. 30 นาที', students: '1.2K', price: 890, date: '12 กันยายน 2026', image: '' },
  { kind: 'recipe', id: 1, title: 'Tomyumkung ต้มยำกุ้ง', description: 'เรียนทำอาหารไทยยอดนิยม พร้อมเทคนิคจากเชฟมืออาชีพ',
    duration: '2 ชม. 30 นาที', difficulty: 'easy', price: 189, date: '12 กันยายน 2026', image: '' },
];

module.exports = { currentUser, userFavorites, userOrders };
