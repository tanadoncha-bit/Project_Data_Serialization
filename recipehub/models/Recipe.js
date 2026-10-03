const { Schema, model } = require('mongoose');
const autoIncrement = require('./plugins/autoIncrement');

const recipeSchema = new Schema({
  _id:         Number,
  publisher:   { type: Number, ref: 'Client', required: true },
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: null },
  price:       { type: Number, default: 0, min: 0 },
  isFree:      { type: Boolean, default: true },
}, { timestamps: true });

recipeSchema.pre('save', function () {
  this.isFree = this.price === 0;
});
recipeSchema.plugin(autoIncrement, { name: 'recipe' });

module.exports = model('Recipe', recipeSchema);