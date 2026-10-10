import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { NotificationItem } from '@/hooks/useNotifications';
import { groupNotifications } from '@/utils/notificationGroups';
import { NotificationTimelineDialog } from './NotificationTimelineDialog';

const item = (id: string, action: string, minute: number): NotificationItem => ({
  id, action, shootId: 7, address: '1036 Scenic Drive', title: action, message: `Original event ${id}`,
  date: new Date(Date.UTC(2026, 9, 10, 0, minute)).toISOString(), type: 'shoots', isRead: false,
});
const formatDate = (date: string) => date;
afterEach(cleanup);

describe('shoot notification timeline', () => {
  it('retains pending actions and individual updates, and acknowledges only the displayed snapshot', () => {
    const group = groupNotifications([item('sa-1', 'hold_requested', 0), item('sa-2', 'media_uploaded', 1), item('sa-3', 'media_uploaded', 2)])[0];
    const onRead = vi.fn();
    const view = render(<NotificationTimelineDialog group={group} onRead={onRead} onOpen={vi.fn()} onClose={vi.fn()} formatDate={formatDate} />);
    expect(within(screen.getByRole('region', { name: 'Pending actions' })).getByRole('button', { name: /hold_requested/ })).toBeDefined();
    fireEvent.click(screen.getByText('Show 2 individual updates'));
    expect(screen.getByText('Original event sa-2')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Mark 3 updates read' }));
    expect(onRead).toHaveBeenCalledWith(['sa-3', 'sa-2', 'sa-1']);

    const acknowledged = group.events.map(event => ({ ...event, isRead: true }));
    const updated = groupNotifications([...acknowledged, item('sa-4', 'shoot_updated', 3)])[0];
    view.rerender(<NotificationTimelineDialog group={updated} onRead={onRead} onOpen={vi.fn()} onClose={vi.fn()} formatDate={formatDate} />);
    expect(screen.getByRole('button', { name: 'Mark 1 update read' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Pending actions' })).toBeDefined();
  });

  it('opens the shoot overview from the footer and preserves the request action when reviewing', () => {
    const group = groupNotifications([item('sa-1', 'hold_requested', 0)])[0];
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(<NotificationTimelineDialog group={group} onRead={vi.fn()} onOpen={onOpen} onClose={onClose} formatDate={formatDate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open shoot' }));
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ shootId: 7, action: undefined, title: '1036 Scenic Drive' }));
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ shootId: 7, action: 'hold_requested' }));
  });
});
