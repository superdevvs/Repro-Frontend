import { apiClient } from './api';

export interface VoicePushSettings {
  configured: boolean;
  blockers: string[];
  public_key: string | null;
  preferences: { incoming_calls: boolean };
  devices: { id: string; label: string; last_success_at: string | null; last_error: string | null; created_at: string }[];
}
export interface VoicePushIdentity { id: string; scope: string; revoke_token: string; user_id: string }
export const getVoicePushSettings = async (): Promise<VoicePushSettings> => (await apiClient.get('/voice/push/settings')).data;
export const updateVoicePushPreferences = async (incoming_calls: boolean): Promise<VoicePushSettings> => (await apiClient.patch('/voice/push/settings', { incoming_calls })).data;
export const deleteVoicePushDevice = async (id: string): Promise<void> => { await apiClient.delete(`/voice/push/subscriptions/${id}`); };
export const testVoicePushDevice = async (id: string): Promise<{ delivery_id: string; status: string }> => (await apiClient.post(`/voice/push/subscriptions/${id}/test`)).data;
export const getVoicePushDelivery = async (id: string): Promise<{ status: string; error_code: string | null }> => (await apiClient.get(`/voice/push/deliveries/${id}`)).data;

export function pushSupport(): { supported: boolean; reason?: string } {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  if (ios && !standalone) return { supported: false, reason: 'On iPhone or iPad, add REPro to your Home Screen, open it there, then enable alerts. Requires iOS or iPadOS 16.4 or later.' };
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return { supported: false, reason: 'This browser cannot receive background call alerts. Use a supported browser over HTTPS or the verified phone option below.' };
  return { supported: true };
}

export async function workerMessage<T = unknown>(registration: ServiceWorkerRegistration, message: object): Promise<T> {
  const worker = registration.active || registration.waiting || registration.installing;
  if (!worker) throw new Error('The notification service is not ready. Try again.');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => { channel.port1.close(); reject(new Error('The notification service did not respond. Try again.')); }, 12000);
    channel.port1.onmessage = ({ data }) => { window.clearTimeout(timeout); channel.port1.close(); if (data?.ok) resolve(data as T); else reject(new Error('Could not update this device’s call alerts.')); };
    worker.postMessage(message, [channel.port2]);
  });
}

export async function syncVoicePushIdentity(userId: string | null, enabled: boolean): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (registration?.active?.scriptURL.endsWith('/voice-push-worker.js')) await workerMessage(registration, { type: 'VOICE_PUSH_IDENTITY', user_id: userId, enabled });
}

export async function localVoicePushIdentity(): Promise<VoicePushIdentity | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration?.active?.scriptURL.endsWith('/voice-push-worker.js')) return null;
  const response = await workerMessage<{ subscription?: VoicePushIdentity }>(registration, { type: 'VOICE_PUSH_STATUS' });
  return response.subscription || null;
}

export async function enableVoicePush(userId: string, publicKey: string, label: string): Promise<VoicePushIdentity> {
  const support = pushSupport();
  if (!support.supported) throw new Error(support.reason);
  // The permission request starts directly within the button gesture.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow notifications in this browser’s site settings, then try again.');
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing && ![existing.active, existing.waiting, existing.installing].some((worker) => worker?.scriptURL.endsWith('/voice-push-worker.js'))) throw new Error('Another app service is registered. Ask an administrator to review notification setup.');
  await navigator.serviceWorker.register('/voice-push-worker.js', { scope: '/', updateViaCache: 'none' });
  const registration = await navigator.serviceWorker.ready;
  await workerMessage(registration, { type: 'VOICE_PUSH_IDENTITY', user_id: userId, enabled: true });
  const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  const previousKey = subscription?.options.applicationServerKey;
  if (subscription && (!previousKey || new Uint8Array(previousKey).some((value, index) => value !== bytes[index]) || previousKey.byteLength !== bytes.byteLength)) {
    await subscription.unsubscribe(); subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  let identity: VoicePushIdentity | undefined;
  try {
    identity = { ...(await apiClient.post('/voice/push/subscriptions', { ...subscription.toJSON(), label })).data, user_id: userId };
    await workerMessage(registration, { type: 'VOICE_PUSH_SAVE', subscription: identity });
  } catch (cause) {
    if (identity) await deleteVoicePushDevice(identity.id).catch(() => undefined);
    await workerMessage(registration, { type: 'VOICE_PUSH_CLEAR' }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => undefined);
    throw cause;
  }
  return identity;
}

export async function clearLocalVoicePush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (registration?.active?.scriptURL.endsWith('/voice-push-worker.js')) await workerMessage(registration, { type: 'VOICE_PUSH_CLEAR' });
}

export async function closeVoicePushOffer(offerId: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (registration?.active?.scriptURL.endsWith('/voice-push-worker.js')) await workerMessage(registration, { type: 'VOICE_PUSH_CLOSE', offer_id: offerId });
}
