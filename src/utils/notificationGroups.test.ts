import { describe, expect, it } from 'vitest';
import type { NotificationItem } from '@/hooks/useNotifications';
import { buildNotificationTimeline, countUnreadGroups, groupNotifications } from './notificationGroups';

const event = (id: string, shootId = 1, action = 'shoot_updated', minute = 0, isRead = false): NotificationItem => ({
  id, shootId, action, title: action, address: 'Same street address', message: id, date: new Date(Date.UTC(2026, 9, 10, 0, minute)).toISOString(), type: 'shoots', isRead,
});

describe('notification groups', () => {
  it('counts one unread shoot for many events but keeps shoots at the same address separate', () => {
    const items = [event('a'), event('b'), event('c', 2), event('d', 3, 'shoot_updated', 0, true)];
    expect(countUnreadGroups(items)).toBe(2);
    expect(groupNotifications(items)).toHaveLength(3);
    expect(groupNotifications(items).find(group => group.shootId === 1)?.events).toHaveLength(2);
  });
  it('keeps a pending request visible through routine events and acknowledgements, until resolved', () => {
    const request = event('request', 1, 'hold_requested', 1, true);
    const progress = event('progress', 1, 'media_uploaded', 2);
    expect(groupNotifications([request, progress])[0].attention.map(item => item.id)).toEqual(['request']);
    expect(groupNotifications([request, progress, event('resolved', 1, 'hold_approved', 3)])[0].attention).toEqual([]);
    expect(groupNotifications([event('old-approval', 1, 'hold_approved'), request])[0].attention).toHaveLength(1);
  });
  it('does not resolve an upload failure with success from another batch', () => {
    const failure = { ...event('fail', 1, 'upload_failed'), metadata: { upload_batch_id: 'a' } };
    const success = { ...event('success', 1, 'media_uploaded', 1), metadata: { upload_batch_id: 'b' } };
    expect(groupNotifications([failure, success])[0].attention).toHaveLength(1);
    expect(groupNotifications([failure, { ...success, metadata: { upload_batch_id: 'a' } }])[0].attention).toHaveLength(0);
  });
  it('orders timelines chronologically and collapses only consecutive routine bursts without losing events', () => {
    const timeline = buildNotificationTimeline([event('last', 1, 'media_uploaded', 3), event('first', 1, 'media_uploaded', 1), event('second', 1, 'media_uploaded', 2)]);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].events.map(item => item.id)).toEqual(['first', 'second', 'last']);
    expect(buildNotificationTimeline([event('a', 1, 'media_uploaded', 1), event('failure', 1, 'upload_failed', 2), event('b', 1, 'media_uploaded', 3)])).toHaveLength(3);
  });
  it('deduplicates only matching IDs and preserves genuinely separate events', () => {
    expect(groupNotifications([event('sa-1'), event('sa-1'), event('sa-2')])[0].events).toHaveLength(2);
  });
  it('preserves request and resolution order when timestamps share a second', () => {
    const request = event('sa-101', 1, 'hold_requested');
    const resolved = event('sa-102', 1, 'hold_approved');
    expect(groupNotifications([request, resolved])[0].attention).toHaveLength(0);
    expect(buildNotificationTimeline([resolved, request]).map(entry => entry.id)).toEqual(['sa-101', 'sa-102']);
  });
  it('summarizes upload counts without counting the same batch twice', () => {
    const upload = (id: string, batch: string, count: number, minute: number) => ({ ...event(id, 1, 'media_uploaded', minute), metadata: { file_count: count, upload_batch_id: batch } });
    expect(buildNotificationTimeline([upload('a', 'first', 12, 0), upload('b', 'first', 12, 1), upload('c', 'second', 8, 2)])[0].title).toBe('20 files uploaded');
  });
  it('groups message threads independently from a shoot and supports missing addresses', () => {
    const items: NotificationItem[] = [event('shoot'), { ...event('mail'), type: 'messages', metadata: { thread_id: 4 } }, { ...event('mail2'), type: 'messages', metadata: { thread_id: 4 } }];
    expect(countUnreadGroups(items)).toBe(2);
    expect(groupNotifications([{ ...event('missing'), address: undefined }])[0].title).toBe('Shoot #1');
  });
  it('clears verification attention only for the matching account', () => {
    const request = { ...event('email-issue-1', 1, 'email_verification_requested'), type: 'system' as const, metadata: { user_id: 7 } };
    const verified = { ...event('email-issue-2', 1, 'email_verified'), type: 'system' as const, metadata: { user_id: 7 } };
    expect(groupNotifications([request, verified])[0].attention).toHaveLength(0);
    expect(groupNotifications([request, { ...verified, metadata: { user_id: 8 } }]).find(group => group.id === 'account:7')?.attention).toHaveLength(1);
  });
});
