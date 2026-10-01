/* Call alerts only. This worker never caches authenticated pages or API responses. */
'use strict';
const DATABASE = 'repro-call-alerts-v1';
let serial = Promise.resolve();
function transaction(work) { serial = serial.catch(() => undefined).then(work); return serial; }
function store(mode, work) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DATABASE, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('state');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('state', mode);
      const result = work(tx.objectStore('state'));
      tx.oncomplete = () => { db.close(); resolve(result?.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}
const read = (key) => store('readonly', (db) => db.get(key));
const write = (key, value) => store('readwrite', (db) => db.put(value, key));
async function closeAlerts(tag) {
  const alerts = await self.registration.getNotifications(tag ? { tag } : {});
  alerts.filter((n) => n.tag.startsWith('repro-call-')).forEach((n) => n.close());
}
async function revoke(state) {
  if (!state?.id || !state?.revoke_token) return;
  const response = await fetch('/api/voice/push/revoke', { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ id: state.id, token: state.revoke_token }) });
  if (!response.ok) throw new Error('Revocation has not been acknowledged.');
}
async function clear(state) {
  // Clear local authorization first even when offline; keep only the revoke capability for retry.
  await write('subscription', null);
  await closeAlerts();
  if (state) await write('pending_revocation', { id: state.id, revoke_token: state.revoke_token });
  await self.registration.pushManager.getSubscription().then((s) => s?.unsubscribe()).catch(() => undefined);
  try { await revoke(state); await write('pending_revocation', null); } catch { /* Retry when the app next opens. */ }
}
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  if (!event.source?.url || new URL(event.source.url).origin !== self.location.origin) return;
  const data = event.data || {};
  event.waitUntil(transaction(async () => {
    const state = await read('subscription');
    if (data.type === 'VOICE_PUSH_IDENTITY') {
      const pending = await read('pending_revocation');
      if (pending) { try { await revoke(pending); await write('pending_revocation', null); } catch { /* Remain locally revoked. */ } }
      if (state && (!data.user_id || String(state.user_id) !== String(data.user_id) || !data.enabled)) await clear(state);
    } else if (data.type === 'VOICE_PUSH_SAVE') {
      if (!data.subscription?.scope || !data.subscription?.user_id) throw new Error('Missing notification identity.');
      if (state && state.scope !== data.subscription.scope) await closeAlerts();
      await write('subscription', data.subscription);
      await write('closed_offers', {});
    } else if (data.type === 'VOICE_PUSH_CLEAR') {
      await clear(state);
    } else if (data.type === 'VOICE_PUSH_CLOSE') {
      if (/^[a-f0-9-]{36}$/i.test(data.offer_id || '')) {
        const closed = await read('closed_offers') || {};
        closed[data.offer_id] = Date.now();
        await write('closed_offers', closed);
        await closeAlerts('repro-call-' + data.offer_id);
      }
    }
    event.ports?.[0]?.postMessage({ ok: true, subscription: data.type === 'VOICE_PUSH_STATUS' ? state : undefined });
  }).catch(() => event.ports?.[0]?.postMessage({ ok: false })));
});
self.addEventListener('push', (event) => {
  event.waitUntil(transaction(async () => {
    let data;
    try { data = event.data?.json(); } catch { return; }
    const state = await read('subscription');
    if (!state || data?.version !== 1 || data.scope !== state.scope || !/^[a-f0-9-]{36}$/i.test(data.offer_id || '')) return;
    const tag = 'repro-call-' + data.offer_id;
    const closed = Object.fromEntries(Object.entries(await read('closed_offers') || {}).filter(([, time]) => Date.now() - Number(time) < 300000));
    const showResolved = () => self.registration.showNotification('REPro call update', {
      body: 'This call is no longer waiting. Open Calls for its current status.',
      icon: '/brand/re/favicon-192.png', badge: '/brand/re/favicon-192.png', tag,
      silent: true, renotify: false,
      data: { scope: state.scope, offer_id: data.offer_id, event: 'closed', expires_at: data.expires_at },
    });
    if (data.event === 'closed') {
      closed[data.offer_id] = Date.now(); await write('closed_offers', closed);
      // Web Push requires a visible result (including Safari). Replace the ringing
      // notification with a quiet resolved update; never send a silent background push.
      await showResolved(); return;
    }
    if (!['incoming', 'test'].includes(data.event) || !Number.isFinite(Date.parse(data.expires_at))) return;
    if (closed[data.offer_id] || Date.parse(data.expires_at) <= Date.now()) { await showResolved(); return; }
    await self.registration.showNotification(data.event === 'test' ? 'REPro call alerts are working' : 'Incoming REPro call', {
      body: data.event === 'test' ? 'This device received the test notification.' : 'Open Calls to see who is calling and answer.',
      icon: '/brand/re/favicon-192.png', badge: '/brand/re/favicon-192.png', tag,
      renotify: false, requireInteraction: data.event === 'incoming',
      data: { scope: state.scope, offer_id: data.offer_id, event: data.event, expires_at: data.expires_at },
    });
    await write('closed_offers', closed);
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(transaction(async () => {
    const state = await read('subscription');
    const data = event.notification.data;
    if (!state || data?.scope !== state.scope) return;
    // Construct the destination locally. A push payload cannot navigate to an arbitrary origin.
    const path = data.event === 'incoming' && Date.parse(data.expires_at) > Date.now() ? '/calls?offer=' + encodeURIComponent(data.offer_id) : '/calls';
    const url = new URL(path, self.location.origin).href;
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin && new URL(client.url).pathname.startsWith('/calls'));
    if (existing) { await existing.navigate(url); await existing.focus().catch(() => undefined); }
    else await self.clients.openWindow(url);
  }));
});
self.addEventListener('notificationclose', (event) => {
  // Dismissing an OS alert does not decline or claim the shared call.
  event.waitUntil(Promise.resolve());
});
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(transaction(async () => {
    await clear(await read('subscription'));
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.postMessage({ type: 'VOICE_PUSH_RECONNECT' }));
  }));
});
