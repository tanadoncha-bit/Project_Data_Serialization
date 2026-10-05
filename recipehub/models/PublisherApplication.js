const { Schema, model } = require('mongoose');
const autoIncrement = require('./plugins/autoIncrement');

const applicationSchema = new Schema({
  _id:            Number,
  client:         { type: Number, ref: 'Client', required: true, unique: true },
  certificateUrl: { type: String, required: true },
  status:         { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  submittedAt:    { type: Date, default: Date.now },
});

applicationSchema.plugin(autoIncrement, { name: 'publisherApplication' });

module.exports = model('PublisherApplication', applicationSchema);