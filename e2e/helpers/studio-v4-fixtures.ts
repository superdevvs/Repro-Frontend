import type { Page, Route } from '@playwright/test';
import { resolve } from 'node:path';
import type { V4Config, V4Media, V4Workspace } from '../../src/components/studio/v4/types';

/** Isolated browser fixtures. No request reaches a real API or authenticates a real user. */
const user = {
  id: '900042', name: 'Studio Test Admin', email: 'studio-admin@example.test', role: 'admin',
  account_status: 'active', metadata: { terms_accepted_at: '2026-01-01T00:00:00Z' },
};
export const fixtureShoot = {
  id: 42, propertyIdentifier: 'studio-fixture-42', address: '8704 Margaret Lane',
  location: 'Georgetown', label: 'Georgetown', thumbnailUrl: '/studio-assets/hero-after.webp',
  updatedAt: '2026-09-06T10:00:00Z',
};
export const fixtureMedia: V4Media[] = Array.from({ length: 12 }, (_, i) => ({
  id: `file:${101 + i}`, fileId: 101 + i, shootId: 42, name: `Image ${String(i + 1).padStart(2, '0')}.jpg`,
  kind: 'image', url: `/api/shoots/42/files/${101 + i}/preview`, thumbnailUrl: `/api/shoots/42/files/${101 + i}/preview`,
}));

export function workspaceFixture(overrides: Partial<V4Workspace> = {}): V4Workspace {
  return {
    id: 'ws-fixture-1', version: 1, name: 'Georgetown listing photos', presetId: 'listing-ready',
    media: fixtureMedia.slice(0, 3),
    config: {
      prompt: '', ratio: '16:9', duration: 15, transition: 'none', transitionDuration: 0.5,
      text: { title: '', subtitle: '', style: 'none', position: 'bottom' },
      adjustments: { preserveStructure: true, strength: 50 },
      frames: fixtureMedia.slice(0, 3).map(m => ({ mediaId: m.id, method: 'extend', duration: 5 })),
    },
    status: 'draft', progress: null, error: null, outputs: [], preparedFrames: [],
    createdAt: '2026-09-06T10:00:00Z', updatedAt: '2026-09-06T10:00:00Z',
    ...overrides,
  };
}

export interface StudioRequest { method: string; path: string; body: Record<string, unknown> | null }
export interface StudioFixtures {
  requests: StudioRequest[];
  unexpectedStudioRequests: StudioRequest[];
  workspaces: Map<string, V4Workspace>;
  failures: { create: number; update: number; generate: number; poll: number; revise: number; download: number };
  denyShoot: boolean;
}

export async function installStudioFixtures(page: Page, baseURL: string | undefined, initial: V4Workspace[] = []): Promise<StudioFixtures> {
  if (!baseURL || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)) {
    throw new Error('Mocked Studio tests require a loopback E2E_BASE_URL; they must never target a deployed app.');
  }
  const state: StudioFixtures = {
    requests: [], unexpectedStudioRequests: [], workspaces: new Map(initial.map(w => [w.id, structuredClone(w)])),
    failures: { create: 0, update: 0, generate: 0, poll: 0, revise: 0, download: 0 }, denyShoot: false,
  };
  await page.addInitScript((testUser) => {
    localStorage.clear();
    localStorage.setItem('theme', 'light');
    localStorage.setItem('authToken', 'local-playwright-fixture-not-a-real-token');
    localStorage.setItem('user', JSON.stringify(testUser));
  }, user);
  const reply = (route: Route, data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const data = (route: Route, value: unknown) => reply(route, { success: true, data: value });
  const fail = (route: Route, operation: keyof StudioFixtures['failures']) => {
    if (state.failures[operation] <= 0) return null;
    state.failures[operation] -= 1;
    return reply(route, { message: `Fixture ${operation} unavailable. Please try again.` }, 503);
  };
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const method = request.method();
    if (method === 'OPTIONS') return reply(route, {});
    const body = request.postData() ? request.postDataJSON() as Record<string, unknown> : null;
    const entry = { method, path, body };
    state.requests.push(entry);

    if (/^\/shoots\/42\/files\/\d+\/preview$/.test(path)) {
      if (request.headers().authorization !== 'Bearer local-playwright-fixture-not-a-real-token') {
        return reply(route, { message: 'Unauthenticated preview request.' }, 401);
      }
      return route.fulfill({ status: 200, contentType: 'image/webp', path: resolve(process.cwd(), 'public/studio-assets/hero-after.webp') });
    }

    if (path === '/user') return reply(route, user);
    if (path === '/me/permissions') return reply(route, {
      permissionIds: ['ai-editing:view', 'ai-editing:create', 'ai-editing:update', 'shoots:view', 'dashboard:view', 'book-shoot:create', 'availability:view'],
      permissions: ['view', 'create', 'update'].map(action => ({ resource: 'ai-editing', action }))
        .concat([{ resource: 'shoots', action: 'view' }, { resource: 'dashboard', action: 'view' }, { resource: 'book-shoot', action: 'create' }, { resource: 'availability', action: 'view' }]),
    });
    if (path === '/studio/workspaces/sources/resolve') {
      if (state.denyShoot) return reply(route, {
        error: { code: 'studio_record_forbidden', message: 'You are not authorized to access the requested Studio record.' },
      }, 403);
      return data(route, { destination: body?.destination, record: { ...fixtureShoot, recordType: 'shoot', status: 'delivered' } });
    }
    if (path === '/studio/workspaces/sources/shoots') return data(route, [fixtureShoot]);
    if (path === '/studio/workspaces/sources/shoots/42/media') return data(route, fixtureMedia.map(m => ({
      id: m.fileId, shootId: m.shootId, filename: m.name, mimeType: 'image/jpeg', mediaType: 'image',
      fileSize: 120000, workflowStage: 'edited', workflow: 'photo-enhancement', previewUrl: m.url, thumbnailUrl: m.thumbnailUrl,
    })));
    if (path === '/studio/workspaces' && method === 'GET') return data(route, [...state.workspaces.values()]);
    if (path === '/studio/workspaces' && method === 'POST') {
      const failure = fail(route, 'create'); if (failure) return failure;
      const w = workspaceFixture({
        id: `ws-created-${state.workspaces.size + 1}`, name: body?.name as string,
        presetId: body?.presetId as string, media: body?.media as V4Media[], config: body?.config as V4Config,
      });
      state.workspaces.set(w.id, w);
      return data(route, w);
    }
    const attachment = path.match(/^\/studio\/workspaces\/([^/]+)\/outputs\/([^/]+)\/download$/);
    if (attachment && method === 'GET') {
      if (request.headers().authorization !== 'Bearer local-playwright-fixture-not-a-real-token') {
        return reply(route, { message: 'Unauthenticated output download.' }, 401);
      }
      const workspace = state.workspaces.get(decodeURIComponent(attachment[1]));
      const output = workspace?.outputs.find(item => item.id === decodeURIComponent(attachment[2]));
      if (!output || output.kind !== 'image' || !['completed', 'ready'].includes(output.status)) {
        return reply(route, { message: 'Output not available for download.' }, 404);
      }
      const failure = fail(route, 'download'); if (failure) return failure;
      return route.fulfill({ status: 200, contentType: 'image/webp',
        headers: { 'Content-Disposition': `attachment; filename="fixture-output-v${output.version}.webp"` },
        path: resolve(process.cwd(), 'public/studio-assets/hero-after.webp'),
      });
    }
    const match = path.match(/^\/studio\/workspaces\/([^/]+)(?:\/(prepare|generate|cancel|revisions|segments))?$/);
    if (match) {
      const [, id, operation] = match;
      const w = state.workspaces.get(id);
      if (!w) return reply(route, { message: 'Workspace not found.' }, 404);
      if (method === 'GET') { const failure = fail(route, 'poll'); return failure || data(route, w); }
      if (method === 'PATCH') {
        if (body?.version !== w.version) return reply(route, { message: 'This workspace has changed. Refresh it before saving.' }, 409);
        const failure = fail(route, 'update'); if (failure) return failure;
        const nextVersion = (w.version || 1) + 1;
        Object.assign(w, body, { version: nextVersion }); return data(route, w);
      }
      if (method === 'POST' && operation) {
        if (operation === 'generate') { const failure = fail(route, 'generate'); if (failure) return failure; }
        if (operation === 'revisions') { const failure = fail(route, 'revise'); if (failure) return failure; }
        if (operation === 'segments') return data(route, [{ id: 'ceiling', label: 'Ceiling', region: { x: 0, y: 0, width: 1, height: 0.25 } }]);
        w.status = operation === 'cancel' ? 'cancelled' : operation === 'prepare' ? 'preparing' : 'generating';
        w.progress = operation === 'cancel' ? null : 10;
        w.version = (w.version || 1) + 1;
        return data(route, w);
      }
    }
    if (path.startsWith('/studio/')) {
      state.unexpectedStudioRequests.push(entry);
      return reply(route, { message: `Unmocked Studio request: ${method} ${path}` }, 501);
    }
    // The shared dashboard can ask for notifications/preferences/weather. These
    // receive empty local data; no fallback continues to the backend.
    if (method === 'GET') return reply(route, { data: [], notifications: [], unread_count: 0, success: true });
    return reply(route, { message: 'This operation is outside the isolated Studio fixture.' }, 501);
  });
  return state;
}
