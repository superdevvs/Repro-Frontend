import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ShootData } from '@/types/shoots';
import { AddServiceDialog } from './AddServiceDialog';
import { submitShootServiceMutation } from '@/utils/shootServiceMutation';

const mocks = vi.hoisted(() => ({ toast: vi.fn(), confirm: vi.fn(async () => ({})) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/features/travel/useTravelFeasibility', () => ({ useTravelFeasibility: () => ({ blocked: false, confirmSave: mocks.confirm }) }));
vi.mock('@/features/travel/TravelFeasibilityPanel', () => ({ TravelFeasibilityPanel: () => null }));
vi.mock('@/components/booking/ServicePickerField', () => ({ ServicePickerField: ({ value, onValueChange, options }: {
  value: string; onValueChange: (id: string) => void; options: Array<{ id: string; name: string }>;
}) => <select aria-label="Choose service" value={value} onChange={event => onValueChange(event.target.value)}>
  <option value="">Select</option>{options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
</select> }));
vi.mock('@/utils/shootServiceMutation', async importOriginal => ({ ...await importOriginal<object>(), submitShootServiceMutation: vi.fn(async () => ({ kind: 'success', data: {} })) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Add Service financial fee', () => {
  it.each([false, true])('retains the current payee and requires no new visit (unit=%s)', async unit => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 90, name: 'Onsite Cancellation/hold fee',
      financial_only: true, photographer_required: false, allows_photographer_assignment: true, price: 60 }] }), { status: 200 })));
    const photo = { id: '3', service_id: '3', shoot_service_id: '6128', shoot_unit_id: 15, client_key: 'unit-15:3',
      name: '25 Flash Photos', price: 125, quantity: 1, scheduled_at: '2026-11-06T15:00:00Z', photographer_id: '1143' };
    const shoot = { id: '5944', timezone: 'America/New_York', scheduledDate: '2026-11-06', time: '10:00', photographer: { id: '1143', name: 'Ivan' },
      serviceItems: [photo], ...(unit ? { units_revision: 2, units: [{ id: 15, client_key: 'unit-15', label: '1', kind: 'unit' }] } : {}) } as ShootData;
    render(<AddServiceDialog shoot={shoot} onShootUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Service' }));
    const select = await screen.findByRole('combobox', { name: 'Choose service' });
    await waitFor(() => expect(within(select).getByRole('option', { name: 'Onsite Cancellation/hold fee' })).toBeInTheDocument());
    fireEvent.change(select, { target: { value: '90' } });
    expect(screen.getByText('No visit required for this fee.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Schedule Date')).toBeNull();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add Service' }));
    await waitFor(() => expect(submitShootServiceMutation).toHaveBeenCalled());
    const body = vi.mocked(submitShootServiceMutation).mock.lastCall![0].payload;
    expect(unit ? body.service_lines : body.service_items).toEqual(expect.arrayContaining([
      expect.objectContaining({ service_id: unit ? '90' : 90, photographer_id: 1143, scheduled_at: null }),
    ]));
  });
});
