const { Schema, model } = require('mongoose');
const autoIncrement = require('./plugins/autoIncrement');

const transactionSchema = new Schema({
  _id:        Number,
  buyer:      { type: Number, ref: 'Client', required: true },
  itemType:   { type: String, enum: ['Recipe', 'SingleCourse', 'MultiCourse'], required: true },
  itemId:     { type: Number, refPath: 'itemType', required: true },
  amountPaid: { type: Number, required: true, min: 0 },
}, { timestamps: { createdAt: 'purchasedAt', updatedAt: false } });

transactionSchema.index({ buyer: 1, itemType: 1, itemId: 1 }, { unique: true }); 
transactionSchema.plugin(autoIncrement, { name: 'transaction' });

module.exports = model('Transaction', transactionSchema);