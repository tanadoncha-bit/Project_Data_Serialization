const { Schema, model } = require('mongoose');
const autoIncrement = require('./plugins/autoIncrement');

const videoSchema = new Schema({
  _id:      false,
  videoId:  Number,
  title:    { type: String, required: true },
  videoUrl: { type: String, required: true },
  duration: { type: Number, min: 0 }, 
});

const singleCourseSchema = new Schema({
  _id:                 Number,
  publisher:           { type: Number, ref: 'Client', required: true },
  baseRecipe:          { type: Number, ref: 'Recipe', required: true },
  title:               { type: String, required: true, trim: true },
  detailedInstruction: { type: String, default: null },
  price:               { type: Number, required: true, min: 0 },
  videos: {
    type: [videoSchema],
    validate: [v => v.length > 0, 'A course needs at least 1 video'],
  },
}, { timestamps: true });


singleCourseSchema.pre('save', function () {
  let next = Math.max(0, ...this.videos.map(v => v.videoId || 0)) + 1;
  for (const v of this.videos) if (v.videoId == null) v.videoId = next++;
});
singleCourseSchema.plugin(autoIncrement, { name: 'singleCourse' });

module.exports = model('SingleCourse', singleCourseSchema);