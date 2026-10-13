// services/coursePayments.js — ซื้อคอร์ส (ทำตามระบบซื้อสูตรของเพื่อน)
//   มี Omise key (OMISE_SECRET_KEY)          → จ่ายด้วย QR PromptPay  (เหมือน routes/promptpay.js + services/promptpayOrders.js)
//   ไม่มี key + RECIPE_DEMO_PAYMENTS=true     → ซื้อจำลอง               (เหมือน /recipes/checkout/:id)
//   ไม่มีทั้งสองอย่าง                           → ยังไม่เปิดระบบซื้อ (503)
// ใช้ services/omiseGateway.js และ assertCharge() ของเพื่อนตามเดิม (เรียกใช้เท่านั้น ไม่ได้แก้)
const { randomBytes } = require('node:crypto');
const gateway = require('./omiseGateway');
const { assertCharge } = require('./promptpayOrders');
const Order = require('../models/CoursePaymentOrder');
const Transaction = require('../models/Transaction');
const SingleCourse = require('../models/SingleCourse');
const MultiCourse = require('../models/MultiCourse');

const ITEM_TYPE = { single: 'SingleCourse', multi: 'MultiCourse' };
const watchUrl = (kind, id) => (kind === 'multi' ? '/courses/pack/' : '/courses/') + id;

const demoEnabled = () => process.env.RECIPE_DEMO_PAYMENTS === 'true' && process.env.NODE_ENV !== 'production';

// production ไม่นับการซื้อจำลอง/ทดสอบ (กติกาเดียวกับหน้าสูตรของเพื่อน routes/recipes.js)
const accessFilter = () => (process.env.NODE_ENV === 'production' ? { paymentMode: { $nin: ['demo', 'gateway-test'] } } : {});

/** คอร์สที่จะซื้อ: { _id, title, price, publisher } หรือ null */
async function findCourse(kind, id) {
  if (kind === 'single') return SingleCourse.findById(id).select('title price publisher').lean();
  if (kind === 'multi') return MultiCourse.findById(id).select('title price publisher').lean();
  return null;
}

/** มีสิทธิ์ดูคอร์สนี้แล้วหรือยัง  → { purchased, isOwner, canWatch } */
async function access(buyer, kind, course) {
  const isOwner = Boolean(buyer && course.publisher === buyer);
  let purchased = false;
  if (buyer) {
    purchased = Boolean(await Transaction.exists({ buyer, itemType: ITEM_TYPE[kind], itemId: course._id, ...accessFilter() }));
    // คอร์สเดี่ยวที่อยู่ในแพ็กที่ซื้อแล้ว → ดูได้ด้วย
    if (!purchased && kind === 'single') {
      const packIds = (await MultiCourse.find({ includedCourses: course._id }).select('_id').lean()).map(p => p._id);
      if (packIds.length) {
        purchased = Boolean(await Transaction.exists({ buyer, itemType: 'MultiCourse', itemId: { $in: packIds }, ...accessFilter() }));
      }
    }
  }
  return { purchased, isOwner, canWatch: purchased || isOwner || Number(course.price) === 0 };
}

/** ซื้อจำลอง → บันทึก Transaction paymentMode 'demo' */
async function demoPurchase(buyer, kind, course) {
  const key = { buyer, itemType: ITEM_TYPE[kind], itemId: course._id };
  if (await Transaction.exists(key)) return;
  try { await Transaction.create({ ...key, amountPaid: course.price, paymentMode: 'demo' }); }
  catch (error) { if (error.code !== 11000) throw error; }
}

/* ------------------------------------------------ QR PromptPay (Omise) */

const activeKeyFor = (buyer, kind, id, livemode) => [buyer, ITEM_TYPE[kind], id, livemode].join(':');

/** ตรวจสถานะจาก Omise แล้วอัปเดตคำสั่งซื้อ (โครงเดียวกับ reconcile() ใน promptpayOrders.js ของเพื่อน) */
async function reconcile(order, charge) {
  assertCharge(order, charge);
  if (order.status === 'paid') return order;

  order.chargeId = charge.id;
  const qr = charge.source && charge.source.scannable_code && charge.source.scannable_code.image && charge.source.scannable_code.image.download_uri;
  if (qr) {
    const url = new URL(qr);
    if (url.protocol !== 'https:' || url.hostname !== 'api.omise.co') throw Error('Invalid QR URL');
    order.qrUrl = qr;
  }
  order.expiresAt = charge.expires_at ? new Date(charge.expires_at) : order.expiresAt;
  order.lastCheckedAt = new Date();

  if (charge.status === 'successful' && charge.paid === true) {
    const key = { buyer: order.buyer, itemType: order.itemType, itemId: order.itemId };
    const mode = order.livemode ? 'real' : 'gateway-test';
    let tx = await Transaction.findOne(key);
    if (!tx) {
      try { tx = await Transaction.create({ ...key, amountPaid: order.amount / 100, paymentMode: mode, providerChargeId: charge.id }); }
      catch (error) { if (error.code !== 11000) throw error; tx = await Transaction.findOne(key); }
    }
    if (tx && tx.paymentMode !== 'real' && mode === 'real') {
      tx.amountPaid = order.amount / 100; tx.paymentMode = 'real'; tx.providerChargeId = charge.id; await tx.save();
    }
    order.status = 'paid';
  } else if (['failed', 'expired'].includes(charge.status)) {
    order.status = charge.status;
  } else if (order.status !== 'paid') {
    order.status = 'pending';
  }

  const update = { $set: { chargeId: order.chargeId, qrUrl: order.qrUrl, expiresAt: order.expiresAt, lastCheckedAt: order.lastCheckedAt, status: order.status } };
  if (['paid', 'failed', 'expired'].includes(order.status)) update.$unset = { activeKey: 1 };
  await Order.updateOne({ _id: order._id, ...(order.status !== 'paid' ? { status: { $ne: 'paid' } } : {}) }, update);
  return Order.findById(order._id);
}

/** คำสั่งซื้อที่ยังรอจ่ายอยู่ (ถ้ามี) — ใช้ตอนเปิดหน้าต่างจ่ายเงินซ้ำ */
async function activeOrder(buyer, kind, id) {
  const { livemode } = gateway.config();
  let order = await Order.findOne({ activeKey: activeKeyFor(buyer, kind, id, livemode) });
  if (order && order.chargeId) order = await reconcile(order, await gateway.retrieveCharge(order.chargeId));
  return order && ['creating', 'pending'].includes(order.status) ? order : null;
}

/** สร้าง QR (ถ้ามีคำสั่งซื้อที่ยังรอจ่ายอยู่ ใช้อันเดิม) */
async function createOrder(buyer, kind, course) {
  const { livemode } = gateway.config();
  const amount = Math.round(Number(course.price) * 100);
  if (!Number.isSafeInteger(amount) || amount < 2000 || amount > 15000000) {
    throw Object.assign(Error('PromptPay รองรับราคา 20–150,000 บาท'), { status: 400 });
  }
  const activeKey = activeKeyFor(buyer, kind, course._id, livemode);
  let order = await Order.findOne({ activeKey });
  if (order) return order.chargeId ? reconcile(order, await gateway.retrieveCharge(order.chargeId)) : order;

  try {
    order = await Order.create({ _id: randomBytes(16).toString('hex'), buyer, itemType: ITEM_TYPE[kind], itemId: course._id, title: course.title, amount, livemode, activeKey });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Order.findOne({ activeKey });
  }
  try {
    // createCharge() ของเพื่อนใช้ field recipeId แค่เขียนคำอธิบายรายการใน Omise
    const charge = await gateway.createCharge({ _id: order._id, amount: order.amount, recipeId: 'course ' + order.itemType + ' ' + order.itemId });
    return await reconcile(order, charge);
  } catch (error) {
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
      await Order.updateOne({ _id: order._id, status: 'creating' }, { $set: { status: 'failed' }, $unset: { activeKey: 1 } });
    }
    throw Object.assign(Error('สร้าง QR ไม่สำเร็จ กรุณาตรวจสถานะก่อนลองใหม่'), { status: 502 });
  }
}

/** ตรวจสถานะคำสั่งซื้อ (หน้าเว็บถามทุก 5 วินาที) */
async function checkOrder(buyer, orderId) {
  let order = await Order.findOne({ _id: orderId, buyer });
  if (!order) return null;
  if (order.status !== 'paid' && order.chargeId && (!order.lastCheckedAt || Date.now() - order.lastCheckedAt.getTime() > 5000)) {
    order = await reconcile(order, await gateway.retrieveCharge(order.chargeId));
  }
  return order;
}

function view(order) {
  const kind = order.itemType === 'MultiCourse' ? 'multi' : 'single';
  return {
    id: order._id, kind, itemId: order.itemId, title: order.title, amount: order.amount / 100,
    status: order.status, qrUrl: order.qrUrl || null, expiresAt: order.expiresAt, test: !order.livemode,
    url: watchUrl(kind, order.itemId),
  };
}

module.exports = { ITEM_TYPE, watchUrl, demoEnabled, findCourse, access, demoPurchase, activeOrder, createOrder, checkOrder, view };
