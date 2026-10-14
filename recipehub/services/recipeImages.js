const cloud = require('./cloudinaryRecipeImages');
async function store(buffer, extension) {
  const url = await cloud.store(buffer, extension);
  if (!url) throw new Error('กรุณาตั้งค่า Cloudinary ก่อนอัปโหลดรูป');
  return url;
}
module.exports = { store };
