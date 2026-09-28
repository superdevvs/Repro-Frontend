import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientPropertyForm } from './ClientPropertyForm';
import type { ClientPropertyFormProps } from './useClientPropertyFormController';

const units = vi.hoisted(() => ({ enabled: false, propertyErrors: {}, setManagerOpen: vi.fn() }));
vi.mock('@/features/shoot-units/useMultiUnitBooking', () => ({ useBookingUnits: () => units.enabled ? units : null }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/accounts/AccountForm', () => ({ AccountForm: () => null }));

const service = { id: '10', name: 'Photography', description: '', price: 100 };
const props = (): ClientPropertyFormProps => ({
  slide: 'property', isClientAccount: true, clients: [], packages: [service], selectedServices: [],
  initialData: { clientId: '1', clientName: 'Client', clientEmail: '', clientPhone: '', clientCompany: '', propertyType: 'residential', propertyAddress: '10 Main St', propertyCity: 'Rockville', propertyState: 'MD', propertyZip: '20850', sqft: 1000 },
  onComplete: vi.fn(), onSelectedServicesChange: vi.fn(), onPropertyDraftChange: vi.fn(), onBack: vi.fn(),
});
beforeEach(() => {
  units.enabled = false;
  units.propertyErrors = {};
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Continue validates the visible booking slide', () => {
  it('advances only once when Continue is clicked twice before validation finishes', async () => {
    const input = props();
    render(<ClientPropertyForm {...input} />);
    const button = screen.getByRole('button', { name: 'Continue' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(input.onComplete).toHaveBeenCalledTimes(1));
  });

  it.each([false, true])('advances a new property with no services or access choice (client account: %s), then requires visible access', async (isClientAccount) => {
    const input = { ...props(), isClientAccount };
    const { rerender } = render(<ClientPropertyForm {...input} />);
    expect(screen.queryByRole('radio', { name: 'Self / client' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(input.onComplete).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Choose who will be at the property.')).not.toBeInTheDocument();

    rerender(<ClientPropertyForm {...input} slide="services" selectedServices={[service]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Choose who will be at the property.'));
    expect(input.onComplete).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('radio', { name: 'Self / client' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(input.onComplete).toHaveBeenCalledTimes(2));
    expect(input.onComplete).toHaveBeenLastCalledWith(expect.objectContaining({ property_details: expect.objectContaining({ presenceOption: 'self' }) }));
  });

  it('removes a services-only warning on Back and preserves property and access when navigating again', async () => {
    const input = props();
    const { rerender } = render(<ClientPropertyForm {...input} slide="services" selectedServices={[service]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('alert');
    rerender(<ClientPropertyForm {...input} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Street Address'), { target: { value: '20 Changed St' } });
    rerender(<ClientPropertyForm {...input} slide="services" selectedServices={[service]} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Lockbox' }));
    fireEvent.change(screen.getByPlaceholderText('####'), { target: { value: '2468' } });
    rerender(<ClientPropertyForm {...input} />);
    expect(screen.getByLabelText('Street Address')).toHaveValue('20 Changed St');
    rerender(<ClientPropertyForm {...input} slide="services" selectedServices={[service]} />);
    expect(screen.getByRole('radio', { name: 'Lockbox' })).toBeChecked();
    expect(screen.getByPlaceholderText('####')).toHaveValue('2468');
  });

  it.each(['propertyDetails', 'property_details'] as const)('restores saved access from %s without requiring it again', async key => {
    const input = props();
    input.initialData[key] = { presenceOption: 'lockbox', sqft: 1000 };
    render(<ClientPropertyForm {...input} slide="services" selectedServices={[service]} />);
    expect(screen.getByRole('radio', { name: 'Lockbox' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(input.onComplete).toHaveBeenCalledTimes(1));
  });

  it('still validates visible property fields and the existing multiunit roster before advancing', async () => {
    units.enabled = true;
    const input = props();
    input.initialData.sqft = undefined;
    input.initialData.propertyAddress = '';
    render(<ClientPropertyForm {...input} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getAllByText('Address is required').length).toBeGreaterThan(0));
    expect(input.onComplete).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Street Address'), { target: { value: '30 Units St' } });
    units.propertyErrors = { 'unit-1': ['Square footage is required'] };
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(units.setManagerOpen).toHaveBeenCalledWith(true));
    expect(input.onComplete).not.toHaveBeenCalled();
    units.propertyErrors = {};
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(input.onComplete).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Choose who will be at the property.')).not.toBeInTheDocument();
  });
});
