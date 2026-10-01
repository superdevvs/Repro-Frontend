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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  api.post.mockReset().mockResolvedValue({ data: identity });
  api.delete.mockReset().mockResolvedValue(undefined);
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

it('explains native push registration failure without saving a device or reporting enablement', async () => {
  const cause = new DOMException('Registration failed - push service error', 'AbortError');
  vi.mocked(registration.pushManager.subscribe).mockRejectedValue(cause);
  await expect(enableVoicePush('9', btoa(String.fromCharCode(...new Uint8Array(65))), 'Desktop'))
    .rejects.toMatchObject({ message: expect.stringContaining('This device is not enabled'), cause });
  expect(api.post).not.toHaveBeenCalled();
  expect(messages.some(message => message.type === 'VOICE_PUSH_SAVE')).toBe(false);
});

it('preserves other native enrollment errors', async () => {
  const cause = new DOMException('Application server key is invalid', 'InvalidAccessError');
  vi.mocked(registration.pushManager.subscribe).mockRejectedValue(cause);
  await expect(enableVoicePush('9', btoa(String.fromCharCode(...new Uint8Array(65))), 'Desktop')).rejects.toBe(cause);
  expect(api.post).not.toHaveBeenCalled();
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

it.each([[null, false], ['another-user', true]] as const)('cancels pending enrollment when the identity changes to %s', async (userId, enabled) => {
  let finish!: (value: { data: typeof identity }) => void;
  api.post.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const enrollment = enableVoicePush('9', btoa(String.fromCharCode(...new Uint8Array(65))), 'Desktop');
  const cancelled = expect(enrollment).rejects.toThrow('sign-in or call permissions changed');
  await vi.waitFor(() => expect(api.post).toHaveBeenCalledOnce());
  await syncVoicePushIdentity(userId, enabled);
  finish({ data: identity });
  await cancelled;
  expect(messages.some(message => message.type === 'VOICE_PUSH_SAVE' || message.type === 'VOICE_PUSH_CLEAR')).toBe(false);
  expect(messages.at(-1)).toEqual({ type: 'VOICE_PUSH_IDENTITY', user_id: userId, enabled });
  expect(fetch).toHaveBeenCalledWith('/api/voice/push/revoke', expect.objectContaining({
    method: 'POST', credentials: 'omit', body: JSON.stringify({ id: identity.id, token: identity.revoke_token }),
  }));
  expect(api.delete).not.toHaveBeenCalled();
});

it('does not install or subscribe after logout while the permission prompt is pending', async () => {
  let finish!: (value: NotificationPermission) => void;
  vi.mocked(Notification.requestPermission).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const enrollment = enableVoicePush('9', btoa(String.fromCharCode(...new Uint8Array(65))), 'Desktop');
  const cancelled = expect(enrollment).rejects.toThrow('sign-in or call permissions changed');
  await syncVoicePushIdentity(null, false);
  finish('granted');
  await cancelled;
  expect(register).not.toHaveBeenCalled();
  expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  expect(messages.at(-1)).toEqual({ type: 'VOICE_PUSH_IDENTITY', user_id: null, enabled: false });
});
