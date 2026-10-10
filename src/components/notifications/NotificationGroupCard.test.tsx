import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { NotificationItem } from '@/hooks/useNotifications';
import { groupNotifications } from '@/utils/notificationGroups';
import { NotificationGroupCard } from './NotificationGroupCard';

afterEach(cleanup);
const event = (id: string, action: string, isRead = false): NotificationItem => ({
  id, action, isRead, shootId: 7, address: '7910 Piney Branch Road', title: action,
  message: id, type: 'shoots', date: '2026-10-10T00:00:00Z',
});

describe('notification group category pills', () => {
  it('replaces generic updates with accessible category counts and supports tap and keyboard expansion', () => {
    const group = groupNotifications([event('p1', 'payment_received', true), event('p2', 'payment_received'), event('u', 'media_uploaded')])[0];
    const onRead = vi.fn();
    const onOpen = vi.fn();
    const onTimeline = vi.fn();
    const view = render(<NotificationGroupCard group={group} formatDate={() => '8m ago'} onRead={onRead} onOpen={onOpen} onTimeline={onTimeline} />);
    expect(screen.queryByText('2 new updates')).toBeNull();
    expect(screen.getByText('3 events')).toBeDefined();
    const payments = screen.getByRole('button', { name: 'Payments: 2 events, 1 unread' });
    expect(payments.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(payments);
    expect(payments.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Payments · 1 new').className).toContain('max-w-52');
    fireEvent.click(screen.getByRole('button', { name: 'Uploads: 1 event, 1 unread' }));
    expect(payments.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /View timeline/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Open shoot' }));
    fireEvent.click(screen.getByRole('button', { name: /Mark .* as read/ }));
    expect(onTimeline).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onRead).toHaveBeenCalledTimes(1);
    view.rerender(<NotificationGroupCard group={groupNotifications(group.events.map(item => ({ ...item, isRead: true })))[0]} formatDate={() => '8m ago'} onRead={onRead} onOpen={onOpen} onTimeline={onTimeline} />);
    expect(screen.getByRole('button', { name: 'Payments: 2 events, 0 unread' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Mark .* as read/ })).toBeNull();
  });
});
