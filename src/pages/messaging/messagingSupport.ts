export const MESSAGING_SUPPORT_URL = '/messaging/email/inbox?tab=support';

export type SupportComposePrefill = { ownerId: string; subject: string; body: string; attachmentNames: string[] };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';

/** Recover this account's existing compose draft without consuming or deleting it. */
export function getSupportComposePrefill(search: string, state: unknown, userId?: string | number): SupportComposePrefill {
  const params = new URLSearchParams(search);
  const source = record(state);
  const message = record(source.message);
  const mode = source.mode === 'reply' || source.mode === 'forward' ? source.mode : 'compose';
  let saved: Record<string, unknown> = {};
  if (userId) {
    try {
      const draft = record(JSON.parse(localStorage.getItem(`email-compose-draft:${userId}:${mode}:${message.id ?? 'new'}`) || '{}'));
      if (draft.version === 1) saved = draft;
    } catch { /* Storage may be unavailable. The explicit prefill is still usable. */ }
  }
  const form = record(saved.form);
  return {
    ownerId: String(userId ?? ''),
    subject: text(form.subject) || params.get('subject') || text(source.subject) || text(message.subject),
    body: text(form.body_text) || params.get('body') || params.get('body_text') || text(source.prefillBody) || text(source.body_text) || (mode === 'forward' ? text(message.body_text) : ''),
    attachmentNames: Array.isArray(saved.attachments) ? saved.attachments.map(item => text(record(item).name)).filter(Boolean) : [],
  };
}

export function readSupportComposePrefill(state: unknown, userId?: string | number): SupportComposePrefill | undefined {
  const value = record(record(state).supportPrefill);
  return value.ownerId === String(userId) && typeof value.subject === 'string' && typeof value.body === 'string'
    ? { ownerId: String(userId), subject: value.subject, body: value.body, attachmentNames: Array.isArray(value.attachmentNames) ? value.attachmentNames.filter((name): name is string => typeof name === 'string') : [] }
    : undefined;
}

export function readSupportReplyPrefill(state: unknown, userId: string | number | undefined, ticketId: number): SupportComposePrefill | undefined {
  const value = record(record(state).supportReplyPrefill);
  return value.ticketId === ticketId ? readSupportComposePrefill({ supportPrefill: value }, userId) : undefined;
}

export const isSupportInbox = (search: string) => new URLSearchParams(search).get('tab') === 'support';

export function supportInboxRedirect(search = '', hash = '') {
  const params = new URLSearchParams(search);
  params.set('tab', 'support');
  return `/messaging/email/inbox?${params.toString()}${hash}`;
}
