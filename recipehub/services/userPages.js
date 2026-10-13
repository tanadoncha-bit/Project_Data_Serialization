// services/userPages.js — ดึงข้อมูลจาก MongoDB ให้หน้าฝั่งผู้ใช้ (views/user/*)
const Recipe = require('../models/Recipe');
const Client = require('../models/Client');
const Favorite = require('../models/Favorite');
const SingleCourse = require('../models/SingleCourse');
const MultiCourse = require('../models/MultiCourse');
const catalog = require('./courseCatalog');
const payments = require('./coursePayments');

/* ---------------------------------------------------------- สูตรอาหาร */

/** สูตร 1 อัน (populate publisher แล้ว) → ข้อมูลสำหรับการ์ด */
function mapRecipe(r) {
  const chef = r.publisher && typeof r.publisher === 'object' ? r.publisher : {};
  return {
    id: r._id,
    url: '/recipes/' + r._id,
    title: r.title,
    description: r.description || '',
    ...catalog.tagFor(r.category),
    difficulty: (r.difficulty || 'EASY').toLowerCase(),
    rating: r.rating,
    cookMin: r.duration || 0,
    price: r.price || 0,
    image: r.image || '',
    likes: catalog.formatCount(r.favoriteCount || 0),
    favoriteCount: r.favoriteCount || 0,
    studentCount: r.favoriteCount || 0,
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

  const popularCourses = courses.slice().sort((a, b) => b.studentCount - a.studentCount).slice(0, 3);

  const recommendedRecipes = recipes.slice()
    .sort((a, b) => b.favoriteCount - a.favoriteCount || (b.rating || 0) - (a.rating || 0))
    .slice(0, 4);

  // แบนเนอร์: เปลี่ยนรูปได้ที่ public/images/homepage/Property1.png ถึง Property4.png
  const banners = [1, 2, 3, 4].map(number => ({
    image: '/images/homepage/Property' + number + '.png',
    link: '/courses',
    title: 'โปรโมชั่น ' + number,
  }));

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
  const topChefs = ranked.length === 3 ? [ranked[1], ranked[0], ranked[2]] : ranked;

  return { popularCourses, recommendedRecipes, banners, chefs: topChefs };
}

/* ---------------------------------------------------------- รายละเอียดคอร์ส */

const youtubeId = url => (String(url || '').match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/) || [])[1] || null;

const levelLabel = { BEGINNER: 'เริ่มต้น', INTERMEDIATE: 'ปานกลาง', ADVANCED: 'ขั้นสูง' };
const toList = v => (Array.isArray(v) ? v.map(String).map(s => s.trim()).filter(Boolean) : []);

/** ข้อมูลรายละเอียดคอร์ส ใช้ทั้งหน้าต่างเด้ง (?fragment=1) และหน้าเต็ม (ดูวิดีโอ) */
async function loadCourseDetail(kind, id, clientId) {
  const courses = await catalog.loadCourses();
  const course = courses.find(c => c.kind === kind && c.id === id);
  if (!course) return null;
  const byId = new Map(courses.filter(c => c.kind === 'single').map(c => [c.id, c]));

  // บทเรียน (แพ็ก = รวมบทเรียนของทุกคอร์สในแพ็ก)
  let sections = [];
  let learnPoints = [];
  if (kind === 'single') {
    const doc = await SingleCourse.findById(id).lean();
    sections = [{ id, title: course.title, url: null, image: course.images[0], description: course.description, videos: doc ? doc.videos || [] : [] }];
    learnPoints = toList(doc && doc.learnPoints);
  } else {
    const pack = await MultiCourse.findById(id).lean();
    const ids = pack ? pack.includedCourses || [] : [];
    const docs = await SingleCourse.find({ _id: { $in: ids } }).select('title videos').lean();
    const docById = new Map(docs.map(d => [d._id, d]));
    sections = ids.map(cid => docById.get(cid)).filter(Boolean).map(d => {
      const card = byId.get(d._id) || {};
      return { id: d._id, title: d.title, url: '/courses/' + d._id, image: (card.images || [''])[0], description: card.description || '', videos: d.videos || [] };
    });
    learnPoints = toList(pack && pack.learnPoints);
  }
  sections.forEach(s => s.videos = s.videos.map(v => {
    const yt = youtubeId(v.videoUrl);
    return { ...v, youtube: yt, thumb: yt ? `https://img.youtube.com/vi/${yt}/mqdefault.jpg` : s.image, durationText: catalog.formatDuration(v.duration) };
  }));

  const itemType = kind === 'single' ? 'SingleCourse' : 'MultiCourse';
  const [rights, favorite, chef] = await Promise.all([
    payments.access(clientId, kind, { _id: id, price: course.price, publisher: course.chefId }),
    clientId ? Favorite.exists({ client: clientId, itemType, itemId: id }) : null,
    course.chefId ? Client.findById(course.chefId).select('name avatar bio institution').lean() : null,
  ]);
  const { purchased, isOwner, canWatch } = rights;
  const lessonCount = sections.reduce((n, s) => n + s.videos.length, 0);

  return {
    course, sections, learnPoints, lessonCount,
    levelText: levelLabel[course.level] || 'เริ่มต้น',
    chefInfo: { name: course.chef, avatar: course.chefAvatar, bio: (chef && chef.bio) || '', institution: (chef && chef.institution) || '' },
    purchased, isOwner, canWatch, favorite: Boolean(favorite),
  };
}

module.exports = { loadRecipes, favoriteRecipeIds, loadHome, loadCourseDetail };
