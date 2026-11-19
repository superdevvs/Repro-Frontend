import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getSmsMessageAttachments, type MessageMediaFile } from '@/services/messageMedia';
import type { SmsMessageDetail } from '@/types/messaging';

const PENDING = new Set(['importing', 'scanning', 'uploading']);

export const smsMessageAttachmentsKey = 'sms-message-attachments';

/**
 * Attachments for the messages of the open conversation, keyed by message id.
 * The API authorizes every message against the signed-in user, so this never
 * returns media from a conversation the user cannot open.
 */
export function useSmsMessageAttachments(threadId: string | null | undefined, messages: SmsMessageDetail[], scope: string) {
  // A conversation can include history from a sibling thread of the same
  // contact. Ask per thread so one inaccessible sibling cannot hide the rest.
  const groups = useMemo(() => {
    const byThread = new Map<string, string[]>();
    for (const message of messages) {
      const ids = byThread.get(message.threadId) ?? [];
      if (!ids.includes(message.id)) ids.push(message.id);
      byThread.set(message.threadId, ids);
    }
    return [...byThread.values()];
  }, [messages]);
  const signature = groups.map(ids => `${ids.length}:${ids[0]}:${ids[ids.length - 1]}`).join('|');

  const query = useQuery({
    queryKey: [smsMessageAttachmentsKey, threadId, scope, signature],
    queryFn: async () => {
      const results = await Promise.all(groups.map(ids => getSmsMessageAttachments(ids).catch(() => ({} as Record<string, MessageMediaFile[]>))));
      return Object.assign({}, ...results) as Record<string, MessageMediaFile[]>;
    },
    enabled: Boolean(threadId) && groups.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    // Received media is downloaded and virus-scanned in the background.
    refetchInterval: current => Object.values(current.state.data ?? {}).some(files => files.some(file => PENDING.has(file.status))) ? 4000 : false,
  });

  // Placeholder data belongs to the previous set of messages, so it still counts as loading.
  return { attachments: query.data, loading: query.fetchStatus !== 'idle' && (query.isPending || query.isPlaceholderData) };
}
