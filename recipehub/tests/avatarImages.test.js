const assert=require('node:assert/strict');
const cloud=require('../services/cloudinaryRecipeImages');
const images=require('../services/avatarImages');
(async()=>{
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('fixture')]);
 assert.equal(images.extension(png),'png');
 assert.equal(images.extension(Buffer.from('GIF89a123')),'gif');
 assert.equal(images.extension(Buffer.from('<script>bad</script>')),null);
 await assert.rejects(images.store(Buffer.from('bad'),1));
 await assert.rejects(images.store(Buffer.alloc(2*1024*1024+1),1));
 const original=cloud.store;cloud.store=async(buffer,ext,kind)=>{assert.equal(ext,'png');assert.equal(kind,'avatars');return 'https://res.cloudinary.com/fixture/avatar.png';};
 try{assert.equal(await images.store(png,1),'https://res.cloudinary.com/fixture/avatar.png');}finally{cloud.store=original;}
 console.log('PASS: avatar file signatures, size limit and separate Cloudinary collection');
})().catch(error=>{console.error(error);process.exitCode=1;});
