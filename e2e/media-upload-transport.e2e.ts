import { expect, test } from '@playwright/test';
import { createServer, request as proxyRequest, type Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Real loopback HTTP transfers; no production credentials, storage or API calls.
let server: Server;
let uploadUrl: string;
let fixtureDirectory: string;
const received: { contentType: string; bytes: Buffer }[] = [];

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) {
    throw new Error('Upload transport verification requires a local Vite server');
  }
  fixtureDirectory = await mkdtemp(join(tmpdir(), 'repro-upload-transport-'));
  await writeFile(join(fixtureDirectory, 'IMG_0001.CR3'), 'first RAW camera bytes');
  await writeFile(join(fixtureDirectory, 'IMG_0002.CR3'), 'second RAW camera bytes');
  server = createServer((request, response) => {
    if (request.url === '/upload-transport-fixture') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<input type="file" multiple><iframe></iframe>');
      return;
    }
    if (request.url !== '/api/shoots/2374/upload') {
      const proxy = proxyRequest(new URL(request.url ?? '/', baseURL), upstream => {
        response.writeHead(upstream.statusCode ?? 500, upstream.headers);
        upstream.pipe(response);
      });
      proxy.on('error', () => response.writeHead(502).end());
      request.pipe(proxy);
      return;
    }
    const chunks: Buffer[] = [];
    request.on('data', chunk => chunks.push(Buffer.from(chunk)));
    request.on('end', () => {
      received.push({ contentType: request.headers['content-type'] ?? '', bytes: Buffer.concat(chunks) });
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ success_count: 1 }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No loopback upload listener');
  uploadUrl = `http://127.0.0.1:${address.port}/api/shoots/2374/upload`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await rm(fixtureDirectory, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  received.length = 0;
  await page.goto(new URL('/upload-transport-fixture', uploadUrl).href);
});

test('file-picker RAWs still send exact bytes after the input is cleared', async ({ page }) => {
  await page.locator('input').setInputFiles([
    join(fixtureDirectory, 'IMG_0001.CR3'), join(fixtureDirectory, 'IMG_0002.CR3'),
  ]);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const results = await page.evaluate(async url => {
    const modulePath = '/src/components/shoots/tabs/media/uploadMediaRequest.ts';
    const { uploadMediaRequest } = await import(/* @vite-ignore */ modulePath);
    const input = document.querySelector('input')!;
    const files = Array.from(input.files!);
    input.value = '';
    const results = [];
    for (let index = 0; index < files.length; index++) {
      const body = new FormData();
      body.append('files[]', files[index]);
      body.append('upload_type', 'raw');
      body.append('idempotency_key', `attempt-${index}`);
      body.append('upload_batch_id', 'original-batch');
      body.append('upload_batch_index', String(index));
      body.append('shoot_service_id', '2456');
      results.push(await uploadMediaRequest({ url, body, headers: { Authorization: 'Bearer local-fixture' }, onProgress: () => {} }));
    }
    return results;
  }, uploadUrl);
  expect(results).toEqual([{ ok: true, status: 200, responseText: '{"success_count":1}' }, { ok: true, status: 200, responseText: '{"success_count":1}' }]);
  expect(received).toHaveLength(2);
  for (let index = 0; index < received.length; index++) {
    expect(received[index].contentType).toMatch(/^multipart\/form-data; boundary=/);
    const payload = received[index].bytes.toString();
    expect(payload).toContain(`filename="IMG_000${index + 1}.CR3"`);
    expect(payload).toContain(index === 0 ? 'first RAW camera bytes' : 'second RAW camera bytes');
    expect(payload).toContain(`\r\n\r\nattempt-${index}\r\n`);
    expect(payload).toContain('\r\n\r\noriginal-batch\r\n');
    expect(payload).toContain('\r\n\r\n2456\r\n');
  }
  expect(errors).toEqual([]);
});

test('cross-window files preserve bytes and retry identity', async ({ page }) => {
  const results = await page.evaluate(async url => {
    const modulePath = '/src/components/shoots/tabs/media/uploadMediaRequest.ts';
    const { uploadMediaRequest } = await import(/* @vite-ignore */ modulePath);
    const frame = document.querySelector('iframe')!.contentWindow!;
    const ForeignFile = (frame as unknown as { File: typeof File }).File;
    const file = new ForeignFile(['cross-window RAW bytes'], 'foreign.CR3');
    const body = new FormData();
    body.append('files[]', file);
    body.append('idempotency_key', 'same-attempt-on-retry');
    body.append('upload_batch_id', 'same-batch-on-retry');
    const options = { url, body, headers: {}, onProgress: () => {} };
    return { foreign: !(body.get('files[]') instanceof File), results: [await uploadMediaRequest(options), await uploadMediaRequest(options)] };
  }, uploadUrl);
  expect(results.foreign).toBe(true);
  expect(results.results.every(result => result.ok)).toBe(true);
  expect(received).toHaveLength(2);
  for (const request of received) {
    const payload = request.bytes.toString();
    expect(payload).toContain('filename="foreign.CR3"');
    expect(payload).toContain('cross-window RAW bytes');
    expect(payload).toContain('same-attempt-on-retry');
    expect(payload).toContain('same-batch-on-retry');
  }
});
