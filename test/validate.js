const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
for (const file of ['manifest.json','background.js','offscreen.html','offscreen.js','README.md']) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing ${file}`);
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) throw new Error('manifest_version must be 3');
if (manifest.name !== 'Chrome Image Downloader by TechNow') throw new Error('Extension name mismatch');
for (const perm of ['contextMenus','downloads','offscreen']) {
  if (!manifest.permissions.includes(perm)) throw new Error(`Missing permission ${perm}`);
}
for (const size of ['16','32','48','128']) {
  const icon = manifest.icons[size];
  if (!icon || !fs.existsSync(path.join(root, icon))) throw new Error(`Missing icon ${size}`);
}
const bg = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
if (!bg.includes('Save image as JPG') || !bg.includes('Save image as PNG')) throw new Error('Context menu labels missing');
const off = fs.readFileSync(path.join(root, 'offscreen.js'), 'utf8');
if (!off.includes("['jpeg', 'png']") || !off.includes('createImageBitmap') || !off.includes('convertToBlob')) throw new Error('Converter logic incomplete');
console.log('Validation OK');
