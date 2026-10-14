
const { randomBytes } = require('crypto');
const createError = require('http-errors');
const Client = require('../models/Client');
const Recipe = require('../models/Recipe');
const SingleCourse = require('../models/SingleCourse');
const MultiCourse = require('../models/MultiCourse');
const Transaction = require('../models/Transaction');

const TZ = 'Asia/Bangkok';
const difficulties = [
  { value: 'EASY', label: 'ง่าย', hint: 'เหมาะสำหรับผู้เริ่มต้น' },
  { value: 'MEDIUM', label: 'ปานกลาง', hint: 'ต้องมีพื้นฐานเบื้องต้น' },
  { value: 'HARD', label: 'ยาก', hint: 'เหมาะสำหรับผู้มีประสบการณ์' },
];
const dayLabels = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];


function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}


function text(value) { return typeof value === 'string' ? value.trim() : ''; }


function isHttpUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch (_) { return false; }
}


function dayKey(date) { return new Date(date).toLocaleDateString('en-CA', { timeZone: TZ }); }


function thaiDate(date) {
  return new Date(date).toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
}


function money(n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }


function durationText(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return [h ? `${h} ชม.` : '', m ? `${m} นาที` : ''].filter(Boolean).join(' ');
}


function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}


function csrf(req, res, next) {
  req.session.chefCsrf = req.session.chefCsrf || randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.chefCsrf;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.body && req.body._csrf;
  if (typeof token !== 'string' || token !== req.session.chefCsrf) {
    return next(createError(403, 'ฟอร์มหมดอายุ กรุณารีเฟรชหน้าแล้วลองอีกครั้ง'));
  }
  next();
}


const levelToDifficulty = { BEGINNER: 'EASY', INTERMEDIATE: 'MEDIUM', ADVANCED: 'HARD' };


function recipeDifficulty(recipe) {
  return (recipe && (recipe.difficulty || levelToDifficulty[recipe.level])) || 'EASY';
}


async function loadRecipeOptions(chefId) {
  const recipes = await Recipe.find({ publisher: chefId }).select('title category difficulty level image rating').sort({ createdAt: -1 }).lean();
  return recipes.map(r => ({
    id: r._id, title: r.title, category: r.category || '', difficulty: recipeDifficulty(r),
    image: r.image || '', rating: r.rating ?? null,
  }));
}


async function loadCourses(chefId) {
  const [singles, multis] = await Promise.all([
    SingleCourse.find({ publisher: chefId }).populate('baseRecipe', 'title category difficulty level image rating').sort({ createdAt: -1 }).lean(),
    MultiCourse.find({ publisher: chefId }).sort({ createdAt: -1 }).lean(),
  ]);
  const students = await studentCounts(singles.map(c => c._id), multis.map(c => c._id));

  const singleViews = singles.map(c => {
    const recipe = c.baseRecipe || {};
    const minutes = (c.videos || []).reduce((sum, v) => sum + (v.duration || 0), 0);
    return {
      id: c._id, type: 'single', title: c.title,
      recipeId: recipe._id || null, recipeTitle: recipe.title || 'สูตรถูกลบไปแล้ว',
      category: recipe.category || 'ไม่ระบุหมวดหมู่', difficulty: recipeDifficulty(recipe),
      imageUrl: recipe.image || '', rating: null,
      price: c.price, description: c.detailedInstruction || '',
      videos: (c.videos || []).map(v => ({ title: v.title, videoUrl: v.videoUrl || '', duration: v.duration ?? '' })),
      lessons: (c.videos || []).map(v => v.title), menus: [], includedIds: [],
      lessonCount: (c.videos || []).length, durationText: durationText(minutes), minutes,
      students: students[`SingleCourse:${c._id}`] || 0, createdAt: c.createdAt,
    };
  });
  const byId = new Map(singleViews.map(c => [c.id, c]));

  const packViews = multis.map(c => {
    const items = (c.includedCourses || []).map(id => byId.get(id)).filter(Boolean);    const minutes = items.reduce((sum, i) => sum + i.minutes, 0);
    const rank = { EASY: 1, MEDIUM: 2, HARD: 3 };
    return {
      id: c._id, type: 'package', title: c.title,
      category: (items[0] && items[0].category) || 'แพ็กคอร์ส',
      difficulty: items.reduce((max, i) => (rank[i.difficulty] > rank[max] ? i.difficulty : max), 'EASY'),
      imageUrl: (items[0] && items[0].imageUrl) || '',
      rating: null,
      price: c.price, description: c.description || '',
      videos: [], lessons: [], includedIds: items.map(i => i.id),
      menus: items.map(i => ({ id: i.id, name: i.title, imageUrl: i.imageUrl, lessons: i.lessons })),
      menuCount: items.length, lessonCount: items.reduce((sum, i) => sum + i.lessonCount, 0),
      durationText: durationText(minutes), minutes,
      students: students[`MultiCourse:${c._id}`] || 0, createdAt: c.createdAt,
    };
  });

  return require('./courseReviews').applyRatings([...singleViews, ...packViews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
}


async function studentCounts(singleIds, multiIds) {
  if (!singleIds.length && !multiIds.length) return {};
  const rows = await Transaction.aggregate([
    { $match: { $or: [
      { itemType: 'SingleCourse', itemId: { $in: singleIds } },
      { itemType: 'MultiCourse', itemId: { $in: multiIds } },
    ] } },
    { $group: { _id: { t: '$itemType', i: '$itemId' }, n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map(r => [`${r._id.t}:${r._id.i}`, r.n]));
}


async function parseCourse(body, chefId, editingId = null) {
  const type = body.type === 'package' ? 'package' : 'single';
  const errors = [];
  const title = text(body.title);
  const price = Number(body.price);
  const description = text(body.description);

  if (!title || title.length > 200) errors.push('กรุณากรอกชื่อคอร์สเรียน (ไม่เกิน 200 ตัวอักษร)');
  if (text(String(body.price ?? '')) === '' || !Number.isFinite(price) || price < 0) errors.push('ราคาต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
  if (description.length > 5000) errors.push('คำอธิบายคอร์สยาวเกิน 5000 ตัวอักษร');

  if (type === 'single') {
    const baseRecipe = Number(body.baseRecipe);
    if (!Number.isSafeInteger(baseRecipe) || !(await Recipe.exists({ _id: baseRecipe, publisher: chefId }))) {
      errors.push('กรุณาเลือกสูตรอาหารตั้งต้นของคอร์ส');
    }
    const videos = (Array.isArray(body.videos) ? body.videos : []).slice(0, 50).map(v => ({
      title: text(v && v.title), videoUrl: text(v && v.videoUrl),
      duration: text(String((v && v.duration) ?? '')) === '' ? null : Number(v.duration),
    })).filter(v => v.title || v.videoUrl);
    if (!videos.length) errors.push('กรุณาเพิ่มบทเรียนอย่างน้อย 1 บท');
    videos.forEach((v, i) => {
      if (!v.title || v.title.length > 200) errors.push(`บทที่ ${i + 1}: กรุณากรอกชื่อบทเรียน`);
      if (!isHttpUrl(v.videoUrl)) errors.push(`บทที่ ${i + 1}: กรุณาใส่ลิงก์วิดีโอที่ขึ้นต้นด้วย http:// หรือ https://`);
      if (v.duration !== null && (!Number.isFinite(v.duration) || v.duration < 0 || v.duration > 1440)) errors.push(`บทที่ ${i + 1}: ความยาวต้องเป็นนาที (0–1440)`);
    });
    return { type, errors, data: { title, baseRecipe, price, detailedInstruction: description || null, videos } };
  }

  const ids = [...new Set((Array.isArray(body.includedCourses) ? body.includedCourses : []).map(Number))]
    .filter(id => Number.isSafeInteger(id) && id !== editingId);
  if (ids.length < 2) errors.push('แพ็กเกจต้องเลือกคอร์สเดี่ยวอย่างน้อย 2 คอร์ส');
  else if ((await SingleCourse.countDocuments({ _id: { $in: ids }, publisher: chefId })) !== ids.length) {
    errors.push('คอร์สที่เลือกบางคอร์สไม่พบ หรือไม่ใช่คอร์สของคุณ');
  }
  return { type, errors, data: { title, price, description: description || null, includedCourses: ids } };
}


function applySingle(doc, data) {
  const { videos, ...rest } = data;
  Object.assign(doc, rest);
  const old = doc.videos || [];
  doc.videos = videos.map((v, i) => ({
    ...(old[i] && old[i].videoId != null ? { videoId: old[i].videoId } : {}),
    title: v.title, videoUrl: v.videoUrl, ...(v.duration !== null ? { duration: v.duration } : {}),
  }));
}


async function saveNew(doc, counterName) {
  try {
    return await doc.save();
  } catch (err) {

    if (err.code !== 11000 || (err.keyPattern && !err.keyPattern._id)) throw err;
    const Model = doc.constructor;
    const Counter = Model.db.model('Counter');
    const last = await Model.findOne().sort({ _id: -1 }).select('_id').lean();
    await Counter.updateOne({ _id: counterName }, { $max: { seq: last ? last._id : 0 } }, { upsert: true });
    doc._id = undefined;
    doc.isNew = true;
    return doc.save();
  }
}


async function dashboardData(chef, { range = 7, allOrders = false } = {}) {
  const chefId = chef._id;
  const [courses, recipes] = await Promise.all([
    loadCourses(chefId),
    Recipe.find({ publisher: chefId }).select('title image rating reviewCount createdAt').lean(),
  ]);

  const singleIds = courses.filter(c => c.type === 'single').map(c => c.id);
  const multiIds = courses.filter(c => c.type === 'package').map(c => c.id);
  const recipeIds = recipes.map(r => r._id);
  const ors = [
    singleIds.length && { itemType: 'SingleCourse', itemId: { $in: singleIds } },
    multiIds.length && { itemType: 'MultiCourse', itemId: { $in: multiIds } },
    recipeIds.length && { itemType: 'Recipe', itemId: { $in: recipeIds } },
  ].filter(Boolean);
  const txs = ors.length
    ? await Transaction.find({ $or: ors }).sort({ purchasedAt: -1 }).populate('buyer', 'name email avatar').lean()
    : [];
  const courseTxs = txs.filter(t => t.itemType !== 'Recipe');


  const monthKey = dayKey(new Date()).slice(0, 7);
  const inThisMonth = d => d && dayKey(d).slice(0, 7) === monthKey;
  const buyers = new Set(courseTxs.map(t => t.buyer && t.buyer._id).filter(v => v != null));
  const newBuyers = new Set(courseTxs.filter(t => inThisMonth(t.purchasedAt)).map(t => t.buyer && t.buyer._id));
  const rated = recipes.filter(r => r.rating != null);
  const avgRating = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : null;
  const revenue = txs.reduce((s, t) => s + (t.amountPaid || 0), 0);

  const stats = {
    courses: courses.length,
    coursesThisMonth: courses.filter(c => inThisMonth(c.createdAt)).length,
    recipes: recipes.length,
    avgRating: avgRating == null ? null : avgRating.toFixed(1),
    students: buyers.size,
    studentsThisMonth: newBuyers.size,
    revenue: money(revenue),
    lastSale: txs[0] ? thaiDate(txs[0].purchasedAt) : null,
  };


  const days = [];
  const now = Date.now();
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const key = dayKey(d);
    const weekday = new Date(`${key}T12:00:00+07:00`).getUTCDay();
    days.push({ key, label: range <= 7 ? dayLabels[weekday] : String(Number(key.slice(8))), total: 0 });
  }
  const byKey = Object.fromEntries(days.map(d => [d.key, d]));
  const prevStart = dayKey(new Date(now - (2 * range - 1) * 86400000));
  let prevTotal = 0;
  for (const t of txs) {
    const key = dayKey(t.purchasedAt);
    if (byKey[key]) byKey[key].total += t.amountPaid || 0;
    else if (key >= prevStart && key < days[0].key) prevTotal += t.amountPaid || 0;
  }
  const periodTotal = days.reduce((s, d) => s + d.total, 0);
  const maxDay = Math.max(0, ...days.map(d => d.total));
  const axisMax = niceMax(maxDay);
  const chart = {
    range, axisMax,
    ticks: [0, 1, 2, 3, 4].map(i => (axisMax / 4) * i).reverse().map(shortMoney),
    bars: days.map(d => ({ label: d.label, total: d.total, totalText: money(d.total), pct: axisMax ? (d.total / axisMax) * 100 : 0 })),
    totalText: money(periodTotal),
    change: prevTotal ? (((periodTotal - prevTotal) / prevTotal) * 100).toFixed(1) : null,
  };


  const topCourse = courses.filter(c => c.students > 0).sort((a, b) => b.students - a.students)[0] || null;
  const topRecipe = rated.sort((a, b) => b.rating - a.rating || (b.reviewCount || 0) - (a.reviewCount || 0))[0] || null;


  const titles = Object.fromEntries(courses.map(c => [`${c.type === 'single' ? 'SingleCourse' : 'MultiCourse'}:${c.id}`, c.title]));
  const orders = courseTxs.slice(0, allOrders ? 100 : 5).map(t => ({
    buyerName: t.buyer ? t.buyer.name : 'ผู้ใช้ที่ถูกลบ',
    buyerEmail: t.buyer ? t.buyer.email : '',
    buyerAvatar: t.buyer ? t.buyer.avatar || '' : '',
    course: titles[`${t.itemType}:${t.itemId}`] || '-',
    date: thaiDate(t.purchasedAt),
    amount: money(t.amountPaid),
  }));

  return { stats, chart, topCourse, topRecipe, orders, totalOrders: courseTxs.length };
}


function niceMax(value) {
  if (!value) return 0;
  const step = Math.pow(10, Math.floor(Math.log10(value / 4)));
  const unit = [1, 2, 2.5, 5, 10].map(m => m * step).find(u => u * 4 >= value);
  return unit * 4;
}


function shortMoney(n) {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

module.exports = {
  difficulties, asyncRoute, csrf,
  loadCourses, loadRecipeOptions, parseCourse, applySingle, saveNew, dashboardData, safeJson, money, Client,
};
