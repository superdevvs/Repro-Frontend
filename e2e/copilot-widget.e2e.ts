import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const widget = fs.readFileSync(path.resolve(process.cwd(), '../backend/resources/views/copilot/widget.blade.php'), 'utf8');
const draft = { draft_id: '11111111-1111-4111-8111-111111111111', review_hash: 'a'.repeat(64), kind: 'booking', status: 'prepared',
  expires_at: '2030-10-09T12:00:00Z', review: { action: 'Create a standard shoot', property: { address: '24 Oak Lane' },
    services: [{ name: 'Photography', price: 100 }], pricing: { total_quote: 106 }, notifications: { notify_client: true, notify_photographer: false } } };

function harness() {
  return `<!doctype html><html><body><iframe title="Repro card" style="width:100%;height:1200px;border:0"></iframe><script>
  window.calls=[];
  const frame=document.querySelector('iframe');
  window.addEventListener('message',event=>{
    if(event.source!==frame.contentWindow)return; const message=event.data;
    if(message.method==='ui/initialize'){frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,result:{hostContext:{theme:'light'}}},'*');}
    if(message.method==='tools/call'){window.calls.push(message.params);const name=message.params.name;
      const data=name==='commit_action'?{draft_id:'done',message:'Shoot request submitted for team review.'}:name==='search'?{results:[{id:'shoot:1',title:'24 Oak Lane',url:'https://reprodashboard.com/shoots/1'}],total:1}:{};
      frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,result:{structuredContent:data}},'*');}
  });
  frame.srcdoc=${JSON.stringify(widget).replace(/<\//g, '<\\/')};
  </script></body></html>`;
}

for (const width of [390, 1024]) {
  test(`card approval, search and responsive layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('https://repro-plugin-preview.test/', route => route.fulfill({ contentType: 'text/html', body: harness() }));
    await page.goto('https://repro-plugin-preview.test/');
    const frame = page.frameLocator('iframe');
    await expect(frame.getByRole('heading', { name: 'Repro Copilot' })).toBeVisible();
    await page.evaluate(data => document.querySelector('iframe')?.contentWindow?.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: data } }, '*'), draft);
    await expect(frame.getByRole('button', { name: 'Confirm action' })).toBeDisabled();
    await expect(frame.getByText('24 Oak Lane', { exact: true })).toBeVisible();
    if (process.env.REPRO_COPILOT_ARTIFACTS) await frame.locator('main').screenshot({ path: path.join(process.env.REPRO_COPILOT_ARTIFACTS, `action-review-${width}.png`) });
    await frame.getByRole('checkbox').check();
    await frame.getByRole('button', { name: 'Confirm action' }).click();
    await expect(frame.getByText('Shoot request submitted for team review.')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { calls: { name: string }[] }).calls.filter(call => call.name === 'commit_action').length)).toBe(1);
    await frame.getByRole('searchbox').fill('Oak'); await frame.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(frame.getByRole('link', { name: 'Open in Repro' })).toHaveAttribute('href', 'https://reprodashboard.com/shoots/1');
    const actualFrame = page.frames()[1];
    expect(await actualFrame.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('untrusted property content is displayed as text and unsafe links are omitted', async ({ page }) => {
  await page.route('https://repro-plugin-preview.test/', route => route.fulfill({ contentType: 'text/html', body: harness() }));
  await page.goto('https://repro-plugin-preview.test/');
  await page.evaluate(() => document.querySelector('iframe')?.contentWindow?.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result',
    params: { structuredContent: { results: [{ id: 'shoot:1', title: '<img src=x onerror="window.hacked=true">', url: 'javascript:alert(1)' }] } } }, '*'));
  const frame = page.frameLocator('iframe');
  await expect(frame.getByText('<img src=x onerror="window.hacked=true">', { exact: true })).toBeVisible();
  await expect(frame.locator('img')).toHaveCount(0); await expect(frame.getByRole('link', { name: 'Open in Repro' })).toHaveCount(0);
});

test('changed previews cannot be confirmed and catalog rates remain visible', async ({ page }) => {
  await page.route('https://repro-plugin-preview.test/', route => route.fulfill({ contentType: 'text/html', body: harness() }));
  await page.goto('https://repro-plugin-preview.test/');
  await page.evaluate(data => document.querySelector('iframe')?.contentWindow?.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: data } }, '*'), { ...draft, review_changed: true });
  const frame = page.frameLocator('iframe');
  await expect(frame.getByText('This preview changed. Prepare and review a new action.')).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Confirm action' })).toHaveCount(0);
  await page.evaluate(() => document.querySelector('iframe')?.contentWindow?.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result',
    params: { structuredContent: { data: [{ id: 7, name: 'Photography', catalog_price: 120, duration_minutes: 60 }], price_basis: 'Catalog only' } } }, '*'));
  await expect(frame.getByText('120', { exact: true })).toBeVisible();
  await expect(frame.getByText('Catalog only', { exact: true })).toBeVisible();
});
