const assert = require('node:assert/strict');
const axios = require('axios');
const images = require('../services/cloudinaryRecipeImages');
async function main() {
  delete process.env.CLOUDINARY_CLOUD_NAME; delete process.env.CLOUDINARY_API_KEY; delete process.env.CLOUDINARY_API_SECRET;
  assert.equal(await images.store(Buffer.from('test'), 'png'), null);
  process.env.CLOUDINARY_CLOUD_NAME = 'fixture';
  await assert.rejects(images.store(Buffer.from('test'), 'png'));
  process.env.CLOUDINARY_API_KEY = 'fixture-key'; process.env.CLOUDINARY_API_SECRET = 'fixture-secret';
  const original = axios.post; let ids = [];
  axios.post = async (url, body) => { const params = new URLSearchParams(body); assert(url.endsWith('/fixture/image/upload')); assert.equal(params.get('overwrite'), 'false'); assert(params.get('signature')); ids.push(params.get('public_id')); return {data:{public_id:params.get('public_id'),secure_url:'https://res.cloudinary.com/fixture/image/upload/test.png'}}; };
  try {
    assert.equal(await images.store(Buffer.from('same'), 'png'), await images.store(Buffer.from('same'), 'png'));
    assert.equal(ids[0], ids[1]);
    axios.post = async () => { throw Error('fixture-secret'); };
    await assert.rejects(images.store(Buffer.from('test'), 'png'), error => !error.message.includes('fixture-secret'));
  } finally { axios.post = original; }
  console.log('PASS: Cloudinary configuration, stable image ID, no overwrite and masked errors');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
