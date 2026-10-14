const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ejs = require('ejs');
const root = path.resolve(__dirname, '..');
const devDependencies = require('../package.json').devDependencies || {};
const failures = [];
let checked = 0;
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
function exists(file) {
  return [file, file + '.ejs'].some(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}
const directories = ['config', 'helpers', 'middleware', 'models', 'routes', 'services', 'scripts', 'views', 'public/javascripts', 'public/stylesheets'];
const files = [path.join(root, 'app.js'), path.join(root, 'bin/www'), ...directories.flatMap(dir => walk(path.join(root, dir)))];
for (const file of files) {
  if (!/\.(js|ejs|css)$/.test(file) && file !== path.join(root, 'bin/www')) continue;
  const source = fs.readFileSync(file, 'utf8');
  try {
    if (file.endsWith('.js') || file === path.join(root, 'bin/www')) {
      new vm.Script(source, { filename: file });
      if (!file.startsWith(path.join(root, 'public') + path.sep)) {
        const resolve = createRequire(file).resolve;
        for (const match of source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
          const name = match[1].startsWith('@') ? match[1].split('/').slice(0, 2).join('/') : match[1].split('/')[0];
          if (file.startsWith(path.join(root, 'scripts') + path.sep) && Object.hasOwn(devDependencies, name)) continue;
          resolve(match[1]);
        }
      }
    }
    if (file.endsWith('.ejs')) {
      ejs.compile(source, { filename: file });
      for (const match of source.matchAll(/include\(\s*['"]([^'"]+)['"]/g)) {
        if (!exists(path.resolve(path.dirname(file), match[1]))) throw new Error('Missing EJS include: ' + match[1]);
      }
      for (const match of source.matchAll(/(?:src|href)=["']\/(javascripts|stylesheets)\/([^"'?<>]+)(?:\?[^"']*)?["']/g)) {
        if (!exists(path.join(root, 'public', match[1], match[2]))) throw new Error('Missing static asset: ' + match[1] + '/' + match[2]);
      }
    }
    checked++;
  } catch (error) {
    failures.push(path.relative(root, file) + ': ' + error.message);
  }
}
if (failures.length) {
  failures.forEach(message => console.error(message));
  process.exitCode = 1;
} else {
  console.log('Checked ' + checked + ' files: JavaScript syntax, EJS compilation, module references and template assets passed.');
}
