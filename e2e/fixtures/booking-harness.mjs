import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const output = process.env.E2E_ARTIFACT_DIR || path.join(os.tmpdir(), 'repro-booking-qa');
fs.mkdirSync(output, { recursive: true });
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js'));
const catalog = [
  { id: '501', name: 'HDR Photos', price: 175, quantity: 1, photographer_required: true, shoot_duration_minutes: 30, booking_duration_default_minutes: 30, category: { id: '1', name: 'Photos' }, pricing_type: 'fixed' },
  { id: '502', name: 'Virtual staging', price: 45, quantity: 1, photographer_required: false, category: { id: '2', name: 'Virtual Staging' }, pricing_type: 'fixed' },
  { id: '503', name: 'Walkthrough Video', price: 200, quantity: 1, photographer_required: true, shoot_duration_minutes: 45, category: { id: '3', name: 'Video' }, pricing_type: 'fixed' },
  { id: '504', name: 'Photo editing', price: 25, quantity: 1, photographer_required: false, category: { id: '4', name: 'Editing' }, pricing_type: 'fixed' },
];
const people = [{ id: '201', name: 'Jay Snap', role: 'photographer' }, { id: '202', name: 'KK - Kumnith Keo', role: 'photographer' }];
// Fictional accounts and appointments only. All booking writes are rejected.
const userFor = role => ({ id: role === 'client' ? 101 : 900501, name: 'Local Booking QA', email: 'qa@example.test', role, account_status: 'active', email_verified_at: '2026-10-01T09:00:00Z', metadata: { terms_accepted_at: '2026-10-01T09:00:00Z' } });
const permissions = ['dashboard','shoots','book-shoot','accounts','availability','shoot-pricing'].flatMap(resource => ['view','create','edit','update'].map(action => ({ resource, action })));
const slots = [{ start_time: '08:00', end_time: '19:00', status: 'available' }];
const api = http.createServer(async (req, res) => {
  res.setHeader('Content-Type','application/json');
  if (req.method === 'OPTIONS') { res.end('{}'); return; }
  const url = new URL(req.url, 'http://127.0.0.1:48131');
  const path = url.pathname.replace(/^\/api/, '');
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  let body = {}; try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch {}
  const role = String(req.headers.authorization ?? '').includes('client') ? 'client' : String(req.headers.authorization ?? '').includes('salesRep') ? 'salesRep' : 'admin';
  fs.appendFileSync(output + '/requests.jsonl', JSON.stringify({ path, method: req.method, body }) + '\n');
  let data = { success: true, data: [], unread_count: 0, notifications: [] };
  if (path === '/user') data = userFor(role);
  else if (path === '/me/permissions') data = { permissions, permissionIds: permissions.map(item => `${item.resource}:${item.action}`) };
  else if (['/services','/admin/services'].includes(path)) data = { data: catalog };
  else if (path === '/admin/shoots/66001/complimentary-reshoots' && req.method === 'GET') data = { data: { policy_version: 'qa-policy', source: { id: 66001, address: '123 QA Main Street' }, client: { id: 101, name: 'QA House Account' }, property: { address: '123 QA Main Street', city: 'Rockville', state: 'MD', zip: '20850', property_details: { sqft: 1500, bedrooms: 3, bathrooms: 2, presenceOption: 'lockbox', lockboxCode: 'QA123', lockboxLocation: 'Front door' } }, source_service_items: [{ id: 66011, service_id: 501, name: 'HDR Photos', quantity: 1, price: 175, photographer_id: 201, photographer_name: 'Jay Snap', standard_photographer_pay: 75 }], sales_rep: { id: 203, name: 'QA Rep', standard_compensation: 25 } } };
  else if (path === '/admin/clients') data = { data: [{ id: 101, name: 'QA House Account', role: 'client', email: 'client@example.test', account_status: 'active', service_group_ids: [], metadata: {} }] };
  else if (/\/photographers$/.test(path)) data = { data: people };
  else if (path === '/photographer/availability/bulk-index') data = { data: Object.fromEntries(people.map(person => [person.id, ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].flatMap(day => slots.map(slot => ({ ...slot, date: null, day_of_week: day })))])) };
  else if (path === '/photographer/availability/check') data = { data: slots, timezone: 'America/New_York', from_config: true };
  else if (path === '/photographer/availability/for-booking') data = { hybrid_travel_enabled: true, data: people.map(person => ({ ...person, distance: 2, availability_slots: slots, net_available_slots: slots, booked_slots: [], unavailable_slots: [], is_available_at_time: true, has_availability: true, eligible_service_ids: [501,503], requires_travel_check: true })) };
  else if (path === '/photographer/availability/day-schedule') {
    const date = url.searchParams.get('date'), id = Number(url.searchParams.get('photographer_id'));
    data = { data: { date, timezone: 'America/New_York', photographer: { id, name: people.find(person => Number(person.id) === id)?.name },
      bookings: [{ id: 'existing-1', shoot_id: 99000, photographer_id: id, label: 'Existing booking: 5506 Burkittsville Road, Burkittsville', start: `${date}T14:30:00.000Z`, end: `${date}T16:00:00.000Z`, duration_minutes: 90, can_adjust: role !== 'client', expected_edit_version: 'qa-version' }], schedule_version: 'qa-version' } };
  } else if (path === '/photographer/availability/feasibility') {
    const items = body.service_items ?? body.service_lines ?? [];
    const visits = items.filter(row => row.photographer_id).map(row => {
      const start = new Date(row.scheduled_at), duration = row.duration_minutes ?? 30;
      return { photographer_id: Number(row.photographer_id), start: start.toISOString(), end: new Date(start.getTime() + duration * 60000).toISOString(), scheduled_at: start.toISOString(), duration_minutes: duration, timezone: 'America/New_York', is_target: true };
    });
    const conflict = visits.some(visit => new Date(visit.start).getUTCHours() === 14 && new Date(visit.start).getUTCMinutes() === 30);
    data = { data: { enabled: true, status: conflict ? 'conflict' : 'available', available: !conflict, reason_codes: conflict ? ['capture_overlap'] : [], visits,
      transitions: [], alternatives: [], can_override: false, policy_version: 'qa-policy', schedule_version: 'qa-version', confirmation_version: 'qa-' + JSON.stringify(items) } };
  } else if (path === '/voice/browser/config') data = { enabled: false, ready: false, blockers: [] };
  else if (path === '/notifications') data = { data: { activity_log: [], unread_count: 0 } };
  else if (path.includes('geocode') || path.includes('nominatim')) data = [];
  else if (path === '/shoots' && req.method === 'POST') { res.statusCode = 503; data = { message: 'Local QA: booking creation is disabled.' }; }
  else if (req.method !== 'GET' && !/availability|telemetry|broadcasting|weather/.test(path)) { res.statusCode = 400; data = { message: 'Local QA blocked this mutation.' }; }
  res.end(JSON.stringify(data));
});
await new Promise(resolve => api.listen(48131, '127.0.0.1', resolve));
process.env.VITE_API_URL = '';
const vite = await createServer({ root, configFile: root + '/vite.config.ts', cacheDir: output + '/vite-cache',
  server: { host: '127.0.0.1', port: 48130, strictPort: true, fs: { allow: [root, fs.realpathSync(root + '/node_modules')] }, proxy: { '/api': { target: 'http://127.0.0.1:48131', changeOrigin: true }, '/nominatim': { target: 'http://127.0.0.1:48131', changeOrigin: true }, '/storage': { target: 'http://127.0.0.1:48131', changeOrigin: true } } },
  plugins: [{ name: 'local-booking-qa', configureServer(server) { server.middlewares.use('/__qa', (req,res) => {
    const params = new URL(req.url, 'http://127.0.0.1').searchParams, kind = params.get('kind') || 'mixed', role = params.get('role') || 'admin';
    const ids = kind === 'non-photo' ? ['502','504'] : kind === 'photo' || kind === 'fresh' || kind === 'conflict' ? ['501'] : ['501','502','503'];
    const selectedServices = catalog.filter(service => ids.includes(service.id));
    const schedules = kind === 'fresh' ? {} : { '501': { date: '2026-10-20', time: kind === 'conflict' || kind === 'mixed-conflict' ? '10:30' : '09:00' }, '502': { date: '2026-10-20', time: '14:00' }, '503': { date: '2026-10-20', time: '11:00' }, '504': { date: '2026-10-20', time: '15:00' } };
    const cache = { client: '101', address: '123 QA Main Street', city: 'Rockville', state: 'MD', zip: '20850', date: '2026-10-20T12:00:00-04:00', time: kind === 'fresh' ? '' : '12:15 PM', photographer: kind === 'fresh' ? '' : '202', selectedServices,
      bookingQuantityVersion: 1, servicePhotographers: kind === 'fresh' ? {} : { '501': '201', '503': '202' }, serviceSchedules: schedules,
      propertySqft: 1500, propertyDetails: { sqft: 1500, bedrooms: 3, bathrooms: 2, listingType: 'for_sale', presenceOption: 'lockbox', lockboxCode: 'QA123', lockboxLocation: 'Front door' }, notes: 'Local QA only', bypassPayment: true, sendNotification: false, step: 1 };
    if (kind === 'multi') cache.multiUnitDraft = { enabled: true, activeUnitKey: 'unit-1', defaults: {}, units: ['1','2'].map(id => ({ client_key: `unit-${id}`, label: `Unit ${id}`, kind: 'unit', sqft: 1500, beds: 3, baths: 2, access_notes: 'QA lockbox' })), lines: ['1','2'].map(id => ({ client_key: `line-${id}`, unit_client_key: `unit-${id}`, service_id: '501', quantity: 1, date: '2026-10-20', time: id === '1' ? '09:00' : '13:00', photographer_id: id === '1' ? '201' : '202' })) };
    res.setHeader('Content-Type','text/html'); res.end(`<!doctype html><html><body><p>Loading local booking QA</p><script>localStorage.clear();sessionStorage.clear();localStorage.setItem('authToken',${JSON.stringify('local-fixture-'+role)});localStorage.setItem('user',${JSON.stringify(JSON.stringify(userFor(role)))});localStorage.setItem('theme',${JSON.stringify(params.get('theme') || 'dark')});localStorage.setItem(${JSON.stringify(role === 'client' ? 'bookShoot_form_cache:client:101' : 'bookShoot_form_cache')},${JSON.stringify(JSON.stringify(cache))});${kind === 'reshoot' ? `localStorage.setItem('bookShoot_form_cache:reshoot:66001',${JSON.stringify(JSON.stringify({ ...cache, selectedServices: [], serviceSchedules: {} }))});` : ''}location.replace(${JSON.stringify(kind === 'reshoot' ? '/book-shoot?compReshootFrom=66001' : '/book-shoot')});</script></body></html>`);
  }); } }],
});
await vite.listen();
console.log('Local booking QA ready at http://127.0.0.1:48130/__qa?kind=mixed. Booking writes are blocked.');
process.on('SIGINT',async () => { await vite.close(); api.close(); process.exit(0); });
