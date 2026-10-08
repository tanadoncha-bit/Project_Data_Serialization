const { Schema, model } = require('mongoose');
const autoIncrement = require('./plugins/autoIncrement');


const favoriteSchema = new Schema({
  _id:      Number,
  client:   { type: Number, ref: 'Client', required: true },
  itemType: { type: String, enum: ['Recipe', 'SingleCourse', 'MultiCourse'], required: true },
  itemId:   { type: Number, refPath: 'itemType', required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

// กดโปรดรายการเดิมซ้ำไม่ได้เด้อ
favoriteSchema.index({ client: 1, itemType: 1, itemId: 1 }, { unique: true });
favoriteSchema.plugin(autoIncrement, { name: 'favorite' });

module.exports = model('Favorite', favoriteSchema);
