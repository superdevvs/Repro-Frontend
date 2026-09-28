import React from 'react';
import '@testing-library/jest-dom/vitest';
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

  it('changes an enabled service quantity using booked unit prices and preserves other units on approval', async () => {
    const source = {
      id: 98766, units_revision: 3, timezone: 'America/Chicago',
      units: [
        { id: 1, client_key: 'u1', label: 'Unit 1', kind: 'unit', sqft: 900 },
        { id: 2, client_key: 'u2', label: 'Unit 2', kind: 'unit', sqft: 1100 },
      ],
      service_lines: [
        { shoot_service_id: 101, service_id: 7, shoot_unit_id: 1, name: 'Photos', allow_multiple: true, quantity: 2,
          price: 175, subtotal: 350, scheduled_at: '2026-10-28T09:00:00-05:00', photographer_id: 9 },
        { shoot_service_id: 102, service_id: 8, shoot_unit_id: 2, name: 'Floor plan', allow_multiple: false, quantity: 4,
          price: 80, subtotal: 320, scheduled_at: '2026-10-28T11:00:00-05:00', photographer_id: 9 },
      ],
    };
    render(<MultiUnitApprovalDialog open source={source} photographers={[{ id: 9, name: 'Alex' }]} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Photos quantity')).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button', { name: 'Increase Photos quantity' }));
    expect(screen.getByText('$525.00')).toBeInTheDocument();
    expect(screen.getByText('$845.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next unit' }));
    expect(screen.getByText('Quantity: 4')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Floor plan quantity/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve 2 units / areas' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][1]).toMatchObject({ expected_units_revision: 3, service_lines: [
      { shoot_service_id: '101', shoot_unit_id: '1', service_id: '7', quantity: 3 },
      { shoot_service_id: '102', shoot_unit_id: '2', service_id: '8', quantity: 4 },
    ] });
    expect(post.mock.calls[0][1].service_lines[0]).not.toHaveProperty('price');
  });

  it('keeps an enabled service selected at quantity one and permits decreasing back to one', () => {
    render(<MultiUnitApprovalDialog open source={{ id: 98767, units_revision: 0,
      units: [{ id: 1, label: 'Unit 1', kind: 'unit', sqft: 900 }],
      service_lines: [{ shoot_service_id: 1, service_id: 7, shoot_unit_id: 1, name: 'Photos',
        allow_multiple: true, price: 100, quantity: 1 }],
    }} photographers={[]} onClose={vi.fn()} />);
    const minus = screen.getByRole('button', { name: 'Decrease Photos quantity' });
    expect(minus).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Increase Photos quantity' }));
    expect(minus).not.toBeDisabled();
    fireEvent.click(minus);
    expect(screen.getByLabelText('Photos quantity')).toHaveTextContent('1');
    expect(minus).toBeDisabled();
  });
});
