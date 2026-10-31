export interface StudioDeliveryRequest { accountId: string; taskId: string; expectedVersion: number; key: string; sha256: string }
export class StudioDeliveryRecoveryError extends Error {}
const storageKey = (accountId: string, taskId: string) => `repro:studio-delivery:${accountId}:${taskId}`;
export function readStudioDelivery(accountId: string, taskId: string): StudioDeliveryRequest | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(accountId, taskId)) ?? 'null') as StudioDeliveryRequest | null;
    return value && value.accountId === accountId && value.taskId === taskId && Number.isInteger(value.expectedVersion)
      && /^[0-9a-f-]{36}$/i.test(value.key) && /^[0-9a-f]{64}$/i.test(value.sha256) ? value : null;
  } catch { return null; }
}
export async function beginStudioDelivery(accountId: string, taskId: string, version: number, file: File): Promise<StudioDeliveryRequest> {
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
  const previous = readStudioDelivery(accountId, taskId);
  if (previous && previous.sha256 !== sha256) throw new StudioDeliveryRecoveryError('Choose the same photo as the pending delivery, or recover its saved result first.');
  if (previous) return previous;
  const request = { accountId, taskId, expectedVersion: version, key: crypto.randomUUID(), sha256 };
  try { sessionStorage.setItem(storageKey(accountId, taskId), JSON.stringify(request)); }
  catch { throw new StudioDeliveryRecoveryError('This browser cannot save delivery recovery. Enable site storage before delivering a photo.'); }
  return request;
}
export function forgetStudioDelivery(accountId: string, taskId: string) {
  try { sessionStorage.removeItem(storageKey(accountId, taskId)); } catch { /* The server's durable task remains authoritative. */ }
}
