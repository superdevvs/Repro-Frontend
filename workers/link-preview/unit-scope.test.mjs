import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './src/index.js';

test('the edge keeps unit and provider identity when requesting share metadata', async () => {
  const originalFetch = globalThis.fetch;
  const originalRewriter = globalThis.HTMLRewriter;
  const requests = [];
  globalThis.fetch = async input => {
    const url = String(input.url ?? input);
    requests.push(url);
    return url.includes('/api/public/link-previews/')
      ? Response.json({ title: 'Unit 42', description: 'Unit tour', url: 'https://reprodashboard.test/tour/3d/mls?shootId=7&unitId=42&provider=iguide', image: { url: 'https://reprodashboard.test/og-tour.jpg' } })
      : new Response('<html><head></head></html>', { headers: { 'Content-Type': 'text/html' } });
  };
  globalThis.HTMLRewriter = class { on() { return this; } transform(response) { return response; } };
  try {
    await worker.fetch(new Request('https://reprodashboard.test/tour/3d/mls?shootId=7&unitId=42&provider=iguide'), { API_ORIGIN: 'https://api.test' });
    const metadata = requests.find(url => url.includes('/api/public/link-previews/'));
    assert.equal(new URL(metadata).searchParams.get('unitId'), '42');
    assert.equal(new URL(metadata).searchParams.get('shootId'), '7');
    assert.equal(new URL(metadata).searchParams.get('provider'), 'iguide');
    requests.length = 0;
    await worker.fetch(new Request('https://reprodashboard.test/tour/branded?shootId=7&unitId=bad'), { API_ORIGIN: 'https://api.test' });
    assert.equal(requests.some(url => url.includes('/api/public/link-previews/')), false);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.HTMLRewriter = originalRewriter;
  }
});
