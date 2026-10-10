const express=require('express');const gateway=require('../services/omiseGateway'),orders=require('../services/promptpayOrders'),Order=require('../models/PaymentOrder');
const router=express.Router();
router.post('/',async(req,res)=>{try{
 let event;
 if(process.env.OMISE_WEBHOOK_SECRET){if(!gateway.verifySignature(req))return res.sendStatus(401);event=req.body;}
 else{if(!/^evnt_[a-zA-Z0-9_]+$/.test(req.body?.id||''))return res.sendStatus(401);event=await gateway.retrieveEvent(req.body.id);}
 if(!['charge.complete','charge.create'].includes(event.key))return res.sendStatus(200);
 const chargeId=event.data?.id;if(!/^chrg_[a-zA-Z0-9_]+$/.test(chargeId||''))return res.sendStatus(400);
 const charge=await gateway.retrieveCharge(chargeId);const order=await Order.findOne({_id:charge.metadata?.orderId});if(!order)return res.sendStatus(200);
 await orders.reconcile(order,charge);return res.sendStatus(200);
 }catch(error){return res.sendStatus(error.status===409?400:503);}
});module.exports=router;
