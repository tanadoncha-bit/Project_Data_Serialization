const express=require('express');
const {randomBytes}=require('node:crypto');
const mongoose=require('mongoose');
const service=require('../services/cookhubAssistant');
const router=express.Router();
const buckets=new Map();let total={time:Date.now(),count:0},active=0;
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/config',(req,res)=>{
 if(!req.session)return res.status(503).json({error:'ระบบ session ไม่พร้อมใช้งาน'});
 req.session.assistantCsrf=req.session.assistantCsrf||randomBytes(24).toString('hex');
 res.json({ready:service.configured(),csrf:req.session.assistantCsrf});
});
router.post('/chat',async(req,res)=>{
 if(!req.session?.assistantCsrf||req.get('X-CSRF-Token')!==req.session.assistantCsrf)return res.status(403).json({error:'กรุณาปิดแล้วเปิดผู้ช่วยใหม่'});
 const message=req.body?.message, history=req.body?.history || [];
 if(typeof message!=='string'||!message.trim()||message.length>1000||!Array.isArray(history)||history.length>8||history.some(item=>!item||!['user','assistant'].includes(item.role)||typeof item.content!=='string'||item.content.length>1500))return res.status(400).json({error:'ข้อความต้องไม่เกิน 1,000 ตัวอักษร'});
 if(!service.configured())return res.status(503).json({error:'ผู้ช่วยยังไม่พร้อมใช้งาน กรุณาตั้งค่า KKU_AI_API_KEY ที่เซิร์ฟเวอร์'});
 if(mongoose.connection.readyState!==1)return res.status(503).json({error:'ข้อมูลสูตรยังไม่พร้อมใช้งาน กรุณาลองใหม่'});
 const now=Date.now();for(const [key,bucket]of buckets)if(now-bucket.time>60000)buckets.delete(key);
 const key=req.ip;const bucket=buckets.get(key)||{time:now,count:0};if(now-total.time>60000)total={time:now,count:0};
 if(bucket.count>=8||total.count>=60||active>=4)return res.status(429).json({error:'มีคำถามเข้ามาหลายรายการ กรุณารอสักครู่แล้วลองใหม่'});
 bucket.count++;buckets.set(key,bucket);total.count++;active++;
 try{const items=await service.catalogue(message, req.user);res.json(await service.answer(message.trim(),history.map(item=>({role:item.role,content:item.content})),items));}
 catch(error){res.status(error.status||503).json({error:error.status?error.message:'โหลดข้อมูลคำแนะนำไม่สำเร็จ กรุณาลองใหม่'});}
 finally{active--;}
});
module.exports=router;
