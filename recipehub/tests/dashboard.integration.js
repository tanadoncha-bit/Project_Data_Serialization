const assert=require('node:assert/strict'),mongoose=require('mongoose'),{MongoMemoryServer}=require('mongodb-memory-server'),ejs=require('ejs');
const {loadDashboard}=require('../services/chefDashboard');let db;
(async()=>{
 db=await MongoMemoryServer.create();await mongoose.connect(db.getUri());
 const Client=require('../models/Client'),Recipe=require('../models/Recipe'),Single=require('../models/SingleCourse'),Multi=require('../models/MultiCourse'),Transaction=require('../models/Transaction'),Review=require('../models/RecipeReview');
 await Client.collection.insertMany([{_id:1,name:'Chef',bio:'Bio',isVerifiedChef:true},{_id:2,name:'Buyer',email:'buyer@example.test'},{_id:3,name:'Other chef'},{_id:4,name:'Empty chef'}]);
 await Recipe.collection.insertMany([{_id:10,publisher:1,title:'My recipe'},{_id:11,publisher:3,title:'Other recipe'}]);
 await Single.collection.insertMany([{_id:10,publisher:1,title:'My course',baseRecipe:10,price:200},{_id:11,publisher:3,title:'Other course',baseRecipe:11,price:999}]);
 await Multi.collection.insertOne({_id:10,publisher:1,title:'My bundle',includedCourses:[10],price:300});
 await Transaction.collection.insertMany([
 {buyer:2,itemType:'Recipe',itemId:10,amountPaid:100,paymentMode:'real',purchasedAt:new Date('2026-10-12T18:00:00Z')},
 {buyer:2,itemType:'SingleCourse',itemId:10,amountPaid:200,paymentMode:'real',purchasedAt:new Date('2026-10-12T16:00:00Z')},
 {buyer:2,itemType:'MultiCourse',itemId:10,amountPaid:300,paymentMode:'real',purchasedAt:new Date('2026-10-04T18:00:00Z')},
 {buyer:2,itemType:'SingleCourse',itemId:11,amountPaid:999,paymentMode:'real',purchasedAt:new Date()},
 {buyer:99,itemType:'Recipe',itemId:10,amountPaid:500,paymentMode:'demo',purchasedAt:new Date()},
 {buyer:98,itemType:'Recipe',itemId:10,amountPaid:500,paymentMode:'gateway-test',purchasedAt:new Date()}]);
 await Review.collection.insertMany([{client:2,recipeType:'Recipe',recipeId:10,rating:5},{client:3,recipeType:'Recipe',recipeId:10,rating:3},{recipeType:'Recipe',recipeId:11,rating:1},{recipeType:'ExternalRecipe',recipeId:10,rating:1}]);
 const data=await loadDashboard(1,new Date('2026-10-13T10:00:00Z'));
 assert.equal(data.stats[0][2].split(' ')[0],'2');assert.equal(data.stats[1][2].split(' ')[0],'1');assert.equal(data.stats[2][2].split(' ')[0],'1');assert(data.stats[3][2].endsWith('600'));
 assert.equal(data.orders.length,3);assert.equal(data.topRecipe.rating,4);assert.equal(data.topRecipe.reviews,2);assert.equal(data.periods.current[6].value,100);assert.equal(data.periods.current[5].value,200);assert.equal(data.periods.previous.reduce((n,d)=>n+d.value,0),300);
 assert(data.popular.title.startsWith('My'));assert.equal(data.chef.isVerifiedChef,true);
 for(const d of [data,await loadDashboard(4)]){const html=await new Promise((r,j)=>ejs.renderFile('views/chef/dashboard.ejs',{...d,title:'Dashboard',active:'dashboard',currentUser:{role:'chef',name:'Chef'}},(e,h)=>e?j(e):r(h)));assert(html.includes('dashboard-data'));if(!d.orders.length){assert.equal(d.popular,null);assert.equal(d.topRecipe,null);assert(d.stats[3][2].endsWith('0'));}}
 console.log('PASS: real sales, chef isolation, item type collisions, unique buyers, Bangkok dates, reviews, populated/empty rendering');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await mongoose.disconnect();if(db)await db.stop();});
