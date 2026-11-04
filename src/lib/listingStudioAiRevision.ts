export interface StudioAiRevisionAttempt { key: string; instructions: string }
const storageKey = (accountId: string, orderId: string) => `studio-ai-revision:${accountId}:${orderId}`;
export function readStudioAiRevision(accountId: string, orderId: string): StudioAiRevisionAttempt | null {
  try { const value = JSON.parse(localStorage.getItem(storageKey(accountId, orderId)) || 'null'); return value && typeof value.key === 'string' && /^[a-f0-9-]{36}$/i.test(value.key) && typeof value.instructions === 'string' ? value : null; } catch { return null; }
}
export function beginStudioAiRevision(accountId: string, orderId: string, instructions: string): StudioAiRevisionAttempt {
  const existing = readStudioAiRevision(accountId, orderId); if (existing) return existing;
  const value = { key: crypto.randomUUID(), instructions: instructions.trim() };
  localStorage.setItem(storageKey(accountId, orderId), JSON.stringify(value)); return value;
}
export function forgetStudioAiRevision(accountId: string, orderId: string) { localStorage.removeItem(storageKey(accountId, orderId)); }
