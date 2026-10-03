const { Schema, model } = require('mongoose');
const autoIncrement = require('./plugins/autoIncrement');

const multiCourseSchema = new Schema({
  _id:         Number,
  publisher:   { type: Number, ref: 'Client', required: true },
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: null },
  price:       { type: Number, required: true, min: 0 },
  includedCourses: {
    type: [{ type: Number, ref: 'SingleCourse' }],
    validate: [v => v.length > 0, 'A bundle needs at least 1 course'],
  },
}, { timestamps: true });

multiCourseSchema.plugin(autoIncrement, { name: 'multiCourse' });

module.exports = model('MultiCourse', multiCourseSchema);