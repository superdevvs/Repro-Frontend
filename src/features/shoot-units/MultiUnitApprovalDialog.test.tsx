import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MultiUnitApprovalDialog } from './MultiUnitApprovalDialog';

const { post } = vi.hoisted(() => ({ post: vi.fn().mockResolvedValue({ data: {} }) }));
vi.mock('@/services/api', () => ({ apiClient: { post } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('large property approval', () => {
  it('reviews one of 100 units while preserving every booked line and the revision in approval', async () => {
    const source = {
      id: 98765, units_revision: 8, timezone: 'America/Chicago',
      units: Array.from({ length: 100 }, (_, index) => ({ id: index + 1, client_key: `u${index + 1}`, label: `Unit ${index + 1}`, kind: 'unit', sqft: 900 })),
      service_lines: Array.from({ length: 100 }, (_, index) => ({ shoot_service_id: index + 101, service_id: 7, shoot_unit_id: index + 1, name: 'Photos', scheduled_at: '2026-10-28T09:00:00-05:00', photographer_id: 9, price: 150 + index })),
    };
    const onApproved = vi.fn();
    const onClose = vi.fn();
    render(<MultiUnitApprovalDialog open source={source} photographers={[{ id: 9, name: 'Alex' }]} onApproved={onApproved} onClose={onClose} />);
    expect(screen.getAllByRole('group')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Change unit' }));
    fireEvent.change(screen.getByLabelText('Search units'), { target: { value: 'Unit 100' } });
    fireEvent.click(screen.getByRole('button', { name: /Unit 100.*900 sqft/ }));
    expect(screen.getAllByRole('group')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Photos time'), { target: { value: '07:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve 100 units / areas' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, payload] = post.mock.calls[0];
    expect(url).toBe('/shoots/98765/approve');
    expect(payload.expected_units_revision).toBe(8);
    expect(payload.service_lines).toHaveLength(100);
    expect(payload.service_lines.map((line: { shoot_service_id: string }) => line.shoot_service_id)).toEqual(Array.from({ length: 100 }, (_, index) => String(index + 101)));
    expect(payload.service_lines[0]).toMatchObject({ shoot_unit_id: '1', service_id: '7', scheduled_at: '2026-10-28T09:00:00-05:00' });
    expect(payload.service_lines[99]).toMatchObject({ shoot_service_id: '200', shoot_unit_id: '100', scheduled_at: '2026-10-28T12:30:00.000Z' });
    expect(payload.scheduled_at).toBe('2026-10-28T12:30:00.000Z');
    expect(payload.service_lines[99]).not.toHaveProperty('price');
    expect(payload).not.toHaveProperty('services');
    await waitFor(() => expect(onApproved).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
