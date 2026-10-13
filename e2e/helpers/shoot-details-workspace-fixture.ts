import type { Page, Route } from '@playwright/test';

export type ShootWorkspaceRole = 'admin' | 'client' | 'editor' | 'photographer' | 'salesRep';
export const workspaceAddress = '1732 Fletchers Drive';
export const workspaceClientEmail = 'tracy@example.test';
export const workspaceClientPhone = '(301) 748-6029';
export const workspaceEditedPhotoCount = 6;
export const workspaceRawUploadSummaryId = 'workspace-raw-upload-156';
export const workspaceEditedUploadSummaryId = 'workspace-edited-upload-156';

/** This fixture blocks external traffic and fulfills every API request locally. */
export async function installShootDetailsWorkspaceFixture(
  page: Page,
  baseURL: string | undefined,
  role: ShootWorkspaceRole = 'admin',
  theme: 'light' | 'dark' = 'dark',
  options: { largeCompletionCounts?: boolean } = {},
) {
  if (!baseURL || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)) {
    throw new Error('Shoot workspace acceptance requires a loopback preview.');
  }
  const completedAt = '2026-01-01T00:00:00Z';
  const user = {
    id: role === 'photographer' ? 21 : role === 'client' ? 10 : 901,
    name: `${role} Local Review`, email: `${role}@example.test`, role,
    account_status: 'active', email_verified_at: completedAt,
    metadata: { terms_accepted_at: completedAt, preferences: Object.fromEntries([
      'clientDashboardOnboarding', 'photographerDashboardOnboarding', 'salesRepDashboardOnboarding',
      'editingManagerDashboardOnboarding', 'editorDashboardOnboarding',
    ].map(key => [key, { eligible: false, version: 1, completedAt, dismissedAt: completedAt }])) },
  };
  const photo = '/studio-assets/hero-after.webp';
  const secondPhoto = '/studio-assets/hero-before.webp';
  const localAsset = (assetPath: string) => new URL(assetPath, baseURL).href;
  const makeFile = (id: number, filename: string, mediaType: string, serviceId: number, edited = false, imageUrl = id % 2 ? photo : secondPhoto) => ({
    id, shoot_id: 156, shoot_service_id: serviceId, filename,
    file_type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
    mime_type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
    media_type: mediaType, workflow_stage: edited ? 'verified' : 'todo', scan_status: 'clean',
    thumbnail_url: imageUrl, grid_url: imageUrl,
    url: imageUrl, original_url: imageUrl,
    width: 1600, height: 1067, file_size: 1500000, can_delete: role === 'admin',
    sort_order: id, captured_at: '2026-10-08T14:00:00Z', created_at: '2026-10-08T15:00:00Z',
  });
  const rawFiles = options.largeCompletionCounts ? [] : [
    makeFile(1, 'Front exterior.jpg', 'raw', 101), makeFile(2, 'Living room.jpg', 'raw', 101),
    makeFile(3, 'Property walkthrough.mp4', 'video', 103), makeFile(4, 'Floor plan.jpg', 'floorplan', 102),
  ];
  const uploadSummaries = [
    { id: workspaceRawUploadSummaryId, uploadType: 'raw', fileCount: 4, totalBytes: 6000000, completedAt: new Date(Date.now() - 120000).toISOString() },
    { id: workspaceEditedUploadSummaryId, uploadType: 'edited', fileCount: options.largeCompletionCounts ? 56 : workspaceEditedPhotoCount, totalBytes: 9000000, completedAt: new Date(Date.now() - 120000).toISOString() },
  ];
  const editedFiles = [
    makeFile(11, 'Front exterior final.jpg', 'edited', 101, true),
    makeFile(12, 'Kitchen final.jpg', 'edited', 101, true, localAsset('/login-slides/slide%20(5).jpg')),
    makeFile(13, 'Study final.jpg', 'edited', 101, true, localAsset('/login-slides/slide%20(3).jpg')),
    makeFile(14, 'Bathroom final.jpg', 'edited', 101, true, localAsset('/login-slides/slide%20(4).jpg')),
    makeFile(15, 'Dining room final.jpg', 'edited', 101, true, localAsset('/login-slides/slide%20(6).jpg')),
    makeFile(16, 'Front exterior alternate final.jpg', 'edited', 101, true, secondPhoto),
  ];
  const services = [
    { id: 101, name: 'HDR Photos', price: 250, quantity: 1, category: { id: 1, name: 'Photos' }, photographer_id: 21, photographer: { id: 21, name: 'Jay Snap' }, photo_count: options.largeCompletionCounts ? 45 : 2, upload_intake_type: 'photo', ...(options.largeCompletionCounts ? { uses_hdr_brackets: true, bracket_mode: 5, effective_bracket_mode: 5 } : {}) },
    { id: 102, name: 'Zillow 3D with Floor Plans', price: 125, quantity: 1, category: { id: 2, name: 'Floor Plans' }, photographer_id: 22, photographer: { id: 22, name: 'Alex Lens' }, upload_intake_type: 'none' },
    { id: 103, name: 'Listing Video', price: 50, quantity: 1, category: { id: 3, name: 'Video' }, photographer_id: 22, photographer: { id: 22, name: 'Alex Lens' }, upload_intake_type: 'video' },
  ].map(service => ({ ...service, workflow_status: 'delivered', delivery_status: 'delivered', payment_status: 'paid', paid_amount: service.price, balance_due: 0, is_unlocked_for_delivery: true }));
  const shoot = {
    id: 156, status: 'delivered', workflow_status: 'delivered', address: workspaceAddress, hero_image: photo,
    city: 'Point of Rocks', state: 'MD', zip: '21777', scheduled_date: '2026-10-08', time: '10:00',
    scheduled_instant: '2026-10-08T14:00:00Z', timezone: 'America/New_York',
    client: { id: 10, name: 'Tracy Grubb', email: workspaceClientEmail, phone: workspaceClientPhone, company: 'Samson Properties', email_verified: true },
    photographer: { id: 21, name: 'Jay Snap' }, editor: { id: 901, name: 'Editor Local Review' }, services,
    ...(options.largeCompletionCounts ? { serviceItems: services, bracket_mode: 5 } : {}),
    base_quote: 425, total_quote: 425, total_paid: 425, payment_status: 'paid', tax_amount: 0,
    raw_photo_count: 2, edited_photo_count: workspaceEditedPhotoCount, expected_raw_count: 2, expected_final_count: workspaceEditedPhotoCount,
    canSubmitRaw: false, canSubmitEdits: false, canManageBooking: role === 'admin',
    canManageShootActions: role === 'admin', can_view_invoice: ['admin', 'client'].includes(role),
    notes: [{ id: 1, content: 'Use the lockbox by the front door.', type: 'shoot', created_at: completedAt }],
    files: [...rawFiles, ...editedFiles], tour_links: {},
  };
  const requests: Array<{ method: string; path: string }> = [];
  const businessWrites: Array<{ method: string; path: string }> = [];
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.addInitScript(({ user, theme }) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('authToken', 'local-shoot-workspace-fixture-not-a-real-token');
    localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('theme', theme);
    localStorage.setItem('user_preferences', JSON.stringify({ temperatureUnit: 'fahrenheit', timeFormat: '12h' }));
  }, { user, theme });

  await page.route('**/*', route => {
    const hostname = new URL(route.request().url()).hostname;
    return ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ? route.continue() : route.abort();
  });
  await page.routeWebSocket(url => !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), socket => socket.close());
  const reply = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const data = (route: Route, value: unknown) => reply(route, { success: true, data: value });
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, ''); const method = request.method();
    requests.push({ method, path });
    if (method === 'OPTIONS') return reply(route, {});
    if (path === '/system-telemetry/events') return reply(route, { accepted: true });
    if (method !== 'GET') {
      if (/\/(shoots|invoices|notifications|messaging)\b/.test(path)) businessWrites.push({ method, path });
      return reply(route, { message: `Fixture blocks mutation: ${method} ${path}` }, 501);
    }
    if (path === '/user') return reply(route, user);
    if (path === '/me/permissions') {
      const resources = ['dashboard', `dashboard-${role}`, 'shoots', 'shoot-history', 'settings'];
      const permissions = resources.map(resource => ({ resource, action: 'view' }));
      return reply(route, { permissions, permissionIds: permissions.map(permission => `${permission.resource}:${permission.action}`) });
    }
    if (path === '/shoots/156') return data(route, shoot);
    if (path === '/shoots/156/upload-summaries') return data(route, uploadSummaries);
    if (path === '/shoots/156/aryeo') return reply(route, { configured: false, connections: [], orders: [], unmatched: [] });
    if (path === '/shoots/156/files') {
      const type = url.searchParams.get('type');
      return data(route, type === 'raw' ? rawFiles : type === 'edited' ? editedFiles : [...rawFiles, ...editedFiles]);
    }
    if (path === '/shoots') return reply(route, { success: true, data: [shoot], meta: { total: 1, current_page: 1, last_page: 1, per_page: 25 } });
    if (path === '/voice/browser/config') return reply(route, { enabled: false, ready: false, blockers: [] });
    if (path === '/ip-location') return reply(route, { city: 'Austin', region: 'Texas', country: 'United States', latitude: 30.2672, longitude: -97.7431 });
    if (path === '/shoots/156/activity-log') return data(route, [{ id: 'activity-1', timestamp: completedAt, action: 'delivered', type: 'finalize', description: 'Shoot delivered', actor: { id: '901', name: 'Local Review', role: 'admin' } }]);
    if (path === '/shoots/156/realtor-options') return data(route, { boards: [], selected_board_ids: [] });
    if (path === '/shoots/156/invoice') return reply(route, { message: 'No local invoice fixture' }, 404);
    return reply(route, { success: true, data: [], notifications: [], unread_count: 0, shoots: [], meta: { total: 0 } });
  });
  return { requests, businessWrites, pageErrors };
}
