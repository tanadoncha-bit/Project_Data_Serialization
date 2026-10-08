// routes/profile.js — หน้าโปรไฟล์ (ผู้เรียนและเชฟใช้หน้าเดียวกัน เชฟมีช่องสถาบันเพิ่ม)
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Client = require('../models/Client');
const Favorite = require('../models/Favorite');
const Transaction = require('../models/Transaction');
const Recipe = require('../models/Recipe');
const SingleCourse = require('../models/SingleCourse');
const MultiCourse = require('../models/MultiCourse');
const { requireLogin } = require('../middleware/requireRole');

const router = express.Router();
router.use(requireLogin);

const AVATAR_DIR = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

/** ตั้งค่า multer: เก็บรูปใน public/uploads/avatars ชื่อไฟล์ = id ผู้ใช้-เวลา.นามสกุล รับเฉพาะรูป ไม่เกิน 2MB */
const upload = multer({
  storage: multer.diskStorage({
    destination: AVATAR_DIR,
    filename: (req, file, cb) => cb(null, `${req.user._id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)),
});

const itemModels = { Recipe, SingleCourse, MultiCourse };
const itemLabels = { Recipe: 'สูตรอาหาร', SingleCourse: 'คอร์สเรียน', MultiCourse: 'แพ็กคอร์ส' };

/** แปลงรายการ { itemType, itemId } เป็นข้อมูลที่ใช้แสดง (ชื่อ ราคา รูป ลิงก์) ตัดรายการที่ถูกลบไปแล้วทิ้ง */
async function loadItems(rows) {
  const items = await Promise.all(rows.map(async (row) => {
    const doc = await itemModels[row.itemType].findById(row.itemId).lean();
    if (!doc) return null;
    return {
      type: row.itemType,
      label: itemLabels[row.itemType],
      title: doc.title,
      image: doc.image || '',
      price: row.amountPaid ?? doc.price ?? 0,
      date: row.purchasedAt || row.createdAt,
      url: row.itemType === 'Recipe' ? `/recipes/${doc._id}` : `/courses/${doc._id}`,
    };
  }));
  return items.filter(Boolean);
}

/** ดึงข้อมูลทั้งหมดของหน้าโปรไฟล์ แล้ว render (ใช้ทั้งตอนเปิดหน้าและตอนบันทึกไม่ผ่าน) */
async function renderProfile(req, res, { form, error, saved, status = 200 } = {}) {
  const user = await Client.findById(req.user._id).lean();
  const isChef = user.role === 'chef';

  const favorites = isChef ? [] : await loadItems(await Favorite.find({ client: user._id }).sort({ createdAt: -1 }).lean());
  const purchases = isChef ? [] : await loadItems(await Transaction.find({ buyer: user._id }).sort({ purchasedAt: -1 }).lean());

  res.status(status).render('profile', {
    title: 'โปรไฟล์',
    active: '',
    user,
    form: form || user,
    isChef,
    favorites,
    purchases,
    error,
    saved,
  });
}


router.get('/', async (req, res, next) => {
  try {
    await renderProfile(req, res, { saved: req.query.saved === '1' });
  } catch (err) {
    next(err);
  }
});


router.post('/', async (req, res, next) => {
  try {
    const form = {
      name: String(req.body.name || '').trim(),
      username: String(req.body.username || '').trim().toLowerCase(),
      email: String(req.body.email || '').trim().toLowerCase(),
      bio: String(req.body.bio || '').trim(),
      institution: String(req.body.institution || '').trim(),
    };
    const isChef = req.user.role === 'chef';
    const others = { _id: { $ne: req.user._id } }; // ไม่นับตัวเองตอนเช็คซ้ำ

    let error = null;
    if (!form.name || !form.username || !form.email) error = 'กรุณากรอกชื่อ, username และอีเมล';
    else if (!/^[a-z0-9_]{3,20}$/.test(form.username)) error = 'username ต้องเป็น a-z, 0-9 หรือ _ ยาว 3–20 ตัว';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) error = 'รูปแบบอีเมลไม่ถูกต้อง';
    else if (form.bio.length > 300) error = 'แนะนำตัวได้ไม่เกิน 300 ตัวอักษร';
    else if (isChef && !form.institution) error = 'กรุณาระบุสถาบันการทำอาหาร';
    else if (await Client.exists({ ...others, username: form.username })) error = 'username นี้ถูกใช้แล้ว';
    else if (await Client.exists({ ...others, email: form.email })) error = 'อีเมลนี้ถูกใช้แล้ว';
    if (error) return renderProfile(req, res, { form, error, status: 400 });

    const update = { name: form.name, username: form.username, email: form.email, bio: form.bio };
    if (isChef) update.institution = form.institution;
    await Client.updateOne({ _id: req.user._id }, update);


    res.redirect('/profile?saved=1');
  } catch (err) {
    next(err);
  }
});


router.post('/avatar', (req, res, next) => {
  upload.single('avatar')(req, res, async (err) => {
    try {
      if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'รูปต้องไม่เกิน 2MB' });
      if (err) return next(err);
      if (!req.file) return res.status(400).json({ error: 'รองรับเฉพาะไฟล์รูป jpg, png, gif, webp' });

      const avatar = `/uploads/avatars/${req.file.filename}`;
      const old = await Client.findByIdAndUpdate(req.user._id, { avatar }).select('avatar').lean();

  
      if (old && old.avatar && old.avatar.startsWith('/uploads/avatars/')) {
        fs.unlink(path.join(AVATAR_DIR, path.basename(old.avatar)), () => {});
      }
      res.json({ avatar });
    } catch (e) {
      next(e);
    }
  });
});

module.exports = router;
