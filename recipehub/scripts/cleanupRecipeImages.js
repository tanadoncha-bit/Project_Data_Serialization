require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const fs = require('node:fs/promises');
const path = require('node:path');
const Recipe = require('../models/Recipe');
const { directory, validName } = require('../services/recipeImages');
async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const apply = process.argv.includes('--apply');
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let removed = 0, protectedFiles = 0, recent = 0;
  for (const name of await fs.readdir(directory)) {
    if (!validName.test(name)) continue;
    const file = path.join(directory, name);
    if ((await fs.stat(file)).mtimeMs >= cutoff) { recent++; continue; }
    if (await Recipe.exists({ image: '/uploads/recipes/' + name })) { protectedFiles++; continue; }
    if (apply) await fs.unlink(file);
    removed++;
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', unused: removed, referenced: protectedFiles, recent }));
}
main().catch(() => { console.error('Image cleanup failed; check database connectivity and file permissions.'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
