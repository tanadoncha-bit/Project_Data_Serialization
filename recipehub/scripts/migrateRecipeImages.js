require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const fs = require('node:fs/promises');
const path = require('node:path');
const Recipe = require('../models/Recipe');
const images = require('../services/cloudinaryRecipeImages');
async function main() {
  if (!images.config()) throw Error('Cloudinary configuration required');
  await mongoose.connect(process.env.MONGODB_URI);
  const rows = await Recipe.find({ image: /^\/uploads\/recipes\/[a-f0-9]{32}\.(jpg|png|webp)$/ }).select('_id image').lean();
  const apply = process.argv.includes('--apply');
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', recipes: rows.length }));
  if (!apply || !rows.length) return;
  const backupDir = path.join(__dirname, '../node_modules/.cache');
  await fs.mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, 'recipe-image-migration-' + Date.now() + '.json');
  const journal = rows.map(row => ({ id: row._id, before: row.image, after: null, updated: false }));
  await fs.writeFile(backup, JSON.stringify(journal, null, 2), { flag: 'wx' });
  const urls = new Map();
  let updated = 0;
  for (const item of journal) {
    let url = urls.get(item.before);
    if (!url) {
      const name = path.basename(item.before);
      const buffer = await fs.readFile(path.join(__dirname, '../public/uploads/recipes', name));
      url = await images.store(buffer, path.extname(name).slice(1));
      urls.set(item.before, url);
    }
    item.after = url;
    await fs.writeFile(backup, JSON.stringify(journal, null, 2));
    const result = await Recipe.updateOne({ _id: item.id, image: item.before }, { $set: { image: url } }, { runValidators: true });
    item.updated = result.modifiedCount === 1;
    if (item.updated) updated++;
    await fs.writeFile(backup, JSON.stringify(journal, null, 2));
  }
  console.log(JSON.stringify({ updated, uploadedImages: urls.size, backup: path.basename(backup), localFilesPreserved: true }));
}
main().catch(() => { console.error('Recipe image migration failed; inspect the migration journal before retrying. Local files preserved.'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
