// services/chefSupport.js — ฟังก์ชันช่วยของหน้าฝั่งเชฟ (Dashboard / จัดการคอร์ส / โปรไฟล์)
const { randomBytes } = require('crypto');
const createError = require('http-errors');
const Client = require('../models/Client');
const Recipe = require('../models/Recipe');
const SingleCourse = require('../models/SingleCourse');
const MultiCourse = require('../models/MultiCourse');
const Transaction = require('../models/Transaction');

const TZ = 'Asia/Bangkok';
const categories = ['อาหารไทย', 'อาหารนานาชาติ', 'เบเกอรี่ & ขนมหวาน', 'อาหารสุขภาพ'];
const difficulties = [
  { value: 'EASY', label: 'ง่าย', hint: 'เหมาะสำหรับผู้เริ่มต้น' },
  { value: 'MEDIUM', label: 'ปานกลาง', hint: 'ต้องมีพื้นฐานเบื้องต้น' },
  { value: 'HARD', label: 'ยาก', hint: 'เหมาะสำหรับผู้มีประสบการณ์' },
];
const dayLabels = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

/* ---------- ตัวช่วยทั่วไป ---------- */

/** ครอบ route แบบ async ให้ error ไหลไป error handler ของ Express */
function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/** ตัดช่องว่างหัวท้าย ถ้าไม่ใช่ string คืนค่าว่าง */
function text(value) { return typeof value === 'string' ? value.trim() : ''; }

/** เช็คว่าเป็น URL แบบ http/https จริง */
function isHttpUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch (_) { return false; }
}

/** แปลงวันที่เป็น key รายวันตามเวลาไทย เช่น 2026-10-08 */
function dayKey(date) { return new Date(date).toLocaleDateString('en-CA', { timeZone: TZ }); }

/** วันที่แบบไทยแต่ใช้ปี ค.ศ. เช่น 15 ก.ย. 2026 */
function thaiDate(date) {
  return new Date(date).toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
}

/** ใส่ comma ให้ตัวเลข เช่น 1073280 → 1,073,280 */
function money(n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }

/** แปลงนาทีเป็นข้อความ เช่น 150 → 2 ชม. 30 นาที */
function durationText(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return [h ? `${h} ชม.` : '', m ? `${m} นาที` : ''].filter(Boolean).join(' ');
}

/**
 * แปลง object เป็น JSON ที่ฝังใน <script> ได้ปลอดภัย
 * (escape < > & กันการปิดแท็ก script ด้วยข้อมูลที่ผู้ใช้กรอก)
 */
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/* ---------- CSRF ของหน้าเชฟ ---------- */

/** สร้าง token ไว้ใน session และตรวจทุก request ที่ไม่ใช่ GET (รองรับทั้งฟอร์มและ JSON) */
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

/* ---------- โปรไฟล์ ---------- */

/** แยกชื่อเต็มใน DB (ช่องเดียว) ออกเป็นชื่อ/นามสกุล ตามช่องว่างแรก */
function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

/** ตรวจข้อมูลฟอร์มโปรไฟล์ คืนค่า { values, update, errors } */
function parseProfile(body) {
  const values = {
    firstName: text(body.firstName), lastName: text(body.lastName),
    email: text(body.email).toLowerCase(), institution: text(body.institution),
    bio: text(body.bio).slice(0, 300),
  };
  const errors = [];
  if (!values.firstName) errors.push('กรุณากรอกชื่อ');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.push('รูปแบบอีเมลไม่ถูกต้อง');
  if (values.firstName.length + values.lastName.length > 150) errors.push('ชื่อยาวเกินไป');
  if (values.institution.length > 200) errors.push('ชื่อสถาบันยาวเกิน 200 ตัวอักษร');

  const update = {
    name: `${values.firstName} ${values.lastName}`.trim(),
    email: values.email, institution: values.institution || null, bio: values.bio,
  };
  // รูปโปรไฟล์: เบราว์เซอร์ย่อรูปเป็น JPEG เล็กๆ แล้วส่งมาเป็น data URL
  const avatar = text(body.avatarData);
  if (avatar === 'remove') update.avatarUrl = '';
  else if (avatar) {
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar) || avatar.length > 90000) {
      errors.push('รูปโปรไฟล์ไม่ถูกต้องหรือใหญ่เกินไป');
    } else update.avatarUrl = avatar;
  }
  return { values, update, errors };
}

/* ---------- คอร์ส ---------- */

/** รวมคอร์สเดี่ยว + แพ็กเกจของเชฟ พร้อมจำนวนผู้เรียน แปลงเป็นรูปแบบเดียวกันให้หน้าเว็บใช้ */
async function loadCourses(chefId) {
  const [singles, multis] = await Promise.all([
    SingleCourse.find({ publisher: chefId }).sort({ createdAt: -1 }).lean(),
    MultiCourse.find({ publisher: chefId }).sort({ createdAt: -1 }).lean(),
  ]);
  const students = await studentCounts(singles.map(c => c._id), multis.map(c => c._id));

  const list = [
    ...singles.map(c => {
      const minutes = c.videos.reduce((sum, v) => sum + (v.duration || 0), 0);
      return {
        id: c._id, type: 'single', title: c.title, category: c.category || 'อาหารไทย',
        difficulty: c.difficulty || 'EASY', price: c.price, videoUrl: c.videoUrl || '',
        imageUrl: c.imageUrl || '', description: c.detailedInstruction || '',
        lessons: c.videos.map(v => v.title), menus: [],
        lessonCount: c.videos.length, durationText: durationText(minutes),
        students: students[`SingleCourse:${c._id}`] || 0, createdAt: c.createdAt,
      };
    }),
    ...multis.map(c => {
      const menus = (c.menus || []).map(m => ({ name: m.name, imageUrl: m.imageUrl || '', lessons: m.lessons.map(l => l.title) }));
      return {
        id: c._id, type: 'package', title: c.title, category: c.category || 'อาหารไทย',
        difficulty: c.difficulty || 'EASY', price: c.price, videoUrl: c.videoUrl || '',
        imageUrl: c.imageUrl || (menus[0] && menus[0].imageUrl) || '', description: c.description || '',
        lessons: [], menus, menuCount: menus.length || (c.includedCourses || []).length,
        lessonCount: menus.reduce((sum, m) => sum + m.lessons.length, 0), durationText: '',
        students: students[`MultiCourse:${c._id}`] || 0, createdAt: c.createdAt,
      };
    }),
  ];
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** นับผู้ซื้อแยกตามคอร์ส คืน { 'SingleCourse:3': 12, ... } */
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

/** ตรวจข้อมูลคอร์สที่ส่งมาจากฟอร์ม (JSON) คืน { type, data, errors } พร้อมบันทึกลง model ได้ทันที */
function parseCourse(body) {
  const type = body.type === 'package' ? 'package' : 'single';
  const errors = [];
  const title = text(body.title);
  const category = text(body.category);
  const difficulty = text(body.difficulty);
  const price = Number(body.price);
  const videoUrl = text(body.videoUrl);
  const imageUrl = text(body.imageUrl);
  const description = text(body.description);

  if (!title || title.length > 200) errors.push('กรุณากรอกชื่อคอร์สเรียน (ไม่เกิน 200 ตัวอักษร)');
  if (!categories.includes(category)) errors.push('กรุณาเลือกหมวดหมู่');
  if (!difficulties.some(d => d.value === difficulty)) errors.push('กรุณาเลือกระดับความยาก');
  if (text(String(body.price ?? '')) === '' || !Number.isFinite(price) || price < 0) errors.push('ราคาต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
  if (!isHttpUrl(videoUrl)) errors.push('กรุณาใส่ลิงก์วิดีโอคอร์สที่ขึ้นต้นด้วย http:// หรือ https://');
  if (!isHttpUrl(imageUrl)) errors.push('กรุณาใส่ URL รูปภาพเมนูที่ขึ้นต้นด้วย http:// หรือ https://');
  if (description.length > 5000) errors.push('คำอธิบายคอร์สยาวเกิน 5000 ตัวอักษร');

  const cleanLessons = value => (Array.isArray(value) ? value : []).map(text).filter(Boolean).slice(0, 50);
  const base = { title, category, difficulty, price, videoUrl, imageUrl };

  if (type === 'single') {
    const lessons = cleanLessons(body.lessons);
    if (!lessons.length) errors.push('กรุณาเพิ่มบทเรียนอย่างน้อย 1 บท');
    if (lessons.some(l => l.length > 200)) errors.push('ชื่อบทเรียนยาวเกิน 200 ตัวอักษร');
    return { type, errors, data: { ...base, detailedInstruction: description || null, lessons } };
  }

  const menus = (Array.isArray(body.menus) ? body.menus : []).slice(0, 20).map(m => ({
    name: text(m && m.name), imageUrl: text(m && m.imageUrl), lessons: cleanLessons(m && m.lessons),
  })).filter(m => m.name || m.imageUrl || m.lessons.length);
  if (!menus.length) errors.push('คอร์สแพ็กเกจต้องมีเมนูย่อยอย่างน้อย 1 เมนู');
  menus.forEach((m, i) => {
    if (!m.name || m.name.length > 200) errors.push(`เมนูที่ ${i + 1}: กรุณากรอกชื่อเมนู`);
    if (!isHttpUrl(m.imageUrl)) errors.push(`เมนูที่ ${i + 1}: กรุณาใส่ URL รูปภาพเมนู (http/https)`);
    if (!m.lessons.length) errors.push(`เมนูที่ ${i + 1}: กรุณาเพิ่มบทเรียนอย่างน้อย 1 บท`);
  });
  return {
    type, errors,
    data: { ...base, description: description || null, menus: menus.map(m => ({ ...m, lessons: m.lessons.map(title => ({ title })) })) },
  };
}

/** นำข้อมูลที่ตรวจแล้วใส่ลง document คอร์สเดี่ยว (เก็บ videoId/duration ของบทเรียนเดิมไว้ตามลำดับ) */
function applySingle(doc, data) {
  const { lessons, ...rest } = data;
  Object.assign(doc, rest);
  const old = doc.videos || [];
  doc.videos = lessons.map((title, i) => {
    const prev = old[i];
    return prev ? { videoId: prev.videoId, title, videoUrl: prev.videoUrl || '', duration: prev.duration } : { title, videoUrl: '' };
  });
}

/* ---------- Dashboard ---------- */

/** รวบรวมตัวเลขทั้งหมดของหน้า Dashboard จาก MongoDB */
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
    ? await Transaction.find({ $or: ors }).sort({ purchasedAt: -1 }).populate('buyer', 'name email avatarUrl').lean()
    : [];
  const courseTxs = txs.filter(t => t.itemType !== 'Recipe');

  // ---- การ์ดสถิติ 4 ใบ ----
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

  // ---- กราฟรายได้ย้อนหลัง N วัน (ตามเวลาไทย) เทียบกับช่วงก่อนหน้า ----
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

  // ---- คอร์สขายดีอันดับ 1 / สูตรคะแนนสูงสุด ----
  const topCourse = courses.filter(c => c.students > 0).sort((a, b) => b.students - a.students)[0] || null;
  const topRecipe = rated.sort((a, b) => b.rating - a.rating || (b.reviewCount || 0) - (a.reviewCount || 0))[0] || null;

  // ---- คำสั่งซื้อคอร์สล่าสุด ----
  const titles = Object.fromEntries(courses.map(c => [`${c.type === 'single' ? 'SingleCourse' : 'MultiCourse'}:${c.id}`, c.title]));
  const orders = courseTxs.slice(0, allOrders ? 100 : 5).map(t => ({
    buyerName: t.buyer ? t.buyer.name : 'ผู้ใช้ที่ถูกลบ',
    buyerEmail: t.buyer ? t.buyer.email : '',
    buyerAvatar: t.buyer ? t.buyer.avatarUrl || '' : '',
    course: titles[`${t.itemType}:${t.itemId}`] || '-',
    date: thaiDate(t.purchasedAt),
    amount: money(t.amountPaid),
  }));

  return { stats, chart, topCourse, topRecipe, orders, totalOrders: courseTxs.length };
}

/** ปัดค่าสูงสุดของแกน Y ให้เป็นเลขกลมๆ หาร 4 ลงตัว เช่น 37,000 → 40,000 */
function niceMax(value) {
  if (!value) return 0;
  const step = Math.pow(10, Math.floor(Math.log10(value / 4)));
  const unit = [1, 2, 2.5, 5, 10].map(m => m * step).find(u => u * 4 >= value);
  return unit * 4;
}

/** ย่อเลขบนแกน เช่น 40000 → 40K */
function shortMoney(n) {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

module.exports = {
  categories, difficulties, asyncRoute, csrf, splitName, parseProfile,
  loadCourses, parseCourse, applySingle, dashboardData, safeJson, money, Client,
};
