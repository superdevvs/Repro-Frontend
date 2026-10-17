import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  headers: {} as Record<string, string>, trace: 0,
  clients: [] as Array<{ options: { auth: { headers: Record<string, string> } }; disconnect: ReturnType<typeof vi.fn> }>,
}));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ ...state.headers, 'X-Trace-Id': String(++state.trace) }) }));
vi.mock('laravel-echo', () => ({ default: class {
  disconnect = vi.fn();
  constructor(public options: { auth: { headers: Record<string, string> } }) { state.clients.push(this); }
} }));
vi.mock('pusher-js', () => ({ default: class {} }));
import { disconnectEchoClient, getEchoClient } from './echoClient';

beforeEach(() => {
  disconnectEchoClient();
  state.headers = { Authorization: 'Bearer test-actor-a' };
  state.clients = [];
  vi.stubEnv('VITE_REALTIME_ENABLED', 'true');
  vi.stubEnv('VITE_PUSHER_APP_KEY', 'test-key');
});
afterEach(() => { disconnectEchoClient(); vi.unstubAllEnvs(); });

it('reuses one connection while only trace headers change', async () => {
  const first = await getEchoClient();
  expect(await getEchoClient()).toBe(first);
  expect(state.clients).toHaveLength(1);
  expect(state.clients[0].disconnect).not.toHaveBeenCalled();
});

it('disconnects the previous actor and authenticates new subscriptions as the impersonated user', async () => {
  const first = await getEchoClient();
  state.headers['X-Impersonate-User-Id'] = '42';
  const second = await getEchoClient();
  expect(second).not.toBe(first);
  expect(state.clients[0].disconnect).toHaveBeenCalledOnce();
  expect(state.clients[1].options.auth.headers['X-Impersonate-User-Id']).toBe('42');
  delete state.headers['X-Impersonate-User-Id'];
  await getEchoClient();
  expect(state.clients[1].disconnect).toHaveBeenCalledOnce();
  expect(state.clients[2].options.auth.headers['X-Impersonate-User-Id']).toBeUndefined();
});

it('replaces a connection when the login token changes', async () => {
  await getEchoClient();
  state.headers.Authorization = 'Bearer test-actor-b';
  await getEchoClient();
  expect(state.clients[0].disconnect).toHaveBeenCalledOnce();
  expect(state.clients[1].options.auth.headers.Authorization).toBe('Bearer test-actor-b');
});

it('discards a lazy initialization belonging to the previous actor', async () => {
  const oldInitialization = getEchoClient();
  state.headers['X-Impersonate-User-Id'] = '42';
  const newInitialization = getEchoClient();
  expect(await oldInitialization).toBeNull();
  const initialized = await newInitialization;
  expect(state.clients).toHaveLength(1);
  expect(initialized).toBe(state.clients[0]);
  expect(state.clients[0].options.auth.headers['X-Impersonate-User-Id']).toBe('42');
});
