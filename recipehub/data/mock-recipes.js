/* ===========================================================
   ข้อมูลจำลอง: สูตรอาหาร
   ใช้ที่ routes/recipes.js และ routes/profile.js
   TODO(model): เปลี่ยนเป็น Recipe.find() แล้วลบไฟล์นี้
   =========================================================== */
// รูปภาพ: เก็บเป็นลิงก์ใน database เหมือนโปรเจคเพื่อน (Recipe.image = /uploads/recipes/xxx.jpg หรือ https://...)
//         ตอนนี้ปล่อยว่าง '' → หน้าเว็บจะแสดงกรอบ + ไอคอนแทนรูป (views/user/_image.ejs)

// price: 0 = ฟรี | difficulty: easy | medium | hard
const recipeBase = [
  { title: 'Tomyumkung ต้มยำกุ้ง', tag: 'อาหารไทย', tagType: 'thai', difficulty: 'easy',
    description: 'เรียนทำอาหารไทยยอดนิยม พร้อมเทคนิคจากเชฟมืออาชีพ', chef: 'เชฟป้อม ใจดี',
    rating: 5.0, cookMin: 30, price: 189, image: '' },
  { title: 'Italian Pasta Basics', tag: 'อาหารนานาชาติ', tagType: 'inter', difficulty: 'medium',
    description: 'เรียนทำพาสต้าสไตล์อิตาเลียน พร้อมเทคนิคจากเชฟมืออาชีพ', chef: 'เชฟมาริโอ้ ใจดี',
    rating: 4.9, cookMin: 30, price: 0, image: '' },
  { title: 'Kuasong  HomHom', tag: 'เบเกอรี่ & ขนมหวาน', tagType: 'bakery', difficulty: 'hard',
    description: 'เริ่มต้นทำขนมอบแสนอร่อย ด้วยพื้นฐานที่ทำตามได้', chef: 'เชฟขวัญ ศรีสุขสม',
    rating: 4.8, cookMin: 90, price: 0, image: '' },
  { title: 'Matcha Cheesecake', tag: 'เบเกอรี่ & ขนมหวาน', tagType: 'bakery', difficulty: 'medium',
    description: 'ชีสเค้กมัทฉะเนื้อเนียน หอมชาเขียว', chef: 'เชฟขวัญ ศรีสุขสม',
    rating: 4.7, cookMin: 60, price: 0, image: '' },
  { title: 'Beef Bourguignon', tag: 'อาหารนานาชาติ', tagType: 'inter', difficulty: 'hard',
    description: 'สตูว์เนื้อตุ๋นไวน์แดงสไตล์ฝรั่งเศส', chef: 'เชฟมาริโอ้ ใจดี',
    rating: 4.8, cookMin: 180, price: 0, image: '' },
  { title: 'Lasagne', tag: 'อาหารนานาชาติ', tagType: 'inter', difficulty: 'medium',
    description: 'ลาซานญ่าซอสเนื้อ ชีสยืดเต็มคำ', chef: 'เชฟมาริโอ้ ใจดี',
    rating: 4.6, cookMin: 75, price: 119, image: '' },
];

// ข้อมูลจำลอง 15 สูตร (6 อันแรก + วนซ้ำ 3 อันหลัง ให้เป็น ฟรี / ฟรี / ฿119 เหมือนในแบบ)
const allRecipes = recipeBase
  .concat(recipeBase.slice(3), recipeBase.slice(3), recipeBase.slice(3))
  .map((r, i) => Object.assign({ id: i + 1, chefAvatar: '' }, r));

const recipeLevels = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'easy', label: 'ง่าย' },
  { value: 'medium', label: 'ปานกลาง' },
  { value: 'hard', label: 'ยาก' },
];
const difficultyLabel = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };

module.exports = { allRecipes, recipeLevels, difficultyLabel };
