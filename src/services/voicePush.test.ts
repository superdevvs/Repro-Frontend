import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearLocalVoicePush, closeVoicePushOffer, enableVoicePush, localVoicePushIdentity, syncVoicePushIdentity } from './voicePush';

const api = vi.hoisted(() => ({ post: vi.fn(), delete: vi.fn() }));
vi.mock('./api', () => ({ apiClient: api }));
const identity = { id: 'device-1', scope: 'scope-1', revoke_token: 'revoke-1', user_id: '9' };
let registration: ServiceWorkerRegistration;
let getRegistration: ReturnType<typeof vi.fn>;
let register: ReturnType<typeof vi.fn>;
let messages: Record<string, unknown>[];
const worker = (url: string) => ({ scriptURL: url, postMessage: vi.fn((message, ports) => {
  messages.push(message);
  ports[0].respond({ ok: true, ...(message.type === 'VOICE_PUSH_STATUS' ? { subscription: identity } : {}) });
}) } as unknown as ServiceWorker);

beforeEach(() => {
  messages = [];
  registration = { active: worker(`${location.origin}/voice-push-worker.js?v=old`), pushManager: {
    getSubscription: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockResolvedValue({ toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/test', keys: {} }), unsubscribe: vi.fn() }),
  } } as unknown as ServiceWorkerRegistration;
  getRegistration = vi.fn().mockResolvedValue(registration);
  register = vi.fn().mockResolvedValue(registration);
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration, register, ready: Promise.resolve(registration) } });
  vi.stubGlobal('MessageChannel', class {
    port1 = { close: vi.fn(), onmessage: null as ((event: { data: unknown }) => void) | null };
    port2 = { respond: (data: unknown) => queueMicrotask(() => this.port1.onmessage?.({ data })) };
  });
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') });
  api.post.mockReset().mockResolvedValue({ data: identity });
});
afterEach(() => { vi.unstubAllGlobals(); Reflect.deleteProperty(navigator, 'serviceWorker'); });

it('registers the versioned worker at root scope only after the explicit permission gesture', async () => {
  await enableVoicePush('9', btoa(String.fromCharCode(...new Uint8Array(65))), 'Desktop');
  expect(Notification.requestPermission).toHaveBeenCalledOnce();
  expect(register).toHaveBeenCalledWith('/voice-push-worker.js?v=development', { scope: '/', updateViaCache: 'none' });
  expect(vi.mocked(Notification.requestPermission).mock.invocationCallOrder[0]).toBeLessThan(register.mock.invocationCallOrder[0]);
  expect(messages).toContainEqual({ type: 'VOICE_PUSH_SAVE', subscription: identity });
});

it('preserves status, closing, and logout revocation for a worker with a version query', async () => {
  expect(await localVoicePushIdentity()).toEqual(identity);
  await closeVoicePushOffer('offer-1');
  await syncVoicePushIdentity(null, false);
  await clearLocalVoicePush();
  expect(messages).toContainEqual({ type: 'VOICE_PUSH_CLOSE', offer_id: 'offer-1' });
  expect(messages).toContainEqual({ type: 'VOICE_PUSH_IDENTITY', user_id: null, enabled: false });
  expect(messages).toContainEqual({ type: 'VOICE_PUSH_CLEAR' });
  expect(register).not.toHaveBeenCalled();
});

it.each(['https://foreign.example/voice-push-worker.js?v=old', `${location.origin}/another-app-worker.js`])('never reads or replaces the foreign worker %s', async (scriptURL) => {
  Object.assign(registration, { active: worker(scriptURL) });
  await syncVoicePushIdentity('9', true);
  expect(await localVoicePushIdentity()).toBeNull();
  await clearLocalVoicePush(); await closeVoicePushOffer('offer-1');
  await expect(enableVoicePush('9', 'test', 'Desktop')).rejects.toThrow('Another app service');
  expect(register).not.toHaveBeenCalled(); expect(messages).toEqual([]);
});

it('refreshes only an already-installed older own worker on authenticated startup', async () => {
  await syncVoicePushIdentity('9', true);
  expect(register).toHaveBeenCalledWith('/voice-push-worker.js?v=development', { scope: '/', updateViaCache: 'none' });
  Object.assign(registration, { active: worker(`${location.origin}/voice-push-worker.js?v=development`) });
  register.mockClear(); await syncVoicePushIdentity('9', true); expect(register).not.toHaveBeenCalled();
  getRegistration.mockResolvedValue(undefined);
  await syncVoicePushIdentity('9', true); expect(register).not.toHaveBeenCalled();
});

it('does not restore an old account after logout while its worker upgrade is pending', async () => {
  let finish!: (value: ServiceWorkerRegistration) => void;
  register.mockImplementation(() => new Promise<ServiceWorkerRegistration>((resolve) => { finish = resolve; }));
  const login = syncVoicePushIdentity('9', true);
  await vi.waitFor(() => expect(register).toHaveBeenCalledOnce());
  await syncVoicePushIdentity(null, false);
  finish(registration); await login;
  expect(messages.at(-1)).toEqual({ type: 'VOICE_PUSH_IDENTITY', user_id: null, enabled: false });
});
