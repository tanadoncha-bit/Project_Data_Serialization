// services/courseCatalog.js — ดึงคอร์สจาก MongoDB แล้วแปลงเป็นข้อมูลที่หน้า /courses ใช้แสดง
//
// คอร์สมี 2 แบบ (model ของทีม):
//   SingleCourse = คอร์สเดี่ยว  → อิงสูตรตั้งต้น baseRecipe (รูป / หมวด / ระดับ / คะแนน มาจากสูตร)
//   MultiCourse  = แพ็กคอร์ส   → รวมหลาย SingleCourse (includedCourses)
const SingleCourse = require('../models/SingleCourse');
const MultiCourse = require('../models/MultiCourse');
const Transaction = require('../models/Transaction');
const Favorite = require('../models/Favorite');
const { localCountry } = require('./recipeCountries');

const levelOptions = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'BEGINNER', label: 'เริ่มต้น' },
  { value: 'INTERMEDIATE', label: 'ปานกลาง' },
  { value: 'ADVANCED', label: 'ขั้นสูง' },
];
const levelRank = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3 };

/** หมวดของสูตร → ป้ายสี (tagType ตรงกับ .tag--xxx ใน cookhub.css) */
function tagFor(category) {
  const text = (category || '').toLowerCase();
  if (/เบเกอรี่|ขนม|bakery|dessert|cake|เค้ก/.test(text)) return { tag: category || 'เบเกอรี่ & ขนมหวาน', tagType: 'bakery' };
  if (/สุขภาพ|healthy|vegan|salad|สลัด/.test(text)) return { tag: category || 'อาหารเพื่อสุขภาพ', tagType: 'healthy' };
  const country = localCountry(category);
  if (country === 'Thai') return { tag: category || 'อาหารไทย', tagType: 'thai' };
  if (country === 'Japanese') return { tag: category || 'อาหารญี่ปุ่น', tagType: 'japan' };
  return { tag: category || 'อาหารนานาชาติ', tagType: 'inter' };
}

/** นาที → "2 ชม. 30 นาที" */
function formatDuration(min) {
  if (!min) return 'ไม่ระบุเวลา';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return [h ? h + ' ชม.' : '', m ? m + ' นาที' : ''].filter(Boolean).join(' ');
}

/** 1200 → "1.2K" */
function formatCount(n) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);
}

/** คอร์สเดี่ยว 1 อัน → ข้อมูลสำหรับการ์ด */
function mapSingle(course, students) {
  const recipe = course.baseRecipe || {};
  const chef = course.publisher || {};
  const durMin = (course.videos || []).reduce((sum, v) => sum + (v.duration || 0), 0) || recipe.duration || 0;
  return {
    id: course._id,
    kind: 'single',
    url: '/courses/' + course._id,
    title: course.title,
    description: course.detailedInstruction || recipe.description || '',
    ...tagFor(recipe.category),
    isPack: false,
    level: recipe.level || 'BEGINNER',
    rating: recipe.rating,                         // null = ยังไม่มีรีวิว
    lessons: (course.videos || []).length,
    durMin,
    duration: formatDuration(durMin),
    studentCount: students,
    students: formatCount(students),
    price: course.price,
    images: [recipe.image || ''],
    chefId: chef._id,
    chef: chef.name || 'เชฟ',
    chefAvatar: chef.avatar || '',
    createdAt: course.createdAt,
  };
}

/** แพ็กคอร์ส 1 อัน → ข้อมูลสำหรับการ์ด (รวมค่าจากคอร์สข้างใน) */
function mapPack(pack, singleById, students) {
  const items = (pack.includedCourses || []).map(id => singleById.get(id)).filter(Boolean);
  const rated = items.filter(c => c.rating != null);
  const durMin = items.reduce((sum, c) => sum + c.durMin, 0);
  const chef = pack.publisher || {};
  const first = items[0] || {};
  const level = items.reduce((max, c) => (levelRank[c.level] > levelRank[max] ? c.level : max), first.level || 'BEGINNER');
  return {
    id: pack._id,
    kind: 'multi',
    url: '/courses/pack/' + pack._id,
    title: pack.title,
    description: pack.description || items.map(c => c.title).join(' & '),
    tag: first.tag || 'แพ็กคอร์ส',
    tagType: first.tagType || 'inter',
    isPack: true,
    level,
    rating: rated.length ? rated.reduce((s, c) => s + c.rating, 0) / rated.length : null,
    lessons: items.reduce((sum, c) => sum + c.lessons, 0),
    durMin,
    duration: formatDuration(durMin),
    studentCount: students,
    students: formatCount(students),
    price: pack.price,
    images: items.slice(0, 2).map(c => c.images[0]),   // รูปแบ่งครึ่งจาก 2 คอร์สแรกในแพ็ก
    chefId: chef._id || first.chefId,
    chef: chef.name || first.chef || 'เชฟ',
    chefAvatar: chef.avatar || first.chefAvatar || '',
    createdAt: pack.createdAt,
  };
}

/** นับจำนวนคนซื้อของแต่ละคอร์ส จาก Transaction → Map('SingleCourse:1' → 12) */
async function countStudents() {
  const rows = await Transaction.aggregate([
    { $match: { itemType: { $in: ['SingleCourse', 'MultiCourse'] } } },
    { $group: { _id: { t: '$itemType', id: '$itemId' }, n: { $sum: 1 } } },
  ]);
  return new Map(rows.map(r => [r._id.t + ':' + r._id.id, r.n]));
}

/** ดึงคอร์สทั้งหมด (เดี่ยว + แพ็ก) พร้อมข้อมูลสำหรับแสดงผล */
async function loadCourses() {
  const [singles, packs, students] = await Promise.all([
    SingleCourse.find()
      .populate('baseRecipe', 'title description category level duration rating image')
      .populate('publisher', 'name avatar')
      .lean(),
    MultiCourse.find().populate('publisher', 'name avatar').lean(),
    countStudents(),
  ]);

  const singleCards = singles.map(c => mapSingle(c, students.get('SingleCourse:' + c._id) || 0));
  const singleById = new Map(singleCards.map(c => [c.id, c]));
  const packCards = packs.map(p => mapPack(p, singleById, students.get('MultiCourse:' + p._id) || 0));
  return singleCards.concat(packCards);
}

/** คอร์สไหนผู้ใช้กดใจไว้บ้าง → Set('single:1', 'multi:2') */
async function favoriteKeys(clientId) {
  if (!clientId) return new Set();
  const rows = await Favorite.find({ client: clientId, itemType: { $in: ['SingleCourse', 'MultiCourse'] } })
    .select('itemType itemId').lean();
  return new Set(rows.map(f => (f.itemType === 'SingleCourse' ? 'single:' : 'multi:') + f.itemId));
}

/** กดใจ / เลิกกดใจ คอร์ส */
async function setFavorite(clientId, kind, id, on) {
  const itemType = { single: 'SingleCourse', multi: 'MultiCourse' }[kind];
  if (!itemType) return null;
  const Model = kind === 'single' ? SingleCourse : MultiCourse;
  if (!await Model.exists({ _id: id })) return null;
  const key = { client: clientId, itemType, itemId: id };
  if (!on) {
    await Favorite.deleteOne(key);
    return false;
  }
  // ใช้ create (ไม่ใช่ upsert) เพราะเลข _id ถูกสร้างตอน save โดย plugin autoIncrement ของทีม
  if (!await Favorite.exists(key)) {
    try { await Favorite.create(key); }
    catch (err) { if (err.code !== 11000) throw err; }   // กดซ้ำเร็ว ๆ → มีอยู่แล้ว ไม่ต้องทำอะไร
  }
  return true;
}

module.exports = { levelOptions, loadCourses, favoriteKeys, setFavorite, tagFor, formatDuration, formatCount };
