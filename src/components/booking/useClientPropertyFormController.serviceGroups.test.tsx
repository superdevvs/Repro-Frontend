import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useClientPropertyFormController, type ClientPropertyFormProps } from './useClientPropertyFormController';

const auth = vi.hoisted(() => ({ user: { role: 'admin' } }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
afterEach(cleanup);

const visible = { id: '10', name: 'Photography', description: '', price: 100, service_group_ids: ['1'] };
const hidden = { id: '11', name: 'Travel fee', description: '', price: 25, service_group_ids: ['2'] };
const props = (): ClientPropertyFormProps => ({
  initialData: { clientId: '1', clientName: 'Client', clientEmail: '', clientPhone: '', clientCompany: '', propertyType: 'residential', propertyAddress: '100 Main Street', propertyCity: 'Arlington', propertyState: 'VA', propertyZip: '22201', sqft: 1000 },
  clients: [{ id: '1', name: 'Client', email: 'client@example.test', status: 'active', shootsCount: 0, lastActivity: '', service_group_ids: ['1'] }],
  packages: [visible, hidden], selectedServices: [hidden], onComplete: vi.fn(), onSelectedServicesChange: vi.fn(),
});

describe('staff-assisted service selection', () => {
  it.each(['admin', 'superadmin', 'salesRep', 'salesrep', 'sales_rep'])('shows and retains extra services for %s', role => {
    auth.user.role = role;
    const input = props();
    const { result } = renderHook(() => useClientPropertyFormController(input));
    expect(result.current.visiblePackages.map(item => item.id)).toEqual(['10', '11']);
    expect(input.onSelectedServicesChange).not.toHaveBeenCalledWith([]);
  });

  it('keeps the existing restriction for other staff', () => {
    auth.user.role = 'editing_manager';
    const input = props();
    const { result } = renderHook(() => useClientPropertyFormController(input));
    expect(result.current.visiblePackages.map(item => item.id)).toEqual(['10']);
    expect(input.onSelectedServicesChange).toHaveBeenCalledWith([]);
  });

  it('uses the server-filtered client catalog for requests', () => {
    auth.user.role = 'client';
    const input = { ...props(), isClientAccount: true, packages: [visible], selectedServices: [] };
    const { result } = renderHook(() => useClientPropertyFormController(input));
    expect(result.current.visiblePackages.map(item => item.id)).toEqual(['10']);
  });
});
