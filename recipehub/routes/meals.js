const express = require('express');
const mealApi = require('../services/mealApiService');
const router = express.Router();

router.get('/search', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query || query.length > 100) return res.status(400).json({ error: 'กรุณาระบุคำค้นหาไม่เกิน 100 ตัวอักษร' });
  try { res.json({ source: 'TheMealDB', meals: await mealApi.search(query) }); }
  catch (_) { res.status(502).json({ error: 'TheMealDB ไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' }); }
});

router.get('/:id', async (req, res) => {
  if (!/^[1-9]\d{0,9}$/.test(req.params.id)) return res.status(400).json({ error: 'รหัสเมนูไม่ถูกต้อง' });
  try {
    const meal = await mealApi.lookup(req.params.id);
    if (!meal) return res.status(404).json({ error: 'ไม่พบเมนู' });
    res.json({ source: 'TheMealDB', meal });
  } catch (_) { res.status(502).json({ error: 'TheMealDB ไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' }); }
});

module.exports = router;
