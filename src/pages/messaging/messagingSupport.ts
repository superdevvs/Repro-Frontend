export const MESSAGING_SUPPORT_URL = '/messaging/email/inbox?tab=support';

export const isSupportInbox = (search: string) => new URLSearchParams(search).get('tab') === 'support';

export function supportInboxRedirect(search = '', hash = '') {
  const params = new URLSearchParams(search);
  params.set('tab', 'support');
  return `/messaging/email/inbox?${params.toString()}${hash}`;
}
