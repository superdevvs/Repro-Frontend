import type { Page, Route } from '@playwright/test';
import type { ApiShoot } from '../../src/context/shootApiTypes';
import type {
  DashboardOverviewResponse,
  DashboardPhotographerResponse,
  DashboardShootSummaryResponse,
} from '../../src/types/dashboard';

export const dashboardMobileRowNames = {
  firstShoot: 'Mobile fixture shoot 01',
  lastShoot: 'Mobile fixture shoot 18',
  lastPhotographer: 'Mobile Photographer 18',
  // The dashboard card previews three deliveries; its footer opens the rest.
  lastCompleted: 'Mobile delivered shoot 03',
} as const;

export interface DashboardMobileRequest {
  method: string;
  path: string;
}

export interface DashboardMobileFixtures {
  requests: DashboardMobileRequest[];
  unexpectedRequests: DashboardMobileRequest[];
}

const fixtureToken = 'local-dashboard-playwright-fixture-not-a-real-token';
const completedAt = '2026-01-01T00:00:00Z';

const localDate = (date: Date) => [
  date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0'),
].join('-');

/** Local-only fixture: every API request is fulfilled here, never forwarded. */
export async function installDashboardMobileFixtures(
  page: Page,
  baseURL: string | undefined,
  role: 'admin' | 'superadmin' = 'admin',
): Promise<DashboardMobileFixtures> {
  if (!baseURL || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)) {
    throw new Error('Dashboard fixtures require a loopback E2E_BASE_URL; they must never target a deployed app.');
  }

  const user = {
    id: '900043', name: 'Mobile Test Admin', email: 'mobile-admin@example.test', role,
    account_status: 'active', email_verified_at: completedAt,
    metadata: {
      terms_accepted_at: completedAt,
      preferences: Object.fromEntries([
        'clientDashboardOnboarding', 'photographerDashboardOnboarding', 'salesRepDashboardOnboarding',
        'editingManagerDashboardOnboarding', 'editorDashboardOnboarding',
      ].map(key => [key, { eligible: false, version: 1, completedAt, dismissedAt: completedAt }])),
    },
  };
  const state: DashboardMobileFixtures = { requests: [], unexpectedRequests: [] };

  // Relative dates keep the Upcoming list populated on future test runs. Two
  // days ahead also avoids host/browser timezone differences around midnight.
  const upcomingDate = new Date();
  upcomingDate.setDate(upcomingDate.getDate() + 2);
  const day = localDate(upcomingDate);
  const photographers: DashboardPhotographerResponse[] = Array.from({ length: 18 }, (_, index) => ({
    id: 910001 + index, name: `Mobile Photographer ${String(index + 1).padStart(2, '0')}`,
    region: 'Austin, Texas', load_today: 0, available_from: '09:00', next_slot: '09:00',
    status: 'free', avatar: null, email: `photographer-${index + 1}@example.test`,
    phone: '+15125550100', travel_range: 25, travel_range_unit: 'miles',
  }));
  const scheduledShoots: ApiShoot[] = Array.from({ length: 18 }, (_, index) => ({
    id: 920001 + index,
    address: `Mobile fixture shoot ${String(index + 1).padStart(2, '0')}`,
    city: 'Austin', state: 'TX', zip: '78701', scheduled_date: day,
    time: `${String(9 + Math.floor(index / 3)).padStart(2, '0')}:${String((index % 3) * 20).padStart(2, '0')}`,
    status: 'scheduled', workflow_status: 'scheduled',
    client: { id: 940001, name: 'Fixture Client', email: 'client@example.test', email_verified: true },
    photographer: { id: photographers[index].id, name: photographers[index].name },
    services: [{ id: 1, name: 'Photography', price: 250, quantity: 1, photographer_id: photographers[index].id }],
    base_quote: 250, total_quote: 250, total_paid: 250, payment_status: 'paid',
    files: [], is_flagged: false, can_view_invoice: true,
  }));
  const upcoming: DashboardShootSummaryResponse[] = scheduledShoots.map(shoot => ({
    id: Number(shoot.id), address_line: shoot.address, city_state_zip: 'Austin, Texas, 78701',
    day_label: day, time_label: shoot.time, start_time: `${day}T${shoot.time}:00`,
    status: 'scheduled', workflow_status: 'scheduled', client_name: 'Fixture Client', client_id: 940001,
    services: [{ label: 'Photography', type: 'photo' }],
    photographer: { id: Number(shoot.photographer?.id), name: shoot.photographer?.name || '' },
    is_flagged: false, can_view_invoice: true,
  }));
  const delivered: DashboardShootSummaryResponse[] = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index - 1);
    const deliveredDay = localDate(date);
    return {
      id: 930001 + index, address_line: `Mobile delivered shoot ${String(index + 1).padStart(2, '0')}`,
      city_state_zip: 'Austin, Texas, 78701', day_label: deliveredDay,
      time_label: '10:00', start_time: `${deliveredDay}T10:00:00`,
      status: 'delivered', workflow_status: 'delivered', client_name: 'Fixture Client', client_id: 940001,
      services: [{ label: 'Photography', type: 'photo' }], is_flagged: false,
      delivery_deadline: `${deliveredDay}T18:00:00`, hero_image: '/studio-assets/hero-after.webp',
      preview_images: ['/studio-assets/hero-after.webp'], can_view_invoice: true,
    };
  });
  const overview: DashboardOverviewResponse = {
    stats: { total_shoots: 24, scheduled_today: 0, flagged_shoots: 0, pending_reviews: 0 },
    upcoming_shoots: upcoming, photographers, pending_reviews: [], activity_log: [], issues: [],
    pending_cancellations: [],
    workflow: { columns: [
      { key: 'scheduled', label: 'Scheduled', accent: 'blue', count: upcoming.length, shoots: upcoming },
      { key: 'delivered', label: 'Delivered', accent: 'green', count: delivered.length, shoots: delivered },
    ] },
  };

  await page.addInitScript(({ user, fixtureToken }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('theme', 'light');
    localStorage.setItem('authToken', fixtureToken);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('user_preferences', JSON.stringify({ temperatureUnit: 'fahrenheit', timeFormat: '12h' }));
  }, { user, fixtureToken });

  const reply = (route: Route, value: unknown, status = 200) => route.fulfill({
    status, contentType: 'application/json', body: JSON.stringify(value),
  });
  const data = (route: Route, value: unknown) => reply(route, { success: true, data: value });
  const permissionResources = [
    'dashboard', 'dashboard-admin', 'dashboard-availability', 'dashboard-editing-requests',
    'dashboard-contact-actions', 'shoots', 'shoot-history', 'availability', 'book-shoot',
    'accounting', 'invoices', 'accounts', 'ai-editing',
  ];

  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = request.method();
    if (method === 'OPTIONS') return reply(route, {});
    const entry = { method, path };
    state.requests.push(entry);

    if (path === '/user') return reply(route, user);
    if (path === '/me/permissions') return reply(route, {
      permissionIds: permissionResources.flatMap(resource => ['view', 'create', 'update'].map(action => `${resource}:${action}`)),
      permissions: permissionResources.flatMap(resource => ['view', 'create', 'update'].map(action => ({ resource, action }))),
    });
    if (path === '/dashboard/overview') return data(route, overview);
    if (path === '/shoots' && method === 'GET') {
      const rows = ['completed', 'delivered'].includes(url.searchParams.get('tab') || '') ? [] : scheduledShoots;
      return reply(route, { success: true, data: rows, meta: {
        current_page: 1, last_page: 1, per_page: 25, total: rows.length, count: rows.length,
      } });
    }
    if (path === '/photographer/availability/available-photographers' && method === 'POST') {
      return data(route, photographers.map(photographer => ({ photographer_id: photographer.id })));
    }
    if (path === '/notifications') return data(route, { activity_log: [], unread_count: 0 });
    if (path === '/weather') return data(route, {
      temperature: '72°F', temperatureC: 22, temperatureF: 72, icon: 'sunny', description: 'Clear', location: 'Austin',
    });
    if (path === '/ip-location') return reply(route, {
      city: 'Austin', region: 'Texas', country: 'United States', latitude: 30.2672, longitude: -97.7431,
    });
    if (['/client-requests', '/editing-requests', '/shoots/pending-cancellations'].includes(path)) return data(route, []);

    // Shared shell requests are still recorded so a test can tighten its API
    // assertions; no fallback can reach a configured production API.
    state.unexpectedRequests.push(entry);
    if (method === 'GET') return reply(route, { success: true, data: [], notifications: [], unread_count: 0 });
    return reply(route, { message: `Unmocked fixture operation: ${method} ${path}` }, 501);
  });
  return state;
}
