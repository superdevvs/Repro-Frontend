'use strict';
const path = require('node:path');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const API = 'https://reprodashboard.com/api/edit-helper';
function deepLink(value) {
  const url = new URL(value);
  if (url.protocol !== 'repro-edit:' || url.username || url.password || url.port || url.search || url.hash) throw new Error('Invalid RePro application link.');
  if (url.hostname === 'settings' && (!url.pathname || url.pathname === '/')) return { action: 'settings' };
  const id = url.pathname.slice(1);
  if (!['pair', 'open'].includes(url.hostname) || !UUID.test(id)) throw new Error('Invalid editing session link.');
  return { action: url.hostname, id: id.toLowerCase() };
}
function inside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
function safeName(name) {
  let clean = path.basename(String(name).replaceAll('\\', '/')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '');
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(clean)) clean = '_' + clean;
  return clean.slice(-150) || 'image.jpg';
}
function deliverable(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (bytes.subarray(0, 4).equals(Buffer.from([73,73,42,0])) || bytes.subarray(0,4).equals(Buffer.from([77,77,0,42]))) return 'tif';
  throw new Error('Export a JPEG, PNG or TIFF. Layered PSD masters stay local.');
}
module.exports = { API, UUID, deepLink, inside, safeName, deliverable };
