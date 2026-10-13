// models/CoursePaymentOrder.js — คำสั่งซื้อคอร์สผ่าน QR PromptPay (Omise)
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:           String,
  buyer:         { type: Number, ref: 'Client', required: true },
  itemType:      { type: String, enum: ['SingleCourse', 'MultiCourse'], required: true },
  itemId:        { type: Number, required: true },
  title:         String,
  amount:        { type: Number, required: true, min: 2000, max: 15000000 },
  currency:      { type: String, default: 'thb' },
  livemode:      { type: Boolean, required: true },
  status:        { type: String, enum: ['creating', 'pending', 'paid', 'failed', 'expired'], default: 'creating' },
  chargeId:      String,
  qrUrl:         String,
  expiresAt:     Date,
  lastCheckedAt: Date,
  activeKey:     String,
}, { timestamps: true });

schema.index({ activeKey: 1 }, { unique: true, sparse: true });
schema.index({ chargeId: 1 }, { unique: true, sparse: true });
schema.index({ buyer: 1, createdAt: -1 });

module.exports = model('CoursePaymentOrder', schema);
