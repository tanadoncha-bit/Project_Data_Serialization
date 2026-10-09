const {randomBytes}=require('node:crypto');
const Order=require('../models/PaymentOrder'),Transaction=require('../models/Transaction');
const gateway=require('./omiseGateway');
function assertCharge(order,charge){if(charge.object!=='charge'||charge.amount!==order.amount||String(charge.currency).toLowerCase()!=='thb'||charge.livemode!==order.livemode||charge.metadata?.orderId!==order._id||charge.source?.type!=='promptpay'||(order.chargeId&&charge.id!==order.chargeId))throw Object.assign(Error('ข้อมูลการจ่ายเงินไม่ตรงกับคำสั่งซื้อ'),{status:409});}
async function reconcile(order,charge){assertCharge(order,charge);if(order.status==='paid')return order;
 order.chargeId=charge.id;const qr=charge.source?.scannable_code?.image?.download_uri;
 if(qr){const url=new URL(qr);if(url.protocol!=='https:'||url.hostname!=='api.omise.co')throw Error('Invalid QR URL');order.qrUrl=qr;}
 order.expiresAt=charge.expires_at?new Date(charge.expires_at):order.expiresAt;order.lastCheckedAt=new Date();
 if(charge.status==='successful'&&charge.paid===true){const key={buyer:order.buyer,itemType:'Recipe',itemId:order.recipeId},mode=order.livemode?'real':'gateway-test';let tx=await Transaction.findOne(key);if(!tx){try{tx=await Transaction.create({...key,amountPaid:order.amount/100,paymentMode:mode,providerChargeId:charge.id});}catch(error){if(error.code!==11000)throw error;tx=await Transaction.findOne(key);}}
 if(tx&&tx.paymentMode!=='real'&&mode==='real'){tx.amountPaid=order.amount/100;tx.paymentMode='real';tx.providerChargeId=charge.id;await tx.save();}
 order.status='paid';order.activeKey=undefined;
 }else if(['failed','expired'].includes(charge.status)){order.status=charge.status;order.activeKey=undefined;}else if(order.status!=='paid'){order.status='pending';}
 const update={$set:{chargeId:order.chargeId,qrUrl:order.qrUrl,expiresAt:order.expiresAt,lastCheckedAt:order.lastCheckedAt,status:order.status}};if(order.status==='paid'||order.status==='failed'||order.status==='expired')update.$unset={activeKey:1};
 await Order.updateOne({_id:order._id,...(order.status!=='paid'?{status:{$ne:'paid'}}:{})},update);return Order.findById(order._id);
}
async function create(buyer,recipe){const{livemode}=gateway.config();const amount=Math.round(Number(recipe.price)*100);if(!Number.isSafeInteger(amount)||amount<2000||amount>15000000)throw Object.assign(Error('PromptPay รองรับราคา 20–150,000 บาท'),{status:400});const activeKey=buyer+':'+recipe._id+':'+livemode;let order=await Order.findOne({activeKey});if(order){if(order.chargeId)return reconcile(order,await gateway.retrieveCharge(order.chargeId));return order;}
 try{order=await Order.create({_id:randomBytes(16).toString('hex'),buyer,recipeId:recipe._id,title:recipe.title,amount,livemode,activeKey});}catch(error){if(error.code!==11000)throw error;return Order.findOne({activeKey});}
 try{return await reconcile(order,await gateway.createCharge(order));}catch(error){if(error.response?.status>=400&&error.response.status<500){await Order.updateOne({_id:order._id,status:'creating'},{$set:{status:'failed'},$unset:{activeKey:1}});}throw Object.assign(Error('สร้าง QR ไม่สำเร็จ กรุณาตรวจสถานะก่อนลองใหม่'),{status:502});}
}
function view(order){return{id:order._id,recipeId:order.recipeId,title:order.title,amount:order.amount/100,status:order.status,qrUrl:order.qrUrl||null,expiresAt:order.expiresAt,test:!order.livemode};}
module.exports={create,reconcile,assertCharge,view};
