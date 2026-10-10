// services/userPages.js — ดึงข้อมูลจาก MongoDB ให้หน้าฝั่งผู้ใช้ของมุกดา (views/user/*)
//   หน้าแรก  /user          → loadHome()
//   สูตรอาหาร /user/recipes  → loadRecipes()
//   โปรไฟล์   /user/profile  → loadProfile() / saveProfile()
//   รายละเอียดคอร์ส /courses/:id, /courses/pack/:id → loadCourseDetail()
// ใช้ model ของทีมทั้งหมด ไม่ได้สร้าง collection ใหม่
const Recipe = require('../models/Recipe');
const Client = require('../models/Client');
const Favorite = require('../models/Favorite');
const Transaction = require('../models/Transaction');
const SingleCourse = require('../models/SingleCourse');
const MultiCourse = require('../models/MultiCourse');
const catalog = require('./courseCatalog');

const difficultyLabel = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
const recipeLevels = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'easy', label: 'ง่าย' },
  { value: 'medium', label: 'ปานกลาง' },
  { value: 'hard', label: 'ยาก' },
];

/** วันที่ภาษาไทย เช่น "12 กันยายน 2026" */
function thaiDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', calendar: 'gregory' });
}

/* ---------------------------------------------------------- สูตรอาหาร */

/** สูตร 1 อัน (populate publisher แล้ว) → ข้อมูลสำหรับการ์ด */
function mapRecipe(r) {
  const chef = r.publisher && typeof r.publisher === 'object' ? r.publisher : {};
  return {
    id: r._id,
    url: '/recipes/' + r._id,                 // หน้ารายละเอียดสูตรของเพื่อน
    title: r.title,
    description: r.description || '',
    ...catalog.tagFor(r.category),
    difficulty: (r.difficulty || 'EASY').toLowerCase(),
    rating: r.rating,                         // null = ยังไม่มีรีวิว
    cookMin: r.duration || 0,
    price: r.price || 0,
    image: r.image || '',
    likes: catalog.formatCount(r.favoriteCount || 0),
    favoriteCount: r.favoriteCount || 0,
    studentCount: r.favoriteCount || 0,       // ใช้เรียง "ยอดนิยม" ใน helpers/list-filters.js
    chefId: chef._id,
    chef: chef.name || 'เจ้าของสูตร',
    chefAvatar: chef.avatar || '',
    createdAt: r.createdAt,
  };
}

async function loadRecipes() {
  const rows = await Recipe.find().populate('publisher', 'name avatar').lean();
  return rows.map(mapRecipe);
}

/** สูตรไหนผู้ใช้กดใจไว้ → Set ของ id */
async function favoriteRecipeIds(clientId) {
  if (!clientId) return new Set();
  const rows = await Favorite.find({ client: clientId, itemType: 'Recipe' }).select('itemId').lean();
  return new Set(rows.map(f => f.itemId));
}

/* ---------------------------------------------------------- หน้าแรก */

async function loadHome() {
  const [courses, recipes, chefs] = await Promise.all([
    catalog.loadCourses(),
    loadRecipes(),
    Client.find({ role: 'chef' }).select('name avatar').lean(),
  ]);

  // คอร์สยอดนิยม 3 อัน (คนเรียนเยอะสุด)
  const popularCourses = courses.slice().sort((a, b) => b.studentCount - a.studentCount).slice(0, 3);

  // สูตรแนะนำ 4 อัน (คนกดใจเยอะสุด แล้วตามคะแนน)
  const recommendedRecipes = recipes.slice()
    .sort((a, b) => b.favoriteCount - a.favoriteCount || (b.rating || 0) - (a.rating || 0))
    .slice(0, 4);

  // แบนเนอร์: รูปจากสูตรที่มีรูป (ยังไม่มี collection แบนเนอร์ในระบบ)
  const banners = recipes.filter(r => r.image).slice(0, 4).map(r => ({ image: r.image, link: r.url, title: r.title }));
  if (!banners.length) banners.push({ image: '', link: '/courses', title: 'คอร์สเรียน' });

  // เชฟยอดนิยม 3 คน: นับผู้เรียนจากคอร์ส + ยอดกดใจจากสูตรของเชฟคนนั้น
  const score = new Map();
  const mainCategory = new Map();
  courses.forEach(c => { if (c.chefId) score.set(c.chefId, (score.get(c.chefId) || 0) + c.studentCount); });
  recipes.forEach(r => {
    if (!r.chefId) return;
    score.set(r.chefId, (score.get(r.chefId) || 0) + r.favoriteCount);
    if (!mainCategory.has(r.chefId)) mainCategory.set(r.chefId, r.tag);
  });
  const ranked = chefs
    .map(ch => ({ id: ch._id, name: ch.name, avatar: ch.avatar || '', role: mainCategory.get(ch._id) || 'เชฟ CookHub', count: score.get(ch._id) || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((ch, i) => ({ ...ch, isTop: i === 0, followers: catalog.formatCount(ch.count) }));
  // หน้าออกแบบไว้ให้อันดับ 1 อยู่ตรงกลาง → เรียงเป็น [อันดับ 2, อันดับ 1, อันดับ 3]
  const topChefs = ranked.length === 3 ? [ranked[1], ranked[0], ranked[2]] : ranked;

  return { popularCourses, recommendedRecipes, banners, chefs: topChefs };
}

/* ---------------------------------------------------------- โปรไฟล์ */

/** แปลงรายการ Favorite / Transaction เป็นการ์ด (ตัดรายการที่ถูกลบไปแล้วทิ้ง) */
async function itemsFor(rows, getType, getId) {
  const ids = { Recipe: [], SingleCourse: [], MultiCourse: [] };
  rows.forEach(r => { if (ids[getType(r)]) ids[getType(r)].push(getId(r)); });

  const [recipes, courses] = await Promise.all([
    Recipe.find({ _id: { $in: ids.Recipe } }).populate('publisher', 'name avatar').lean(),
    ids.SingleCourse.length || ids.MultiCourse.length ? catalog.loadCourses() : [],
  ]);
  const recipeById = new Map(recipes.map(r => [r._id, mapRecipe(r)]));
  const courseByKey = new Map(courses.map(c => [(c.kind === 'single' ? 'SingleCourse:' : 'MultiCourse:') + c.id, c]));

  return rows.map(row => {
    const type = getType(row);
    if (type === 'Recipe') {
      const r = recipeById.get(getId(row));
      return r && { kind: 'recipe', ...r, row };
    }
    if (type === 'ExternalRecipe') {
      // สูตรจาก TheMealDB ที่เพื่อนบันทึกชื่อ/รูปไว้ใน Favorite
      return { kind: 'recipe', id: row.itemId, url: '/recipes/external/' + row.itemId, title: row.title || 'สูตรจาก TheMealDB',
        description: 'สูตรทั่วไปจาก TheMealDB', tag: 'สูตรทั่วไป', tagType: 'inter', difficulty: null, rating: null,
        cookMin: 0, price: 0, image: row.image || '', chef: 'TheMealDB', chefAvatar: '', row };
    }
    const c = courseByKey.get(type + ':' + getId(row));
    return c && { kind: 'course', ...c, row };
  }).filter(Boolean);
}

/** ชื่อเต็ม ↔ ชื่อ / นามสกุล (ใน Client มี field name ช่องเดียว) */
function splitName(name) {
  const parts = (name || '').trim().split(/\s+/);
  return { firstName: parts.shift() || '', lastName: parts.join(' ') };
}

async function loadProfile(clientId) {
  const client = await Client.findById(clientId).select('name email bio avatar role').lean();
  if (!client) return null;

  const [favRows, buyRows] = await Promise.all([
    Favorite.find({ client: clientId }).sort({ createdAt: -1 }).lean(),
    Transaction.find({ buyer: clientId }).sort({ purchasedAt: -1 }).lean(),
  ]);

  const favUrls = { Recipe: 'recipes/favorites/local', ExternalRecipe: 'recipes/favorites/external',
    SingleCourse: 'courses/favorites/single', MultiCourse: 'courses/favorites/multi' };
  const favorites = (await itemsFor(favRows, r => r.itemType, r => r.itemId)).map(f => ({
    ...f, isPack: f.isPack || false, images: f.images || [f.image],
    favUrl: '/' + favUrls[f.row.itemType] + '/' + f.row.itemId,   // ปุ่มหัวใจ (เอาออกจากรายการโปรด)
  }));
  const orders = (await itemsFor(buyRows, r => r.itemType, r => r.itemId)).map(o => ({
    ...o,
    price: o.row.amountPaid,                  // ราคาที่จ่ายจริง
    date: thaiDate(o.row.purchasedAt),
    image: o.kind === 'course' ? o.images[0] : o.image,
    duration: o.kind === 'course' ? o.duration : (o.cookMin ? catalog.formatDuration(o.cookMin) : 'ไม่ระบุเวลา'),
  }));

  return {
    user: { ...splitName(client.name), email: client.email, bio: client.bio || '', avatar: client.avatar || '' },
    favorites,
    orders,
  };
}

/** บันทึกข้อมูลส่วนตัว → คืนข้อความ error (ถ้ามี) */
async function saveProfile(clientId, body) {
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const bio = String(body.bio || '').slice(0, 300);
  if (!firstName) return 'กรุณากรอกชื่อ';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (await Client.exists({ email, _id: { $ne: clientId } })) return 'อีเมลนี้มีผู้ใช้แล้ว';
  await Client.updateOne({ _id: clientId }, { name: [firstName, lastName].filter(Boolean).join(' '), email, bio });
  return null;
}

/* ---------------------------------------------------------- รายละเอียดคอร์ส */

const youtubeId = url => (String(url || '').match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/) || [])[1] || null;

async function loadCourseDetail(kind, id, clientId) {
  const courses = await catalog.loadCourses();
  const course = courses.find(c => c.kind === kind && c.id === id);
  if (!course) return null;

  // คลิปวิดีโอ (แพ็ก = รวมคลิปของทุกคอร์สในแพ็ก)
  let sections = [];
  if (kind === 'single') {
    const doc = await SingleCourse.findById(id).select('videos').lean();
    sections = [{ title: course.title, url: null, videos: doc ? doc.videos : [] }];
  } else {
    const pack = await MultiCourse.findById(id).select('includedCourses').lean();
    const docs = await SingleCourse.find({ _id: { $in: pack ? pack.includedCourses : [] } }).select('title videos').lean();
    sections = docs.map(d => ({ title: d.title, url: '/courses/' + d._id, videos: d.videos || [] }));
  }
  sections.forEach(s => s.videos = s.videos.map(v => ({ ...v, youtube: youtubeId(v.videoUrl), durationText: catalog.formatDuration(v.duration) })));

  const itemType = kind === 'single' ? 'SingleCourse' : 'MultiCourse';
  const [purchased, favorite] = clientId ? await Promise.all([
    Transaction.exists({ buyer: clientId, itemType, itemId: id }),
    Favorite.exists({ client: clientId, itemType, itemId: id }),
  ]) : [false, false];
  const isOwner = clientId && course.chefId === clientId;

  return { course, sections, purchased: Boolean(purchased), canWatch: Boolean(purchased || isOwner), favorite: Boolean(favorite) };
}

module.exports = { difficultyLabel, recipeLevels, loadRecipes, favoriteRecipeIds, loadHome, loadProfile, saveProfile, loadCourseDetail };
