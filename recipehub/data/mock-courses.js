/* ===========================================================
   ข้อมูลจำลอง: คอร์สเรียน
   ใช้ที่ routes/courses.js และ routes/profile.js
   TODO(model): เปลี่ยนเป็น Course.find() แล้วลบไฟล์นี้
   =========================================================== */
// รูปภาพ: เก็บเป็นลิงก์ใน database เหมือนโปรเจคเพื่อน (Recipe.image = /uploads/recipes/xxx.jpg หรือ https://...)
//         ตอนนี้ปล่อยว่าง '' → หน้าเว็บจะแสดงกรอบ + ไอคอนแทนรูป (views/user/_image.ejs)

// images ใส่ 1 รูป = คอร์สเดี่ยว, ใส่ 2 รูป = แพ็กเกจ (รูปแบ่งครึ่ง)
// TODO(model): คอร์สไม่มีรูปของตัวเอง ใช้ SingleCourse.baseRecipe → Recipe.image
const courseBase = [
  { title: 'Tomyumkung ต้มยำกุ้ง', tag: 'อาหารไทย', tagType: 'thai', isPack: false, level: 'beginner',
    description: 'เรียนทำอาหารไทยยอดนิยม พร้อมเทคนิคจากเชฟมืออาชีพ', chef: 'เชฟป้อม ใจดี',
    rating: 5.0, lessons: 12, durMin: 150, duration: '2 ชม. 30 นาที', students: '1.2K', price: 890,
    images: [''] },
  { title: 'Italian Pasta Basics', tag: 'อาหารนานาชาติ', tagType: 'inter', isPack: false, level: 'beginner',
    description: 'เรียนทำพาสต้าสไตล์อิตาเลียนง่าย ๆ ที่บ้าน', chef: 'เชฟมาริโอ้ ใจดี',
    rating: 4.9, lessons: 10, durMin: 135, duration: '2 ชม. 15 นาที', students: '980', price: 790,
    images: [''] },
  { title: 'Kuasong  HomHom', tag: 'เบเกอรี่ & ขนมหวาน', tagType: 'bakery', isPack: false, level: 'intermediate',
    description: 'เริ่มต้นทำขนมอบแสนอร่อย ด้วยพื้นฐานที่ทำตามได้', chef: 'เชฟขวัญ ศรีสุขสม',
    rating: 4.8, lessons: 8, durMin: 105, duration: '1 ชม. 45 นาที', students: '750', price: 1190,
    images: [''] },
  { title: 'แพ็ก 2 เมนูพรีเมียม: สเต๊กปลาแซลมอน & พาสต้ากุ้ง', tag: 'อาหารนานาชาติ', tagType: 'inter', isPack: true, level: 'intermediate',
    description: 'เรียนทำสเต๊กแซลมอนเนื้อนุ่ม และพาสต้ากุ้งซอสครีม', chef: 'เชฟมาริโอ้ ใจดี',
    rating: 5.0, lessons: 12, durMin: 150, duration: '2 ชม. 30 นาที', students: '1.2K', price: 1490,
    images: ['', ''] },
  { title: 'แพ็กอาหารไทยยอดฮิต: กะเพรากุ้ง & ต้มยำกุ้ง', tag: 'อาหารไทย', tagType: 'thai', isPack: true, level: 'beginner',
    description: '2 เมนูยอดนิยม', chef: 'เชฟป้อม ใจดี',
    rating: 4.9, lessons: 10, durMin: 135, duration: '2 ชม. 15 นาที', students: '980', price: 1270,
    images: ['', ''] },
  { title: 'แพ็กขนมหวาน: ครัวซองต์ & ช็อกโกแลตลาวา', tag: 'เบเกอรี่ & ขนมหวาน', tagType: 'bakery', isPack: true, level: 'advanced',
    description: 'เริ่มต้นทำขนมอบแสนอร่อย ด้วยพื้นฐานที่ทำตามได้', chef: 'เชฟขวัญ ศรีสุขสม',
    rating: 4.8, lessons: 8, durMin: 105, duration: '1 ชม. 45 นาที', students: '750', price: 2390,
    images: ['', ''] },
];

// ข้อมูลจำลอง 15 คอร์ส (6 อันแรก + วนซ้ำ 3 อันแรกให้เต็มหน้า เหมือนในแบบ)
const allCourses = courseBase
  .concat(courseBase.slice(0, 3), courseBase.slice(0, 3), courseBase.slice(0, 3))
  .map((c, i) => Object.assign({ id: i + 1, chefAvatar: '' }, c));

const courseLevels = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'beginner', label: 'เริ่มต้น' },
  { value: 'intermediate', label: 'ปานกลาง' },
  { value: 'advanced', label: 'ขั้นสูง' },
];

module.exports = { allCourses, courseLevels };
