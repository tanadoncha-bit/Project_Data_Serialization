const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const cloud = require('./cloudinaryRecipeImages');
function extension(buffer) {
  if (buffer.length > 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpg';
  if (buffer.length > 8 && buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (buffer.length > 12 && buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP') return 'webp';
  if (['GIF87a','GIF89a'].includes(buffer.toString('ascii',0,6))) return 'gif';
  return null;
}
async function store(buffer, clientId) {
  const ext = extension(buffer);
  if (!ext || buffer.length > 2 * 1024 * 1024) throw new Error('รูปต้องเป็น JPG, PNG, GIF หรือ WebP ขนาดไม่เกิน 2 MB');
  const url = await cloud.store(buffer, ext, 'avatars');
  if (url) return url;
  const dir = path.join(__dirname, '../public/uploads/avatars');
  await fs.mkdir(dir, {recursive:true});
  const name = clientId + '-' + randomBytes(16).toString('hex') + '.' + ext;
  await fs.writeFile(path.join(dir,name),buffer,{flag:'wx'});
  return '/uploads/avatars/' + name;
}
module.exports = {store, extension};
