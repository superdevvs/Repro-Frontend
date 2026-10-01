// Real Chromium service worker / IndexedDB / notification lifecycle, with local push injection.
// No browser-vendor push subscription, network delivery or provider call is made.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const requests = [];
let workerRevision = 0;
const server = createServer(async (request, response) => {
  if (request.url === '/voice-push-worker.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(`self.__qaRevision = ${++workerRevision}; self.__qaHandlers = {}; const originalAdd = self.addEventListener.bind(self); self.addEventListener = (name, callback) => { self.__qaHandlers[name] = callback; originalAdd(name, (event) => { if (name === 'push') self.__qaLastPush = event.data?.json()?.__qa_id; callback(event); }); };\n` + await readFile(resolve(root, 'public/voice-push-worker.js'), 'utf8'));
  } else if (request.url === '/api/voice/push/revoke') {
    requests.push(request.url); response.statusCode = 204; response.end();
  } else if (request.url.startsWith('/brand/')) {
    response.setHeader('Content-Type', 'image/png'); response.end(await readFile(resolve(root, 'public/brand/re/favicon-192.png')));
  } else {
    response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>Local call alert verification</title><p>REPro local worker test</p>');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  const context = await browser.newContext({ permissions: ['notifications'] });
  await context.grantPermissions(['notifications'], { origin });
  const page = await context.newPage();
  await page.goto(origin + '/calls');
  const cdp = await context.newCDPSession(page);
  let registrationId; let versionId;
  cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => { registrationId = registrations.find((r) => r.scopeURL === origin + '/')?.registrationId ?? registrationId; });
  cdp.on('ServiceWorker.workerVersionUpdated', ({ versions }) => { versionId = versions.find((v) => v.status === 'activated')?.versionId ?? versionId; });
  await cdp.send('ServiceWorker.enable');
  await page.evaluate(async () => { await navigator.serviceWorker.register('/voice-push-worker.js'); await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const message = (data) => page.evaluate(async (data) => {
    const registration = await navigator.serviceWorker.ready;
    return await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => reject(new Error('Worker reply timed out')), 5000);
      channel.port1.onmessage = ({ data }) => { clearTimeout(timer); resolve(data); };
      registration.active.postMessage(data, [channel.port2]);
    });
  }, data);
  const identity = { id: '00000000-0000-4000-8000-000000000002', scope: 'scope-a', user_id: '9', revoke_token: 't'.repeat(64) };
  assert.equal((await message({ type: 'VOICE_PUSH_SAVE', subscription: identity })).ok, true);
  assert.equal(await page.evaluate(() => Notification.permission), 'granted', 'Run with installed Chrome; Windows headless shell disables notifications');
  const payload = { version: 1, event: 'incoming', offer_id: '00000000-0000-4000-8000-000000000001', scope: 'scope-a', expires_at: new Date(Date.now() + 45000).toISOString(), url: 'https://malicious.invalid/' };
  const notifications = () => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, tag: n.tag, data: n.data })));
  const settle = async () => { const worker = context.serviceWorkers().at(-1); if (worker) await worker.evaluate(() => serial); };
  const push = async (data) => {
    const key = crypto.randomUUID();
    assert.ok(registrationId); await cdp.send('ServiceWorker.deliverPushMessage', { origin, registrationId, data: JSON.stringify({ ...data, __qa_id: key }) });
    const deadline = Date.now() + 5000;
    while (true) {
      const worker = context.serviceWorkers().at(-1);
      if (worker && await worker.evaluate((key) => self.__qaLastPush === key, key).catch(() => false)) break;
      if (Date.now() > deadline) throw new Error('Chromium did not dispatch the injected push');
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    // A reply is queued after the worker push handler's serial transaction.
    await message({ type: 'VOICE_PUSH_STATUS' }); await settle();
  };
  await push(payload);
  assert.equal((await notifications())[0]?.title, 'Incoming REPro call');
  await push({ ...payload, event: 'closed' });
  assert.equal((await notifications())[0]?.title, 'REPro call update');
  await push(payload); assert.equal((await notifications())[0]?.title, 'REPro call update', 'late incoming must not reopen a closed offer');
  await push({ ...payload, offer_id: '00000000-0000-4000-8000-000000000003', scope: 'another-account' });
  assert.equal((await notifications()).length, 1, 'wrong account scope must not add an alert');
  await push({ ...payload, offer_id: '00000000-0000-4000-8000-000000000004', expires_at: new Date(Date.now() - 1000).toISOString() });
  assert.ok((await notifications()).every((n) => n.title !== 'Incoming REPro call'), 'expired offers must not ring');
  console.log('Push, closure, scope and expiry checks passed.');
  assert.ok(versionId);
  // Stopping a worker with a Playwright inspector attached can block Chrome;
  // update the script instead to activate a fresh worker with the same durable database.
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await new Promise((resolve) => { navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }); void registration.update(); });
  });
  assert.ok(await context.serviceWorkers().at(-1).evaluate(() => self.__qaRevision > 1));
  const restarted = { ...payload, offer_id: '00000000-0000-4000-8000-000000000005' };
  await push(restarted);
  assert.ok((await notifications()).some((n) => n.title === 'Incoming REPro call'), 'saved account authorization survives worker restart');
  console.log('Durable state checked.');
  const worker = context.serviceWorkers().at(-1);
  await worker.evaluate(async () => {
    const notification = (await self.registration.getNotifications()).find((n) => n.title === 'Incoming REPro call');
    await new Promise((resolve, reject) => self.__qaHandlers.notificationclick({ notification, waitUntil: (promise) => promise.then(resolve, reject) }));
  }).catch((error) => { if (!String(error).includes('Service worker restarted')) throw error; });
  assert.equal(new URL(page.url()).origin, origin);
  assert.equal(new URL(page.url()).pathname, '/calls');
  assert.equal(new URL(page.url()).searchParams.get('offer'), restarted.offer_id);
  await message({ type: 'VOICE_PUSH_IDENTITY', user_id: null, enabled: false });
  assert.equal((await message({ type: 'VOICE_PUSH_STATUS' })).subscription, null);
  assert.equal(requests.length, 1, 'logout sends revoke-only capability');
  await push({ ...payload, offer_id: '00000000-0000-4000-8000-000000000006' });
  assert.equal((await notifications()).length, 0, 'no call alerts after logout');
  console.log(JSON.stringify({ passed: true, checks: ['real push event', 'offer closure', 'late event rejection', 'scope isolation', 'expiry', 'durable worker restart', 'safe click navigation', 'logout revocation'], external_delivery: false }));
  await context.close();
} finally {
  await browser.close(); await new Promise((resolve) => server.close(resolve));
}
