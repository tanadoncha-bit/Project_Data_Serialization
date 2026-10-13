/* ===========================================================
   ข้อมูลจำลอง: หน้าแรก
   ใช้ที่ routes/index.js
   TODO(model): ลบไฟล์นี้เมื่อดึงข้อมูลจริงจาก database
   =========================================================== */
// รูปภาพ: เก็บเป็นลิงก์ใน database เหมือนโปรเจคเพื่อน (Recipe.image = /uploads/recipes/xxx.jpg หรือ https://...)
//         ตอนนี้ปล่อยว่าง '' → หน้าเว็บจะแสดงกรอบ + ไอคอนแทนรูป (views/user/_image.ejs)

// tagType ใช้กำหนดสีป้ายหมวดหมู่: thai | inter | bakery | japan | healthy
const popularCourses = [
  { id: 1, title: 'เชฟป้อมสอนต้มยำกุ้ง', tag: 'อาหารไทย', tagType: 'thai', rating: 5.0,
    description: 'เรียนทำอาหารไทยยอดนิยม พร้อมเทคนิคจากเชฟมืออาชีพ',
    lessons: 12, durMin: 150, duration: '2 ชม. 30 นาที', students: '1.2K', image: '' },
  { id: 2, title: 'Italian Pasta Basics', tag: 'อาหารนานาชาติ', tagType: 'inter', rating: 4.9,
    description: 'เรียนทำพาสต้าสไตล์อิตาเลียนง่าย ๆ ที่บ้าน',
    lessons: 10, durMin: 135, duration: '2 ชม. 15 นาที', students: '980', image: '' },
  { id: 3, title: 'เบเกอรี่สำหรับมือใหม่', tag: 'เบเกอรี่ & ขนมหวาน', tagType: 'bakery', rating: 4.8,
    description: 'เริ่มต้นทำขนมอบแสนอร่อย ด้วยพื้นฐานที่ทำตามได้',
    lessons: 8, durMin: 105, duration: '1 ชม. 45 นาที', students: '750', image: '' },
];

const banners = [
  { image: '', link: '/courses' },
  { image: '', link: '/courses' },
  { image: '', link: '/recipes' },
  { image: '', link: '/recipes' },
];

const recommendedRecipes = [
  { id: 1, title: 'Matcha Cheesecake', likes: '5.1K', image: '' },
  { id: 2, title: 'Beef Bourguignon', likes: '4.7K', image: '' },
  { id: 3, title: 'Spaghetti Carbonara', likes: '6.2K', image: '' },
  { id: 4, title: 'Lasagne', likes: '4.1K', image: '' },
];

// ลำดับ: ซ้าย, กลาง (อันดับ 1 มีมงกุฎ), ขวา
const chefs = [
  { name: 'เชฟพร พลอยใส', role: 'เบเกอรี่ & ขนมหวาน', followers: '9.6K', avatar: '' },
  { name: 'เชฟกฤษณ์ วราภรณ์', role: 'อาหารไทย', followers: '12.8K', avatar: '' },
  { name: 'เชฟนนท์ Pastry', role: 'เบเกอรี่ & ขนมหวาน', followers: '8.9K', avatar: '' },
];

module.exports = { popularCourses, banners, recommendedRecipes, chefs };
