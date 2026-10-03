'use strict';
const fs = require('node:fs/promises');
const syncFs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { inside, safeName, deliverable, UUID } = require('./policy.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
class EditingStore {
  constructor(root, api, emit = () => {}) {
    this.root = path.resolve(root); this.api = api; this.emit = emit; this.active = new Set(); this.watchers = new Map(); this.timers = new Map(); this.closed = false;
    this.captures = new Map();
    syncFs.mkdirSync(this.root, { recursive: true, mode: 0o700 });
    this.statePath = path.join(this.root, 'sessions.json');
    try { this.state = JSON.parse(syncFs.readFileSync(this.statePath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('Working-copy index could not be read. Keep this folder intact for recovery.'); this.state = { sessions: {}, autoUpload: false }; }
    for (const session of Object.values(this.state.sessions)) {
      for (const job of session.queue) if (job.status === 'uploading') job.status = 'pending';
    }
  }
  save() {
    const temp = this.statePath + '.tmp'; syncFs.writeFileSync(temp, JSON.stringify(this.state), { mode: 0o600 }); syncFs.renameSync(temp, this.statePath); this.emit();
  }
  directory(id) { if (!UUID.test(id)) throw new Error('Invalid session.'); return path.join(this.root, 'work', id); }
  workingPath(session) {
    const result = path.resolve(this.directory(session.id), session.workingFile);
    if (!inside(this.directory(session.id), result)) throw new Error('Working file is outside this session.');
    return result;
  }
  async open(id) {
    if (this.state.sessions[id]) { this.watch(id); return this.state.sessions[id]; }
    const details = await this.api.json('/sessions/' + id + '/claim', {});
    const directory = this.directory(id); await fs.mkdir(path.join(directory, 'Exports'), { recursive: true, mode: 0o700 });
    const filename = safeName(details.filename);
    const destination = path.join(directory, filename); const temporary = destination + '.' + crypto.randomUUID() + '.download';
    try {
      await this.api.download(id, temporary);
      const bytes = await fs.readFile(temporary); deliverable(bytes);
      await fs.rename(temporary, destination);
      const session = { ...details, id, workingFile: filename, autoUpload: this.state.autoUpload, lastPublishedHash: hash(bytes), queue: [], message: 'Manual upload. Save or export a JPEG, PNG or TIFF, then choose Upload saved edit.', status: 'ready' };
      this.state.sessions[id] = session; this.save(); this.watch(id); return session;
    } catch (error) { await fs.unlink(temporary).catch(() => {}); throw error; }
  }
  capture(id, candidate, options = {}) {
    const previous = this.captures.get(id) || Promise.resolve();
    const capture = previous.catch(() => {}).then(() => this.captureStable(id, candidate, options));
    this.captures.set(id, capture);
    capture.finally(() => { if (this.captures.get(id) === capture) this.captures.delete(id); }).catch(() => {});
    return capture;
  }
  async captureStable(id, candidate, { stableMs = 1200 } = {}) {
    const session = this.state.sessions[id]; if (!session) throw new Error('Unknown editing session.');
    const directory = this.directory(id);
    if (!inside(directory, candidate)) throw new Error('Choose an export inside this editing session.');
    const realRoot = await fs.realpath(directory); const real = await fs.realpath(candidate);
    if (!inside(realRoot, real) || (await fs.lstat(candidate)).isSymbolicLink()) throw new Error('Linked files cannot be uploaded.');
    let bytes;
    for (let attempt = 0; attempt < 8; attempt++) {
      const before = await fs.stat(real);
      if (!before.isFile() || before.size < 1 || before.size > 268435456) throw new Error('Export an image no larger than 256 MB.');
      await sleep(stableMs);
      const after = await fs.stat(real);
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) continue;
      const candidateBytes = await fs.readFile(real); const final = await fs.stat(real);
      if (final.size === after.size && final.mtimeMs === after.mtimeMs && candidateBytes.length === final.size) { bytes = candidateBytes; break; }
    }
    if (!bytes) throw new Error('Photoshop is still saving. Wait for the save to finish and retry.');
    const extension = deliverable(bytes); const sha256 = hash(bytes);
    if (sha256 === session.lastPublishedHash || session.queue.some(job => job.sha256 === sha256 && !['done', 'withdrawn'].includes(job.status))) return null;
    const requestId = crypto.randomUUID(); const snapshot = path.join('.outbox', requestId + '.' + extension);
    await fs.mkdir(path.join(directory, '.outbox'), { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(directory, snapshot), bytes, { flag: 'wx', mode: 0o600 });
    const job = { requestId, snapshot, sha256, filename: path.parse(safeName(candidate)).name + '.' + extension, status: 'pending', attempts: 0 };
    session.queue.push(job); session.workingFile = path.relative(directory, candidate); session.message = 'Saved locally and queued for upload.'; this.save();
    return job;
  }
  async importExport(id, source) {
    const directory = this.directory(id);
    if (inside(directory, source)) return source;
    const info = await fs.stat(source);
    if (!info.isFile() || info.size > 268435456) throw new Error('Export an image no larger than 256 MB.');
    const bytes = await fs.readFile(source); deliverable(bytes);
    if (bytes.length !== info.size || (await fs.stat(source)).mtimeMs !== info.mtimeMs) throw new Error('The export is still being saved. Wait for Photoshop and select it again.');
    const destination = path.join(directory, 'Exports', crypto.randomUUID() + '-' + safeName(source));
    await fs.writeFile(destination, bytes, { flag: 'wx', mode: 0o600 }); return destination;
  }
  async step(id) {
    if (this.closed || this.active.has(id)) return;
    const session = this.state.sessions[id]; if (!session) return;
    const job = session.queue.find(value => !['done', 'withdrawn'].includes(value.status));
    if (!job || job.status === 'paused' || (job.retryAt && job.retryAt > Date.now())) return;
    this.active.add(id);
    try {
      if (job.versionId) {
        const version = await this.api.json('/sessions/' + id + '/versions/' + job.versionId);
        if (['published', 'archived'].includes(version.status)) {
          job.status = 'done'; session.lastPublishedHash = job.sha256; session.expected_version = version.version; session.file_id = version.published_file_id;
          session.message = 'Edit published. Previous versions are available in the dashboard.'; session.status = 'ready';
        } else if (version.status === 'conflict') {
          job.status = 'conflict'; job.retryAt = Date.now() + 10000; session.status = 'conflict'; session.message = 'A newer edit exists. In the dashboard choose Replace latest or Save as copy. Later saves are preserved locally.';
        } else if (version.status === 'failed') {
          job.status = 'paused'; session.status = 'paused'; session.message = version.error || 'Processing failed. Review the saved upload in the dashboard.';
        } else { job.status = 'processing'; job.retryAt = Date.now() + 2000; session.message = 'Upload saved. Scanning and processing…'; }
      } else {
        job.status = 'uploading'; this.save();
        const snapshotPath = path.resolve(this.directory(id), job.snapshot);
        if (!inside(this.directory(id), snapshotPath) || hash(await fs.readFile(snapshotPath)) !== job.sha256) throw new Error('Saved upload bytes are missing or changed. Keep your working file and choose its export again.');
        const result = await this.api.upload(id, { ...job, path: snapshotPath }, progress => { session.progress = progress; this.emit(); });
        job.versionId = result.id; job.status = 'processing'; job.retryAt = 0; session.message = 'Upload saved. Scanning and processing…'; session.progress = null;
      }
      job.attempts = 0; this.save();
    } catch (error) {
      job.attempts++; job.status = [401, 403, 409, 410, 413, 422].includes(error.status) ? 'paused' : (job.versionId ? 'processing' : 'pending');
      job.retryAt = Date.now() + Math.min(180000, 2000 * 2 ** Math.min(job.attempts, 7));
      session.status = job.status === 'paused' ? 'paused' : 'offline'; session.progress = null;
      session.message = error.message + ' Your working copy and queued saves remain on this computer.'; this.save();
    } finally { this.active.delete(id); }
  }
  watch(id) {
    if (this.watchers.has(id)) return;
    const session = this.state.sessions[id];
    const watcher = syncFs.watch(this.directory(id), { recursive: true }, (_event, filename) => {
      if (!filename || String(filename).split(/[\\/]/).some(part => part.startsWith('.')) || !/\.(jpe?g|png|tiff?|psd|psb)$/i.test(String(filename))) return;
      clearTimeout(this.timers.get(id));
      this.timers.set(id, setTimeout(async () => {
        const candidate = path.join(this.directory(id), String(filename));
        if (!inside(this.directory(id), candidate)) return;
        if (/\.(psd|psb)$/i.test(candidate)) { session.message = 'Layered master saved locally. Export JPEG, PNG or TIFF to this session’s Exports folder, or choose Export file.'; this.save(); return; }
        try {
          await fs.stat(candidate); session.workingFile = path.relative(this.directory(id), candidate);
          if (session.autoUpload) { await this.capture(id, candidate); await this.step(id); }
          else { session.message = 'Saved edit detected. Choose Upload saved edit when ready.'; this.save(); }
        } catch (error) { if (error.code !== 'ENOENT') { session.message = error.message; this.save(); } }
      }, 750));
    });
    watcher.on('error', error => { session.message = 'Save detection stopped: ' + error.message + '. Manual upload remains available.'; this.save(); });
    this.watchers.set(id, watcher);
  }
  resume() {
    for (const id of Object.keys(this.state.sessions)) { try { this.watch(id); } catch (error) { this.state.sessions[id].message = error.message; } }
    this.interval = setInterval(() => { for (const id of Object.keys(this.state.sessions)) void this.step(id); }, 2000);
  }
  close() { this.closed = true; clearInterval(this.interval); for (const timer of this.timers.values()) clearTimeout(timer); for (const watcher of this.watchers.values()) watcher.close(); this.watchers.clear(); }
}
module.exports = { EditingStore, hash };
