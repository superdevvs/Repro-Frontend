import type { MessageDirection, SmsMessageDetail, SmsReaction } from '@/types/messaging';

const reactionKinds = [
  ['Liked', 'Removed a like from', '👍', 'Like'],
  ['Loved', 'Removed a heart from', '❤️', 'Love'],
  ['Laughed at', 'Removed a laugh from', '😂', 'Laugh'],
  ['Disliked', 'Removed a dislike from', '👎', 'Dislike'],
  ['Emphasized', 'Removed an exclamation from', '‼️', 'Emphasis'],
  ['Questioned', 'Removed a question mark from', '❓', 'Question'],
] as const;

/** Fallback for older API responses; original SMS text stays intact. */
export function parseSmsReaction(body: string | undefined, direction: MessageDirection | undefined): SmsReaction | null {
  if (direction !== 'INBOUND' || !body) return null;
  const match = /^(.+?) (?:"([\s\S]+)"|“([\s\S]+)”|„([\s\S]+)”|«([\s\S]+)»)$/u.exec(body.trim());
  if (!match) return null;
  const quotedMessage = match.slice(2).find((quote) => quote !== undefined);
  if (!quotedMessage?.trim()) return null;
  const prefix = match[1] === 'A aprobat' ? 'Liked' : match[1];
  const kind = reactionKinds.find(([add, remove]) => prefix === add || prefix === remove);
  if (!kind) return null;
  return { emoji: kind[2], label: kind[3], action: prefix === kind[1] ? 'remove' : 'add', targetMessageId: null, quotedMessage };
}

export interface SmsReactionBadge {
  emoji: string;
  label: string;
  sender: string;
  reactedAt?: string;
}

export interface SmsConversationItem {
  message: SmsMessageDetail;
  reactions: SmsReactionBadge[];
}

function phoneKey(value?: string) {
  const digits = value?.replace(/\D/g, '') ?? '';
  return digits.length === 10 ? `1${digits}` : digits;
}

function sameParticipants(target: SmsMessageDetail, reaction: SmsMessageDetail) {
  const addresses = [target.from, target.to, reaction.from, reaction.to].map(phoneKey);
  return addresses.every(Boolean)
    ? addresses[0] === addresses[3] && addresses[1] === addresses[2]
    : target.threadId === reaction.threadId;
}

/** Fold reaction events into their original message, with one active reaction per sender. */
export function buildSmsConversation(messages: SmsMessageDetail[]): SmsConversationItem[] {
  const hidden = new Set<string>();
  const active = new Map<string, Map<string, SmsReactionBadge>>();
  const byId = new Map(messages.map((message) => [message.id, message]));
  const previousOutbound = new Map<string, SmsMessageDetail[]>();

  messages.forEach((message) => {
    const bodyKey = `${message.threadId}\u0000${message.body ?? ''}`;
    if (message.direction === 'OUTBOUND') {
      const previous = previousOutbound.get(bodyKey) ?? [];
      previous.push(message);
      previousOutbound.set(bodyKey, previous);
      return;
    }
    const reaction = message.direction === 'INBOUND' ? message.reaction ?? parseSmsReaction(message.body, message.direction) : null;
    if (!reaction) return;
    const target = reaction.targetMessageId
      ? byId.get(reaction.targetMessageId)
      : [...(previousOutbound.get(`${message.threadId}\u0000${reaction.quotedMessage}`) ?? [])].reverse()
        .find((candidate) => sameParticipants(candidate, message));
    if (!target || target.direction !== 'OUTBOUND' || target.body !== reaction.quotedMessage || !sameParticipants(target, message)) return;
    const targetTime = Date.parse(target.sentAt ?? '');
    const reactionTime = Date.parse(message.sentAt ?? '');
    if (Number.isFinite(targetTime) && Number.isFinite(reactionTime) && targetTime > reactionTime) return;

    hidden.add(message.id);
    const sender = phoneKey(message.from) || `${message.threadId}:contact`;
    const targetReactions = active.get(target.id) ?? new Map<string, SmsReactionBadge>();
    if (reaction.action === 'remove') {
      if (targetReactions.get(sender)?.emoji === reaction.emoji) targetReactions.delete(sender);
    } else {
      targetReactions.set(sender, { emoji: reaction.emoji, label: reaction.label, sender: message.from || 'Contact', reactedAt: message.sentAt });
    }
    active.set(target.id, targetReactions);
  });

  return messages.filter((message) => !hidden.has(message.id))
    .map((message) => ({ message, reactions: [...(active.get(message.id)?.values() ?? [])] }));
}
