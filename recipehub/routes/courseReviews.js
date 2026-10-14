const express=require('express');
const {randomBytes}=require('node:crypto');
const Review=require('../models/RecipeReview');
const Client=require('../models/Client');
const support=require('../services/recipeSupport');
const payments=require('../services/coursePayments');
const {types}=require('../services/courseReviews');
const router=express.Router();
router.use(support.databaseReady);
router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
router.use('/:kind/:id',support.asyncRoute(async(req,res,next)=>{
 if(!['single','multi'].includes(req.params.kind))return res.status(400).json({error:'ประเภทคอร์สไม่ถูกต้อง'});
 const id=support.numericId(req.params.id);if(!id)return res.status(400).json({error:'รหัสคอร์สไม่ถูกต้อง'});
 const course=await payments.findCourse(req.params.kind,id);if(!course)return res.status(404).json({error:'ไม่พบคอร์ส'});
 req.courseReview={course,key:{recipeType:types[req.params.kind],recipeId:id},client:support.numericId(req.user?._id || req.session?.userId)};next();
}));
async function render(req,res){
 const {course,key,client}=req.courseReview;
 const [rows,stats,mine,rights]=await Promise.all([Review.find(key).sort({updatedAt:-1}).limit(30).populate('client','name avatar').lean(),Review.aggregate([{$match:key},{$group:{_id:null,rating:{$avg:'$rating'},count:{$sum:1}}}]),client?Review.findOne({...key,client}).lean():null,payments.access(client,req.params.kind,course)]);
 if(client && req.session)req.session.reviewCsrf=req.session.reviewCsrf || randomBytes(32).toString('hex');
 res.render('user/recipes/_reviews',{rows,summary:stats[0] || {rating:0,count:0},mine,isRecipeOwner:rights.isOwner,reviewClient:client,reviewBlocked:!!client && !rights.purchased,reviewSubject:'คอร์ส',reviewToken:req.session?.reviewCsrf || '',reviewPath:'/api/course-reviews/'+req.params.kind+'/'+course._id});
}
router.get('/:kind/:id',support.asyncRoute(render));
router.use('/:kind/:id',support.asyncRoute(async(req,res,next)=>{
 const {client,course}=req.courseReview;if(!client || !await Client.exists({_id:client}))return res.status(401).json({error:'กรุณาเข้าสู่ระบบก่อนรีวิว'});
 if(!req.session?.reviewCsrf || req.get('X-CSRF-Token')!==req.session.reviewCsrf)return res.status(403).json({error:'ฟอร์มหมดอายุ กรุณาเปิดหน้าใหม่'});
 const rights=await payments.access(client,req.params.kind,course);
 if(rights.isOwner)return res.status(403).json({error:'เจ้าของคอร์สไม่สามารถรีวิวคอร์สของตัวเองได้'});
 if(!rights.purchased)return res.status(403).json({error:'เฉพาะผู้ซื้อคอร์สนี้เท่านั้นที่รีวิวได้'});
 next();
}));
router.put('/:kind/:id',support.asyncRoute(async(req,res)=>{
 const rating=Number(req.body.rating),comment=req.body.comment;
 if(!Number.isInteger(rating)||rating<1||rating>5||typeof comment!=='string'||comment.length>2000)return res.status(400).json({error:'เลือกคะแนน 1–5 และข้อความไม่เกิน 2,000 ตัวอักษร'});
 const key={...req.courseReview.key,client:req.courseReview.client};
 let row=await Review.findOne(key);if(row){row.rating=rating;row.comment=comment;await row.save();}else{try{await Review.create({...key,rating,comment});}catch(e){if(e.code!==11000)throw e;await Review.updateOne(key,{$set:{rating,comment}},{runValidators:true});}}
 await render(req,res);
}));
router.delete('/:kind/:id',support.asyncRoute(async(req,res)=>{await Review.deleteOne({...req.courseReview.key,client:req.courseReview.client});await render(req,res);}));
module.exports=router;
