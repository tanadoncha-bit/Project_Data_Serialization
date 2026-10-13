// models/CoursePaymentOrder.js — คำสั่งซื้อคอร์สผ่าน QR PromptPay (Omise)
// โครงเดียวกับ models/PaymentOrder.js ของเพื่อน (ซึ่งรองรับเฉพาะสูตร: recipeId)
// แยกเป็น collection ของคอร์สเอง จะได้ไม่ต้องแก้ model / ระบบจ่ายเงินสูตรของเพื่อน
// จ่ายสำเร็จ → สร้าง Transaction (itemType: SingleCourse | MultiCourse) แบบเดียวกับที่เพื่อนทำกับสูตร
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:           String,                                                  // เลขสุ่ม 32 ตัว (hex)
  buyer:         { type: Number, ref: 'Client', required: true },
  itemType:      { type: String, enum: ['SingleCourse', 'MultiCourse'], required: true },
  itemId:        { type: Number, required: true },
  title:         String,
  amount:        { type: Number, required: true, min: 2000, max: 15000000 }, // สตางค์ (PromptPay รับ 20–150,000 บาท)
  currency:      { type: String, default: 'thb' },
  livemode:      { type: Boolean, required: true },
  status:        { type: String, enum: ['creating', 'pending', 'paid', 'failed', 'expired'], default: 'creating' },
  chargeId:      String,
  qrUrl:         String,
  expiresAt:     Date,
  lastCheckedAt: Date,
  activeKey:     String,                                                  // กันสร้าง QR ซ้ำระหว่างรอจ่าย
}, { timestamps: true });

schema.index({ activeKey: 1 }, { unique: true, sparse: true });
schema.index({ chargeId: 1 }, { unique: true, sparse: true });
schema.index({ buyer: 1, createdAt: -1 });

module.exports = model('CoursePaymentOrder', schema);
