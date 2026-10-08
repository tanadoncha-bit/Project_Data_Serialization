const { Schema, model } = require('mongoose');
const autoIncrement = require('./plugins/autoIncrement');

const clientSchema = new Schema({
  _id:            Number,
  username:       { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash:   { type: String, required: true },
  name:           { type: String, required: true, trim: true },
  role:           { type: String, enum: ['user', 'chef'], default: 'user' },
  isVerifiedChef: { type: Boolean, default: false },
  certificateUrl: { type: String, default: null },
  bio:            { type: String, trim: true, maxlength: 300, default: '' }, 
  avatar:         { type: String, default: '' }, 
  institution:    { type: String, trim: true, default: null }, 
}, { timestamps: true });

clientSchema.plugin(autoIncrement, { name: 'client' });

module.exports = model('Client', clientSchema);