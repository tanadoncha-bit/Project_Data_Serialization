const { Schema, model } = require('mongoose');
const autoIncrement = require('./plugins/autoIncrement');

const httpUrl = value => !value || /^https?:\/\//i.test(value);

const recipeSchema = new Schema({
  _id:         Number,
  publisher:   { type: Number, ref: 'Client', required: true },
  title:       { type: String, required: true, trim: true, maxlength: 200, alias: 'name' },
  description: { type: String, default: null, maxlength: 10000 },
  category:    { type: String, required: true, trim: true, maxlength: 80 },
  level:       { type: String, enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], default: 'BEGINNER' },
  difficulty:  { type: String, enum: ['EASY', 'MEDIUM', 'HARD'] },
  duration:    { type: Number, default: null, min: 0 },
  rating:      { type: Number, default: null, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0, min: 0 },
  favoriteCount: { type: Number, default: 0, min: 0 },
  image:       { type: String, default: '', maxlength: 2000, validate: httpUrl, alias: 'imageUrl' },
  videoUrl:    { type: String, default: '', maxlength: 2000, validate: httpUrl },
  ingredients: [{ _id: false, name: { type: String, required: true, trim: true, maxlength: 200 }, amount: { type: String, required: true, trim: true, maxlength: 100 } }],
  steps:       [{ _id: false, stepNumber: { type: Number, required: true, min: 1 }, description: { type: String, required: true, trim: true, maxlength: 4000 } }],
  price:       { type: Number, default: 0, min: 0 },
  isFree:      { type: Boolean, default: true },
}, { timestamps: true });

// Keep numeric Client/publisher references compatible with Transaction and the team's models.
recipeSchema.virtual('chef', { ref: 'Client', localField: 'publisher', foreignField: '_id', justOne: true });
recipeSchema.index({ publisher: 1, createdAt: -1 });
recipeSchema.index({ category: 1, difficulty: 1, price: 1 });

recipeSchema.pre('save', function () {
  this.isFree = this.price === 0;
});
recipeSchema.plugin(autoIncrement, { name: 'recipe' });

module.exports = model('Recipe', recipeSchema);
