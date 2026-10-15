import { describe, expect, it } from 'vitest';
import type { SmsMessageDetail } from '@/types/messaging';
import { buildSmsConversation, parseSmsReaction } from './smsReaction';

const message = (id: string, body: string, overrides: Partial<SmsMessageDetail> = {}): SmsMessageDetail => ({
  id,
  threadId: 'thread-1',
  direction: 'OUTBOUND',
  body,
  sentAt: '2026-10-15T14:00:00Z',
  ...overrides,
});

const reaction = (id: string, body: string, overrides: Partial<SmsMessageDetail> = {}) =>
  message(id, body, {
    direction: 'INBOUND',
    from: '+17035550100',
    sentAt: '2026-10-15T14:01:00Z',
    ...overrides,
  });

describe('parseSmsReaction', () => {
  it.each([
    ['A aprobat „Shoot reminder”', '👍', 'Like'],
    ['Liked "Shoot reminder"', '👍', 'Like'],
    ['Loved “Shoot reminder”', '❤️', 'Love'],
    ['Laughed at «Shoot reminder»', '😂', 'Laugh'],
    ['Disliked “Shoot reminder”', '👎', 'Dislike'],
    ['Emphasized “Shoot reminder”', '‼️', 'Emphasis'],
    ['Questioned “Shoot reminder”', '❓', 'Question'],
  ])('recognizes the complete incoming envelope %s', (body, emoji, label) => {
    expect(parseSmsReaction(body, 'INBOUND')).toEqual({
      emoji,
      label,
      action: 'add',
      targetMessageId: null,
      quotedMessage: 'Shoot reminder',
    });
  });

  it.each([
    ['Removed a like from “Shoot reminder”', '👍', 'Like'],
    ['Removed a heart from “Shoot reminder”', '❤️', 'Love'],
    ['Removed a laugh from “Shoot reminder”', '😂', 'Laugh'],
    ['Removed a dislike from “Shoot reminder”', '👎', 'Dislike'],
    ['Removed an exclamation from “Shoot reminder”', '‼️', 'Emphasis'],
    ['Removed a question mark from “Shoot reminder”', '❓', 'Question'],
  ])('recognizes the removal envelope %s', (body, emoji, label) => {
    expect(parseSmsReaction(body, 'INBOUND')).toEqual({
      emoji,
      label,
      action: 'remove',
      targetMessageId: null,
      quotedMessage: 'Shoot reminder',
    });
  });

  it('accepts outer whitespace while preserving a multiline quote exactly', () => {
    expect(parseSmsReaction('  A aprobat „Shoot reminder\nDetails: https://reprodashboard.com/shoots/2474” \n', 'INBOUND')?.quotedMessage)
      .toBe('Shoot reminder\nDetails: https://reprodashboard.com/shoots/2474');
  });

  it.each([
    'Thanks, I will be there.',
    'Note: Liked “Shoot reminder”',
    'Liked “Shoot reminder” and added a note.',
    'Liked “Shoot reminder',
    'Liked “Shoot reminder"',
    'Liked ""',
    'A aprobat „   ”',
    'Reacted 😎 to “Shoot reminder”',
  ])('leaves ordinary, unsupported, or incomplete incoming text untouched: %s', (body) => {
    expect(parseSmsReaction(body, 'INBOUND')).toBeNull();
  });

  it('does not interpret an outgoing message as a reaction', () => {
    expect(parseSmsReaction('Liked “Shoot reminder”', 'OUTBOUND')).toBeNull();
  });
});

describe('buildSmsConversation', () => {
  it('attaches the incoming reaction to its outgoing message without another text bubble', () => {
    const reminder = message('reminder', 'Shoot reminder');
    const incoming = reaction('like', 'A aprobat „Shoot reminder”');
    const items = buildSmsConversation([reminder, incoming]);

    expect(items).toHaveLength(1);
    expect(items[0].message).toEqual(reminder);
    expect(items[0].reactions).toEqual([{
      emoji: '👍', label: 'Like', sender: '+17035550100', reactedAt: incoming.sentAt,
    }]);
    expect(incoming.body).toBe('A aprobat „Shoot reminder”');
  });

  it('uses the latest prior exact outgoing quote in the same thread', () => {
    const items = buildSmsConversation([
      message('older', 'Shoot reminder'),
      message('near-match', 'Shoot reminder tomorrow'),
      message('latest', 'Shoot reminder'),
      message('other-thread', 'Shoot reminder', { threadId: 'thread-2' }),
      reaction('like', 'Liked “Shoot reminder”'),
      message('future', 'Shoot reminder', { sentAt: '2026-10-15T14:02:00Z' }),
    ]);

    expect(items.filter(({ reactions }) => reactions.length).map(({ message: item }) => item.id)).toEqual(['latest']);
    expect(items).toHaveLength(5);
  });

  it('honors an API target ID even when the actual target is from another thread', () => {
    const target = message('system-reminder', 'Shoot reminder', {
      threadId: 'system-thread', from: '+17035550999', to: '+17035550100',
    });
    const incoming = reaction('like', 'A aprobat „Shoot reminder”', {
      to: '+17035550999',
      reaction: { emoji: '👍', label: 'Like', action: 'add', targetMessageId: target.id, quotedMessage: 'Shoot reminder' },
    });
    const items = buildSmsConversation([target, message('same-quote', 'Shoot reminder'), incoming]);

    expect(items.map(({ message: item }) => item.id)).toEqual(['system-reminder', 'same-quote']);
    expect(items[0].reactions).toHaveLength(1);
    expect(items[1].reactions).toEqual([]);
  });

  it('does not attach an API target belonging to different participants', () => {
    const target = message('another-recipient', 'Shoot reminder', {
      from: '+17035550999', to: '+17035550200',
    });
    const incoming = reaction('like', 'Liked “Shoot reminder”', {
      to: '+17035550999',
      reaction: { emoji: '👍', label: 'Like', action: 'add', targetMessageId: target.id, quotedMessage: 'Shoot reminder' },
    });
    const items = buildSmsConversation([target, incoming]);

    expect(items).toHaveLength(2);
    expect(items[0].reactions).toEqual([]);
  });

  it('keeps an API reaction unmatched when its explicit target is unavailable', () => {
    const incoming = reaction('like', 'Liked “Shoot reminder”', {
      reaction: { emoji: '👍', label: 'Like', action: 'add', targetMessageId: 'unavailable', quotedMessage: 'Shoot reminder' },
    });
    const items = buildSmsConversation([message('same-quote', 'Shoot reminder'), incoming]);

    expect(items).toHaveLength(2);
    expect(items[0].reactions).toEqual([]);
  });

  it('keeps an unmatched reaction available as quoted context', () => {
    const incoming = reaction('unmatched', 'Liked “A reminder outside this conversation”');
    const items = buildSmsConversation([message('different', 'Another message'), incoming]);

    expect(items.map(({ message: item }) => item.id)).toEqual(['different', 'unmatched']);
    expect(items[0].reactions).toEqual([]);
    expect(items[1].message).toEqual(incoming);
  });

  it('does not attach a quote to another thread, an incoming message, or a partial body', () => {
    const items = buildSmsConversation([
      message('other-thread', 'Shoot reminder', { threadId: 'thread-2' }),
      message('inbound', 'Shoot reminder', { direction: 'INBOUND' }),
      message('partial', 'Shoot reminder tomorrow'),
      reaction('unmatched', 'Liked “Shoot reminder”'),
    ]);

    expect(items).toHaveLength(4);
    expect(items.every(({ reactions }) => reactions.length === 0)).toBe(true);
  });

  it('shows one badge for repeated likes from the same sender', () => {
    const items = buildSmsConversation([
      message('reminder', 'Shoot reminder'),
      reaction('first-like', 'Liked “Shoot reminder”'),
      reaction('duplicate-like', 'A aprobat „Shoot reminder”'),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].reactions.map(({ emoji }) => emoji)).toEqual(['👍']);
  });

  it('replaces that sender’s prior reaction to the same message', () => {
    const items = buildSmsConversation([
      message('reminder', 'Shoot reminder'),
      reaction('like', 'Liked “Shoot reminder”'),
      reaction('love', 'Loved “Shoot reminder”'),
    ]);

    expect(items[0].reactions.map(({ emoji }) => emoji)).toEqual(['❤️']);
  });

  it('keeps independent reactions from different senders', () => {
    const items = buildSmsConversation([
      message('reminder', 'Shoot reminder'),
      reaction('first-like', 'Liked “Shoot reminder”'),
      reaction('second-like', 'Liked “Shoot reminder”', { from: '+17035550200' }),
    ]);

    expect(items[0].reactions.map(({ sender }) => sender).sort()).toEqual(['+17035550100', '+17035550200']);
  });

  it('removes only the matching sender’s reaction on that target', () => {
    const items = buildSmsConversation([
      message('first', 'First reminder'),
      message('second', 'Second reminder'),
      reaction('first-like', 'Liked “First reminder”'),
      reaction('other-sender-like', 'Liked “First reminder”', { from: '+17035550200' }),
      reaction('second-like', 'Liked “Second reminder”'),
      reaction('remove', 'Removed a like from “First reminder”'),
    ]);

    expect(items).toHaveLength(2);
    expect(items[0].reactions.map(({ sender }) => sender)).toEqual(['+17035550200']);
    expect(items[1].reactions.map(({ emoji }) => emoji)).toEqual(['👍']);
  });

  it('does not remove a newer different emoji when an old reaction is removed', () => {
    const items = buildSmsConversation([
      message('reminder', 'Shoot reminder'),
      reaction('like', 'Liked “Shoot reminder”'),
      reaction('love', 'Loved “Shoot reminder”'),
      reaction('remove-old-like', 'Removed a like from “Shoot reminder”'),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].reactions.map(({ emoji }) => emoji)).toEqual(['❤️']);
  });

  it('preserves ordinary incoming and outgoing messages, including envelope-like outbound text', () => {
    const messages = [
      message('outbound', 'Liked “Shoot reminder”'),
      message('inbound', 'Thanks, I will be there.', { direction: 'INBOUND' }),
    ];

    expect(buildSmsConversation(messages)).toEqual(messages.map((item) => ({ message: item, reactions: [] })));
  });
});
