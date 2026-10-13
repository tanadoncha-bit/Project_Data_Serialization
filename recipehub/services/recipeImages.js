const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const directory = path.join(__dirname, '../public/uploads/recipes');
const validName = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
let queue = Promise.resolve();
async function store(buffer, extension) {
  const cloudUrl = await require('./cloudinaryRecipeImages').store(buffer, extension);
  if (cloudUrl) return cloudUrl;
  const operation = queue.then(async () => {
    await fs.mkdir(directory, { recursive: true });
    const hash = createHash('sha256').update(buffer).digest('hex');
    for (const name of await fs.readdir(directory)) {
      if (!validName.test(name)) continue;
      const file = path.join(directory, name);
      const existing = await fs.readFile(file).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (existing && createHash('sha256').update(existing).digest('hex') === hash) {
        const now = new Date();
        await fs.utimes(file, now, now);
        return '/uploads/recipes/' + name;
      }
    }
    const name = randomBytes(16).toString('hex') + '.' + extension;
    await fs.writeFile(path.join(directory, name), buffer, { flag: 'wx' });
    return '/uploads/recipes/' + name;
  });
  queue = operation.catch(() => {});
  return operation;
}
module.exports = { store, directory, validName };
