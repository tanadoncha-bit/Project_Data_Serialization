require('dotenv').config({quiet:true});
const mongoose=require('mongoose');
const fs=require('node:fs/promises');
const path=require('node:path');
const Client=require('../models/Client');
const cloud=require('../services/cloudinaryRecipeImages');
const {extension}=require('../services/avatarImages');
async function main(){
 if(!cloud.config())throw Error('Cloud configuration required');
 await mongoose.connect(process.env.MONGODB_URI);
 const users=await Client.find({avatar:/^\/uploads\/avatars\//}).select('_id avatar').lean();
 const journal=users.map(u=>({id:u._id,before:u.avatar,after:null,updated:false}));
 const dir=path.join(__dirname,'../node_modules/.cache');await fs.mkdir(dir,{recursive:true});
 const backup=path.join(dir,'avatar-migration-'+Date.now()+'.json');
 await fs.writeFile(backup,JSON.stringify(journal,null,2),{flag:'wx'});
 let updated=0,missing=0;
 for(const item of journal){
  if(!/^\/uploads\/avatars\/[a-zA-Z0-9_.-]+$/.test(item.before)){item.error='invalid path';continue;}
  let buffer;try{buffer=await fs.readFile(path.join(__dirname,'../public',item.before.slice(1)));}catch(e){if(e.code==='ENOENT'){item.error='missing file';missing++;continue;}throw e;}
  const ext=extension(buffer);if(!ext){item.error='invalid image';continue;}
  item.after=await cloud.store(buffer,ext,'avatars');
  await fs.writeFile(backup,JSON.stringify(journal,null,2));
  const result=await Client.updateOne({_id:item.id,avatar:item.before},{$set:{avatar:item.after}},{runValidators:true});
  item.updated=result.modifiedCount===1;if(item.updated)updated++;
  await fs.writeFile(backup,JSON.stringify(journal,null,2));
 }
 await fs.writeFile(backup,JSON.stringify(journal,null,2));
 console.log(JSON.stringify({users:users.length,updated,missing,backup:path.basename(backup),localFilesPreserved:true}));
}
main().catch(()=>{console.error('Avatar migration failed; inspect the journal. Local files preserved.');process.exitCode=1;}).finally(()=>mongoose.disconnect());
