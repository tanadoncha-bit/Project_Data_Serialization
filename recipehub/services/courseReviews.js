const Review = require('../models/RecipeReview');
const types = { single: 'SingleCourse', multi: 'MultiCourse', package: 'MultiCourse' };
async function applyRatings(items) {
 if(!items.length)return items;
 const keys=items.map(c=>({recipeType:types[c.kind || c.type],recipeId:c.id}));
 const stats=await Review.aggregate([{$match:{$or:keys}},{$group:{_id:{type:'$recipeType',id:'$recipeId'},rating:{$avg:'$rating'},count:{$sum:1}}}]);
 const map=new Map(stats.map(r=>[r._id.type+':'+r._id.id,r]));
 return items.map(c=>{const r=map.get(types[c.kind || c.type]+':'+c.id);return {...c,rating:r?.rating ?? null,reviewCount:r?.count || 0};});
}
module.exports={types,applyRatings};
