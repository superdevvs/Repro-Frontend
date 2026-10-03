'use strict';
const https = require('node:https');
const fs = require('node:fs');
const { once } = require('node:events');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const { API, safeName } = require('./policy.cjs');
class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
const safeError = (status, body) => {
  let message; try { message = JSON.parse(body).message; } catch {}
  return new ApiError(typeof message === 'string' ? message.slice(0, 600) : 'The dashboard could not complete this request. Your local work is preserved.', status);
};
function request(route, method, credential, headers = {}) {
  if (!/^\/[a-z0-9/-]+$/i.test(route)) throw new Error('Invalid helper route.');
  const req = https.request(API + route, { method, headers: { Accept: 'application/json', ...(credential ? { Authorization: 'Bearer ' + credential } : {}), ...headers } });
  req.setTimeout(120000, () => req.destroy(new Error('Connection timed out. Your saved work will retry.')));
  return req;
}
async function responseJson(req) {
  const [res] = await once(req, 'response'); let bytes = 0; const chunks = [];
  for await (const chunk of res) { bytes += chunk.length; if (bytes > 1048576) { res.destroy(); throw new Error('Unexpected dashboard response.'); } chunks.push(chunk); }
  const body = Buffer.concat(chunks).toString('utf8');
  if (res.statusCode < 200 || res.statusCode >= 300) throw safeError(res.statusCode, body);
  return JSON.parse(body).data;
}
class HelperApi {
  constructor(credential) { this.credential = credential; }
  async json(route, body) {
    const bytes = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = request(route, bytes ? 'POST' : 'GET', this.credential(), bytes ? { 'Content-Type': 'application/json', 'Content-Length': bytes.length } : {});
    const result = responseJson(req); req.end(bytes); return result;
  }
  async download(sessionId, destination) {
    const req = request('/sessions/' + sessionId + '/file', 'GET', this.credential());
    const response = once(req, 'response'); req.end(); const [res] = await response;
    if (res.statusCode !== 200) { res.resume(); throw safeError(res.statusCode, ''); }
    let count = 0;
    const limit = new Transform({ transform(chunk, _encoding, callback) {
      count += chunk.length; callback(count > 268435456 ? new Error('This image exceeds the helper’s 256 MB limit.') : null, chunk);
    } });
    await pipeline(res, limit, fs.createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
  }
  async upload(sessionId, saved, onProgress) {
    const boundary = 'ReProEdit' + require('node:crypto').randomBytes(16).toString('hex');
    const filename = safeName(saved.filename).replace(/["\r\n]/g, '_');
    const start = Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="request_id"\r\n\r\n' + saved.requestId + '\r\n--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="' + filename + '"\r\nContent-Type: application/octet-stream\r\n\r\n');
    const end = Buffer.from('\r\n--' + boundary + '--\r\n');
    const size = fs.statSync(saved.path).size;
    const req = request('/sessions/' + sessionId + '/upload', 'POST', this.credential(), { 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Content-Length': start.length + size + end.length });
    const result = responseJson(req);
    // Attach a handler immediately, including when the server rejects before the file stream ends.
    result.catch(() => {});
    try {
      req.write(start); let written = 0;
      for await (const chunk of fs.createReadStream(saved.path)) {
        if (!req.write(chunk)) await Promise.race([once(req, 'drain'), result.then(() => { throw new Error('The server ended the upload early. Your saved export is preserved.'); })]);
        written += chunk.length; onProgress(Math.round(written * 100 / Math.max(size, 1)));
      }
      req.end(end); return await result;
    } catch (error) { req.destroy(); throw error; }
  }
}
module.exports = { HelperApi, ApiError };
