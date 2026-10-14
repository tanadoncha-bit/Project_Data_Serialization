const mongoose = require('mongoose');
const Client = require('../models/Client');
const Recipe = require('../models/Recipe');
const SingleCourse = require('../models/SingleCourse');
const MultiCourse = require('../models/MultiCourse');
const Transaction = require('../models/Transaction');
const RecipeReview = require('../models/RecipeReview');
const dateKey = date => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Bangkok', year:'numeric', month:'2-digit', day:'2-digit' }).format(date);
const money = value => value.toLocaleString('th-TH', { maximumFractionDigits:2 });

async function loadDashboard(publisher, now = new Date()) {
  if (mongoose.connection.readyState !== 1) {
    const error = new Error('ไม่สามารถโหลด Dashboard ได้ในขณะนี้ กรุณาลองใหม่เมื่อเชื่อมต่อฐานข้อมูลได้');
    error.status = 503;
    throw error;
  }
  const [chef, recipes, singles, bundles] = await Promise.all([
    Client.findById(publisher).select('name avatar bio role institution isVerifiedChef').lean(),
    Recipe.find({publisher}).select('title image createdAt price').lean(),
    SingleCourse.find({publisher}).select('title baseRecipe price createdAt').lean(),
    MultiCourse.find({publisher}).select('title includedCourses price createdAt').lean()
  ]);
  if (!chef) {
    const error = new Error('ไม่พบบัญชีเชฟ');
    error.status = 404;
    throw error;
  }
  chef.isVerifiedChef = chef.role === 'chef' && Boolean(chef.institution?.trim());
  const recipeMap = new Map(recipes.map(r => [r._id,r]));
  const singleMap = new Map(singles.map(c => [c._id,c]));
  const courses = [...singles.map(c => ({...c,type:'SingleCourse',image:recipeMap.get(c.baseRecipe)?.image || ''})), ...bundles.map(c => ({...c,type:'MultiCourse',image:recipeMap.get(singleMap.get(c.includedCourses[0])?.baseRecipe)?.image || ''}))];
  const courseMap = new Map(courses.map(c => [c.type+':'+c._id,c]));
  const [accessTransactions, reviews] = await Promise.all([
    Transaction.find({...(process.env.NODE_ENV === 'production' ? {paymentMode:{$nin:['demo','gateway-test']}} : {}),$or:[{itemType:'Recipe',itemId:{$in:recipes.map(r=>r._id)}},{itemType:'SingleCourse',itemId:{$in:singles.map(c=>c._id)}},{itemType:'MultiCourse',itemId:{$in:bundles.map(c=>c._id)}}]}).sort({purchasedAt:-1}).lean(),
    RecipeReview.aggregate([{$match:{recipeType:'Recipe',recipeId:{$in:recipes.map(r=>r._id)}}},{$group:{_id:'$recipeId',count:{$sum:1},rating:{$avg:'$rating'},total:{$sum:'$rating'}}}])
  ]);
  const transactions = accessTransactions;
  const hasTestPurchases = transactions.some(t => t.paymentMode !== 'real');
  const dataNote = hasTestPurchases ? 'แสดงรายการซื้อรวมโหมดทดสอบ/จำลอง ยอดดังกล่าวไม่ใช่รายได้จริงทั้งหมด' : 'แสดงรายการซื้อและยอดชำระเงินจริง';
  const courseSales = accessTransactions.filter(t=>t.itemType!=='Recipe');
  const buyers = new Set(courseSales.map(t=>t.buyer));
  const reviewCount = reviews.reduce((n,r)=>n+r.count,0);
  const average = reviewCount ? reviews.reduce((n,r)=>n+r.total,0)/reviewCount : null;
  const monthStart = new Date(dateKey(now).slice(0,7)+'-01T00:00:00+07:00');
  const newCourses = courses.filter(c=>c.createdAt && c.createdAt >= monthStart && c.createdAt <= now).length;
  const [year, month] = dateKey(now).slice(0,7).split('-').map(Number);
  const previousMonthStart = new Date(Date.UTC(year, month-2, 1)-7*60*60*1000);
  const currentBuyers = new Set(courseSales.filter(t=>t.purchasedAt >= monthStart && t.purchasedAt <= now).map(t=>t.buyer)).size;
  const previousBuyers = new Set(courseSales.filter(t=>t.purchasedAt >= previousMonthStart && t.purchasedAt < monthStart).map(t=>t.buyer)).size;
  const change = previousBuyers ? (currentBuyers-previousBuyers)/previousBuyers*100 : null;
  const buyerGrowth = change === null ? 'ผู้ซื้อเดือนนี้ '+money(currentBuyers)+' คน' : (change>0?'+':'')+money(change)+'% เทียบเดือนก่อน';
  const latestSale = transactions[0]?.purchasedAt;
  const updated = latestSale ? 'อัปเดตล่าสุด '+new Intl.DateTimeFormat('th-TH-u-ca-gregory',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}).format(latestSale) : 'ยังไม่มีรายการซื้อ';
  const stats = [
    ['book-open','คอร์สทั้งหมด',money(courses.length)+' คอร์ส',money(newCourses)+' คอร์สสร้างในเดือนนี้','positive'],
    ['chef-hat','สูตรอาหาร',money(recipes.length)+' เมนู',average === null ? 'ยังไม่มีรีวิว' : 'คะแนนเฉลี่ย '+average.toFixed(1)+' ★','orange'],
    ['users-round','ผู้เรียนทั้งหมด',money(buyers.size)+' คน',buyerGrowth,'positive'],
    ['wallet','ยอดซื้อสะสม','฿'+money(transactions.reduce((n,t)=>n+t.amountPaid,0)),updated,'muted']
  ];
  const end = new Date(dateKey(now)+'T00:00:00+07:00');
  const periods = {};
  for(const [name,offset] of [['current',0],['previous',7]]) {
    const days = Array.from({length:7},(_,i)=>new Date(end.getTime()-(offset+6-i)*86400000));
    periods[name] = days.map(day=>({label:new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short'}).format(day), value:0,key:dateKey(day)}));
  }
  const bucketMap = new Map([...periods.current,...periods.previous].map(day=>[day.key,day]));
  transactions.forEach(t=>{const bucket=bucketMap.get(dateKey(t.purchasedAt));if(bucket)bucket.value+=t.amountPaid;});
  const currentTotal=periods.current.reduce((n,d)=>n+d.value,0), previousTotal=periods.previous.reduce((n,d)=>n+d.value,0);
  const comparison=previousTotal ? ((currentTotal-previousTotal)/previousTotal*100).toFixed(1)+'% เทียบกับ 7 วันก่อนหน้า' : 'ยังไม่มียอดขายใน 7 วันก่อนหน้า';
  const chartMax=Math.max(4,Math.ceil(Math.max(...periods.current.map(d=>d.value),...periods.previous.map(d=>d.value))/4)*4);
  const counts=new Map();courseSales.forEach(t=>{const key=t.itemType+':'+t.itemId;counts.set(key,(counts.get(key)||0)+1);});
  const best=[...counts].sort((a,b)=>b[1]-a[1])[0];
  const popular=best ? {...courseMap.get(best[0]),students:best[1]} : null;
  const bestReview=reviews.sort((a,b)=>b.count-a.count || b.rating-a.rating)[0];
  const topRecipe=bestReview ? {...recipeMap.get(bestReview._id),rating:bestReview.rating,reviews:bestReview.count} : null;
  const recent=transactions.slice(0,50);
  const clients=await Client.find({_id:{$in:[...new Set(recent.map(t=>t.buyer))]}}).select('name email avatar').lean();
  const clientMap=new Map(clients.map(c=>[c._id,c]));
  const orders=recent.map(t=>({name:clientMap.get(t.buyer)?.name || 'บัญชีที่ถูกลบ',email:clientMap.get(t.buyer)?.email || '',avatar:clientMap.get(t.buyer)?.avatar || '',title:t.itemType==='Recipe'?recipeMap.get(t.itemId).title:courseMap.get(t.itemType+':'+t.itemId).title,type:t.itemType==='Recipe'?'สูตรอาหาร':'คอร์ส',date:new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}).format(t.purchasedAt),amount:t.amountPaid,paymentMode:t.paymentMode}));
  return {chef,stats,periods,chartMax,comparison,popular,topRecipe,orders,money,hasTestPurchases,dataNote};
}
module.exports = {loadDashboard};
