const { Schema, model } = require('mongoose');
const autoIncrement = require('./plugins/autoIncrement');
const schema = new Schema({ _id: Number, client: { type: Number, ref: 'Client', required: true }, recipeType: { type: String, enum: ['Recipe', 'ExternalRecipe'], required: true }, recipeId: { type: Number, required: true }, rating: { type: Number, min: 1, max: 5, required: true }, comment: { type: String, trim: true, maxlength: 2000, default: '' } }, { timestamps: true });
schema.index({ client: 1, recipeType: 1, recipeId: 1 }, { unique: true });
schema.plugin(autoIncrement, { name: 'recipeReview' });
module.exports = model('RecipeReview', schema);
