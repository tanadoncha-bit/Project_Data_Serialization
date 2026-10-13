const axios = require('axios');
const { createHash } = require('node:crypto');
function config() {
  const values = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].map(key => process.env[key]?.trim() || '');
  if (!values.some(Boolean)) return null;
  if (!values.every(Boolean) || !/^[a-zA-Z0-9_-]+$/.test(values[0])) throw new Error('ตั้งค่า Cloudinary ไม่ครบหรือชื่อ cloud ไม่ถูกต้อง');
  return { cloud: values[0], key: values[1], secret: values[2] };
}
async function store(buffer, extension, kind = 'recipes') {
  if (!['recipes', 'avatars'].includes(kind)) throw new Error('Invalid image collection');
  const settings = config();
  if (!settings) return null;
  const hash = createHash('sha256').update(buffer).digest('hex');
  const publicId = 'cookhub/' + kind + '/' + hash;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = { overwrite: 'false', public_id: publicId, timestamp };
  const signature = createHash('sha1').update(Object.keys(params).sort().map(key => key + '=' + params[key]).join('&') + settings.secret).digest('hex');
  const body = new URLSearchParams({ ...params, api_key: settings.key, signature, file: 'data:image/' + (extension === 'jpg' ? 'jpeg' : extension) + ';base64,' + buffer.toString('base64') });
  try {
    const { data } = await axios.post('https://api.cloudinary.com/v1_1/' + settings.cloud + '/image/upload', body.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000, maxBodyLength: 8 * 1024 * 1024 });
    if (data.public_id !== publicId || typeof data.secure_url !== 'string' || !data.secure_url.startsWith('https://res.cloudinary.com/')) throw new Error('Unexpected upload response');
    return data.secure_url;
  } catch (_) {
    throw new Error('อัปโหลดรูปขึ้น Cloudinary ไม่สำเร็จ กรุณาตรวจการตั้งค่าหรือลองใหม่');
  }
}
module.exports = { config, store };
