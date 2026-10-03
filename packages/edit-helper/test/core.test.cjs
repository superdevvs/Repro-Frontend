'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { EditingStore, hash } = require('../core.cjs');
const { deepLink, inside, deliverable } = require('../policy.cjs');
const jpeg = suffix => Buffer.concat([Buffer.from([255,216,255]), Buffer.from(suffix)]);
async function fixture(t, overrides = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'repro-edit-test-'));
  const id = crypto.randomUUID();
  const uploaded = [];
  const api = {
    json: async route => route.endsWith('/claim') ? { id, filename: 'Kitchen.jpg', file_id: 10, shoot_id: 4, expected_version: 1 } : { id: 'version', status: 'published', version: 2, published_file_id: 10 },
    download: async (_id, file) => fs.writeFile(file, jpeg('original')),
    upload: async (_id, saved) => { uploaded.push({ requestId: saved.requestId, bytes: await fs.readFile(saved.path) }); return { id: 'version' }; },
    ...overrides,
  };
  const store = new EditingStore(root, api); store.watch = () => {};
  t.after(async () => { store.close(); await fs.rm(root, { recursive: true, force: true }); });
  await store.open(id);
  return { root, id, store, api, uploaded, file: store.workingPath(store.state.sessions[id]) };
}
test('application links accept only opaque session ids and fixed actions', () => {
  const id = crypto.randomUUID();
  assert.deepEqual(deepLink('repro-edit://open/' + id), { action: 'open', id });
  for (const value of ['https://evil.example/' + id, 'repro-edit://open/' + id + '?token=x', 'repro-edit://user:pass@open/' + id, 'repro-edit://open/../../file', 'repro-edit://open/C:/secrets', 'repro-edit://evil/' + id]) assert.throws(() => deepLink(value));
  assert.equal(inside(path.resolve('work'), path.resolve('work-extra', 'file')), false);
  assert.throws(() => deliverable(Buffer.from('8BPS layered file')));
});
test('manual is default and opening does not upload; identical concurrent saves are deduplicated', async t => {
  const { store, id, file, uploaded } = await fixture(t);
  assert.equal(store.state.sessions[id].autoUpload, false);
  assert.equal(await store.capture(id, file, { stableMs: 1 }), null);
  await fs.writeFile(file, jpeg('edited'));
  await Promise.all([store.capture(id, file, { stableMs: 1 }), store.capture(id, file, { stableMs: 1 })]);
  assert.equal(store.state.sessions[id].queue.length, 1);
  assert.equal(uploaded.length, 0);
});
test('offline recovery persists immutable bytes and retries the same request id after restart', async t => {
  const { store, root, id, file, api, uploaded } = await fixture(t);
  await fs.writeFile(file, jpeg('saved edit'));
  const job = await store.capture(id, file, { stableMs: 1 });
  const upload = api.upload; api.upload = async () => { throw new Error('Offline'); };
  await store.step(id);
  assert.equal(store.state.sessions[id].status, 'offline');
  await fs.writeFile(file, jpeg('later unsent edit'));
  store.close(); api.upload = upload;
  const restarted = new EditingStore(root, api); t.after(() => restarted.close());
  restarted.state.sessions[id].queue[0].retryAt = 0;
  await restarted.step(id); await restarted.step(id);
  assert.equal(uploaded[0].requestId, job.requestId);
  assert.equal(uploaded[0].bytes.toString(), jpeg('saved edit').toString());
  assert.equal(restarted.state.sessions[id].queue[0].status, 'done');
  assert.equal((await fs.readFile(file)).toString(), jpeg('later unsent edit').toString());
});
test('rapid saves wait for stable bytes and serial uploads pause on a conflict', async t => {
  let uploads = 0;
  const { store, id, file, api } = await fixture(t);
  await fs.writeFile(file, jpeg('half'));
  const capture = store.capture(id, file, { stableMs: 30 });
  await new Promise(resolve => setTimeout(resolve, 10)); await fs.writeFile(file, jpeg('finished save'));
  await capture;
  assert.equal(store.state.sessions[id].queue[0].sha256, hash(jpeg('finished save')));
  await fs.writeFile(file, jpeg('next save')); await store.capture(id, file, { stableMs: 1 });
  api.upload = async () => { uploads++; return { id: 'first-version' }; };
  api.json = async () => ({ status: 'conflict' });
  await store.step(id); await store.step(id); await store.step(id);
  assert.equal(uploads, 1);
  assert.equal(store.state.sessions[id].queue[0].status, 'conflict');
  assert.equal(store.state.sessions[id].queue[1].status, 'pending');
});
test('PSD stays local, session path traversal is rejected, Save As imports a deliberate export', async t => {
  const { store, id, root, file } = await fixture(t);
  const psd = path.join(store.directory(id), 'master.psd'); await fs.writeFile(psd, '8BPS layers');
  await assert.rejects(store.capture(id, psd, { stableMs: 1 }), /JPEG, PNG or TIFF/);
  await assert.rejects(store.capture(id, path.join(root, 'outside.jpg'), { stableMs: 1 }), /inside this editing session/);
  const external = path.join(root, 'chosen-export.jpg'); await fs.writeFile(external, jpeg('outside export'));
  const imported = await store.importExport(id, external);
  assert.equal(inside(store.directory(id), imported), true);
  await store.capture(id, imported, { stableMs: 1 });
  assert.equal(store.state.sessions[id].queue.length, 1);
  assert.equal((await fs.readFile(psd)).toString(), '8BPS layers');
  assert.equal((await fs.readFile(file)).toString(), jpeg('original').toString());
});
test('expired device/session pauses without losing saved bytes', async t => {
  const { store, id, file, api } = await fixture(t);
  await fs.writeFile(file, jpeg('offline work')); await store.capture(id, file, { stableMs: 1 });
  api.upload = async () => { const error = new Error('Session expired'); error.status = 410; throw error; };
  await store.step(id);
  const job = store.state.sessions[id].queue[0];
  assert.equal(job.status, 'paused');
  assert.equal((await fs.readFile(path.join(store.directory(id), job.snapshot))).toString(), jpeg('offline work').toString());
});
