const paymentPolicy = require('../services/paymentPolicy');
const router = require('express').Router();
const Recipe = require('../models/Recipe');
const SingleCourse = require('../models/SingleCourse');
const MultiCourse = require('../models/MultiCourse');
const Transaction = require('../models/Transaction');
const Review = require('../models/RecipeReview');
router.get('/', async (req, res, next) => {
  if (!req.user) return res.status(401).json({message:'กรุณาเข้าสู่ระบบ'});
  res.set('Cache-Control','private, no-store');
  try {
    const userId = req.user._id;
    const groups = await Promise.all([Recipe, SingleCourse, MultiCourse].map(model => model.find({publisher:userId}).select('_id title').lean()));
    const types = ['Recipe','SingleCourse','MultiCourse'];
    const subjects = new Map();
    groups.forEach((group,index) => group.forEach(item => subjects.set(types[index]+':'+item._id,{title:item.title,url:index===0?'/chef/recipes/'+item._id:'/chef/courses/'+(index===1?'single':'package')+'/'+item._id})));
    if (!subjects.size) return res.json({userId,items:[]});
    const matches = groups.map((group,index)=>({itemType:types[index],itemId:{$in:group.map(item=>item._id)}}));
    const purchases = await Transaction.find({$or:matches,...paymentPolicy.accessFilter()}).sort({purchasedAt:-1}).limit(20).populate('buyer','name avatar').lean();
    const reviews = await Review.find({client:{$ne:userId},$or:groups.map((group,index)=>({recipeType:types[index],recipeId:{$in:group.map(item=>item._id)}}))}).sort({updatedAt:-1}).limit(20).populate('client','name avatar').lean();
    const items = purchases.map(item=>{
      const subject=subjects.get(item.itemType+':'+item.itemId);
      return {id:'purchase:'+item._id,title:'มีรายการซื้อใหม่',message:(item.buyer?.name||'ผู้เรียน')+' ซื้อ '+subject.title,date:item.purchasedAt,url:subject.url,avatar:item.buyer?.avatar||''};
    }).concat(reviews.map(item=>{
      const subject=subjects.get(item.recipeType+':'+item.recipeId);
      return {id:'review:'+item._id+':'+new Date(item.updatedAt||item.createdAt).getTime(),title:'มีรีวิวใหม่',message:(item.client?.name||'ผู้เรียน')+' ให้ '+item.rating+' ดาว · '+subject.title,date:item.updatedAt||item.createdAt,url:subject.url,avatar:item.client?.avatar||''};
    })).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,20);
    res.json({userId,items});
  } catch(error) { next(error); }
});
module.exports = router;
