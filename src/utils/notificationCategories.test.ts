import { describe, expect, it } from 'vitest';
import type { NotificationItem } from '@/hooks/useNotifications';
import { countNotificationCategories } from './notificationCategories';

const event = (id: string, action: string, isRead = false): NotificationItem => ({
  id, action, isRead, title: action, message: id, type: 'shoots', date: '2026-10-10T00:00:00Z',
});

describe('notification category counts', () => {
  it('counts every category, including read history, with separate unread totals and no duplicate IDs', () => {
    const counts = countNotificationCategories([
      event('p1', 'payment_received', true), event('p2', 'payment_failed'),
      event('p2', 'payment_failed'), event('u1', 'media_uploaded'),
      event('u2', 'shoot_submitted_raw', true), event('e1', 'shoot_editing_started', true),
    ]);
    expect(counts).toEqual([
      { category: 'payment', label: 'Payments', count: 2, unreadCount: 1 },
      { category: 'uploads', label: 'Uploads', count: 2, unreadCount: 1 },
      { category: 'editing', label: 'Editing', count: 1, unreadCount: 0 },
    ]);
    expect(counts.reduce((sum, entry) => sum + entry.count, 0)).toBe(5);
  });

  it('distinguishes delivery from email warnings, review from editing, and requests from scheduling', () => {
    const cases = [
      ['shoot_finalized_delivered', 'delivery'], ['email_delivery_risky', 'account'],
      ['shoot_submitted_for_editing_review', 'review'], ['shoot_assignment_review', 'review'],
      ['cancellation_approved', 'requests'], ['shoot_put_on_hold', 'requests'],
      ['shoot_rescheduled', 'schedule'], ['photographer_assigned', 'schedule'],
      ['editor_assigned', 'editing'], ['invoice_sent', 'payment'], ['media_upload_failed', 'uploads'],
      ['internal_message_received', 'messages'], ['shoot_updated', 'updates'], ['future_action', 'updates'],
    ];
    for (const [action, category] of cases) {
      expect(countNotificationCategories([event(action, action)])[0].category).toBe(category);
    }
  });

  it('supports older title-only events and message threads without losing unrecognized events', () => {
    expect(countNotificationCategories([{ ...event('p', ''), title: 'Payment Received' }])[0].category).toBe('payment');
    expect(countNotificationCategories([{ ...event('m', ''), type: 'messages', title: 'Hello' }])[0].category).toBe('messages');
    expect(countNotificationCategories([{ ...event('s', ''), type: 'system', title: 'Account Updated' }])[0].category).toBe('account');
    expect(countNotificationCategories([])).toEqual([]);
  });
});
