import type { MessageDirection } from '@/types/messaging';

/** Recognize known SMS reaction envelopes without changing the stored message. */
export function parseSmsReaction(body: string | undefined, direction: MessageDirection | undefined) {
  if (direction !== 'INBOUND' || !body) return null;

  // iPhone SMS reactions use the sender's language. A Romanian thumbs-up is
  // "A aprobat", which must not be confused with approval of a booking.
  const match = /^(?:A aprobat „([\s\S]+)”|Liked “([\s\S]+)”|Liked "([\s\S]+)")$/u.exec(body);
  const quotedMessage = match?.slice(1).find((quote) => quote !== undefined);
  return quotedMessage?.trim() ? { quotedMessage } : null;
}
