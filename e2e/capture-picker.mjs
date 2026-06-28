// Capture: log in as admin, open the booking-request Approve/Modify modal from the
// dashboard at a DESKTOP viewport, open the photographer picker, screenshot it.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'qa.admin@example.test';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'QaDemo123!';
const OUT = 'C:/Users/shubh/Desktop/work/repro/Dashboard/Live working/output/picker-capture';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('[capture]', ...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') log('page.error:', m.text().slice(0, 120)); });

const dumpButtons = async (label) => {
  const names = await page.getByRole('button').evaluateAll((els) =>
    [...new Set(els.map((e) => (e.textContent || '').trim()).filter(Boolean))].slice(0, 80));
  log(label, JSON.stringify(names));
  return names;
};
const clickFirst = async (patterns) => {
  for (const name of patterns) {
    const b = page.getByRole('button', { name }).first();
    if ((await b.count()) && (await b.isVisible().catch(() => false))) {
      await b.click().catch(() => {});
      return name.toString();
    }
  }
  return null;
};

try {
  await page.goto(BASE + '/');
  await page.getByPlaceholder('Email').fill(EMAIL);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await page.waitForTimeout(4000);
  log('logged in');

  // Open booking requests review from the dashboard.
  await clickFirst([/View details/i, /booking requests/i, /Review/i]);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/02-requests.png`, fullPage: true });
  await dumpButtons('requests');

  // Open Modify modal (ShootEditModal). Fall back to Approve (ShootApprovalModal).
  let which = await clickFirst([/^Open #\d+/i, /View request details/i, /^Modify$/i, /^Approve$/i]);
  log('opened request via', which);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/04-modal.png`, fullPage: true });
  await dumpButtons('modal');

  // If a request detail opened, click its Modify/Approve action to reach the editor.
  const action = await clickFirst([/^Modify$/i, /Modify Request/i, /^Approve$/i, /Approve Request/i]);
  if (action) { log('clicked action', action); await page.waitForTimeout(3000); await dumpButtons('after-action'); }

  // Open the photographer picker.
  const opened = await clickFirst([/Select photographer/i, /Edit photographer/i, /Change [Pp]hotographer/i]);
  log('opened picker via', opened);
  await page.waitForTimeout(2500);

  const headingVisible = await page.getByText(/Select Photographer/i).first().isVisible().catch(() => false);
  const box = await page.locator('[role="dialog"]').last().boundingBox().catch(() => null);
  log('picker heading visible:', headingVisible, 'box:', JSON.stringify(box));
  if (box) log('centered desktop dialog (not bottom sheet):', box.y > 40 && (box.y + box.height) < 870);
  await page.screenshot({ path: `${OUT}/05-picker.png` });
  log('done -> screenshots in', OUT);
} catch (e) {
  log('ERROR:', e.message);
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
} finally {
  await browser.close();
}
