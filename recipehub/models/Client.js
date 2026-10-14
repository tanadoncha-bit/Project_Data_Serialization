const { Schema, model } = require('mongoose');
const autoIncrement = require('./plugins/autoIncrement');

const clientSchema = new Schema({
  _id:            Number,
  username:       { type: String, unique: true, sparse: true, trim: true },
  email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash:   { type: String, required: true },
  name:           { type: String, required: true, trim: true },
  role:           { type: String, enum: ['user', 'chef'], default: 'user' },
  isVerifiedChef: { type: Boolean, default: false },
  certificateUrl: { type: String, default: null },
  bio:            { type: String, trim: true, maxlength: 300, default: '' }, 
  avatar:         { type: String, default: '' }, 
  institution:    { type: String, trim: true, default: null }, 
  emailVerified:  { type: Boolean, default: false },
  pendingEmail:   { type: String, lowercase: true, trim: true, default: null },
  verifyToken:    { type: String, default: null },
  verifyExpires:  { type: Date, default: null },
  resetToken:     { type: String, default: null },
  resetExpires:   { type: Date, default: null },
  mailSentAt:     { type: Date, default: null },
}, { timestamps: true });

clientSchema.pre('validate', function () { this.isVerifiedChef = this.role === 'chef' && Boolean(this.institution?.trim()); });

clientSchema.plugin(autoIncrement, { name: 'client' });

module.exports = model('Client', clientSchema);