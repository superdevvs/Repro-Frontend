import { expect, test } from '@playwright/test';
import { installDashboardMobileFixtures } from './helpers/dashboard-mobile-fixtures';

test.use({ channel: process.env.E2E_CHROME_CHANNEL || undefined, actionTimeout: 15_000 });
test.setTimeout(120_000);

for (const role of ['admin', 'salesRep'] as const) for (const width of [1440, 390]) {
  test(`${role} sees recent delivery first on dashboard and history at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await installDashboardMobileFixtures(page, baseURL, role);
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const recentName = 'Old booking delivered today';
    const previousName = 'Newer booking delivered yesterday';
    const dayAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const recent = {
      id: 11, address: recentName, scheduled_date: dayAgo(7), time: '10:00',
      admin_verified_at: `${dayAgo(0)}T15:00:00Z`, completed_at: `${dayAgo(0)}T15:00:00Z`,
    };
    const previous = {
      id: 22, address: previousName, scheduled_date: dayAgo(1), time: '10:00',
      admin_verified_at: `${dayAgo(1)}T15:00:00Z`, completed_at: `${dayAgo(1)}T15:00:00Z`,
    };
    const rows = [recent, previous].map(shoot => ({
      ...shoot, status: 'delivered', workflow_status: 'delivered', city: 'Austin', state: 'TX', zip: '78701',
      completed_date: shoot.completed_at, payment_status: 'paid', total_quote: 250, total_paid: 250, rep_id: '900043',
      client: { id: 940001, name: 'Fixture Client', email: 'client@example.test' },
      services: [{ id: 1, name: 'Photography', price: 250 }], files: [],
    }));
    const requests: URL[] = [];
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api/, '');
      const reply = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      if (path === '/dashboard/overdue-clients') return reply({ data: [], meta: { total: 0, page: 1, lastPage: 1 } });
      if (path === '/system-telemetry/events') return reply({ success: true });
      if (path === '/dashboard/overview') return reply({ data: {
        stats: {}, upcoming_shoots: [], photographers: [], pending_reviews: [], activity_log: [], issues: [],
        workflow: { columns: [] }, latest_deliveries: [...rows].reverse().map(shoot => ({
          ...shoot, address_line: shoot.address, services: [],
          start_time: `${shoot.scheduled_date}T10:00:00Z`, delivered_at: shoot.admin_verified_at,
        })),
      } });
      if (path === '/shoots' || path === '/shoots/history') {
        requests.push(url);
        const delivered = path === '/shoots/history' || url.searchParams.get('tab') === 'delivered';
        const sorted = url.searchParams.get('sort') === 'date_desc' ? [...rows].reverse() : rows;
        const records = path === '/shoots/history' ? sorted.map(shoot => ({
          id: shoot.id, status: shoot.status, scheduledDate: shoot.scheduled_date, time: shoot.time,
          completedDate: shoot.completed_at, client: shoot.client, photographer: { name: 'Fixture Photographer' },
          address: { street: shoot.address, full: shoot.address, city: shoot.city, state: shoot.state, zip: shoot.zip },
          services: ['Photography'], financials: { totalQuote: 250, totalPaid: 250, baseQuote: 250 }, notes: {},
        })) : sorted;
        return reply({ data: delivered ? records : [], meta: {
          current_page: 1, last_page: 1, per_page: 12, total: delivered ? 2 : 0, count: delivered ? 2 : 0,
        } });
      }
      return route.fallback();
    });

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    if (width < 1024) await page.getByRole('tab', { name: /^Completed\b/ }).click();
    const cards = page.locator('[data-delivered-shoot-card="true"]').filter({ visible: true });
    await expect(cards.first()).toContainText(recentName);
    for (const tab of ['delivered', 'history']) {
      await page.goto(`/shoot-history?tab=${tab}`, { waitUntil: 'domcontentloaded' });
      await expect.poll(() => requests.some(url =>
        (tab === 'history' ? url.pathname.endsWith('/shoots/history') : url.searchParams.get('tab') === tab)
        && url.searchParams.get('sort') === 'delivered_desc',
      )).toBe(true);
      await expect(page.getByText(recentName, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      const content = await page.locator('main').innerText();
      expect(content.indexOf(recentName)).toBeLessThan(content.indexOf(previousName));
      if (width >= 1024) {
        await page.getByRole('button', { name: 'Sort shoots', exact: true }).click();
        await expect(page.getByRole('menuitemradio', { name: 'Recently delivered', exact: true })).toHaveAttribute('data-state', 'checked');
        await page.getByRole('menuitemradio', { name: 'Date: latest first', exact: true }).click();
        await expect.poll(() => requests.some(url => url.searchParams.get('sort') === 'date_desc')).toBe(true);
        await expect.poll(async () => {
          const text = await page.locator('main').innerText();
          return text.indexOf(previousName) < text.indexOf(recentName);
        }).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    expect(pageErrors).toEqual([]);
  });
}
