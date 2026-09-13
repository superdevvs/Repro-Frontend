import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientPropertyForm } from './ClientPropertyForm';
import type { ClientPropertyFormProps } from './useClientPropertyFormController';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/accounts/AccountForm', () => ({ AccountForm: () => null }));

const service = { id: '10', name: 'Photography', description: '', price: 100 };
const inputValue = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;

const props = (): ClientPropertyFormProps => ({
  initialData: {
    clientId: '1', clientName: 'Example Client', clientEmail: 'client@example.com',
    clientPhone: '', clientCompany: '', propertyType: 'residential',
    propertyAddress: '', propertyCity: 'Rockville', propertyState: 'MD', propertyZip: '20850',
    aptSuite: 'QA 101', sqft: 1000,
  },
  isClientAccount: true, clients: [], packages: [service], selectedServices: [service],
  onSelectedServicesChange: vi.fn(),
  onComplete: vi.fn(), onAddressFieldsChange: vi.fn(), onPropertyDraftChange: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('manual booking street address', () => {
  it('recovers from the required-address error and submits the typed street with other manual fields intact', async () => {
    const input = props();
    render(<ClientPropertyForm {...input} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getAllByText('Address is required').length).toBeGreaterThan(0));
    expect(input.onComplete).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Street Address'), { target: { value: '10 Monroe St' } });

    await waitFor(() => expect(input.onAddressFieldsChange).toHaveBeenLastCalledWith({
      address: '10 Monroe St', city: 'Rockville', state: 'MD', zip: '20850',
    }));
    expect(inputValue('Apt/Suite')).toBe('QA 101');
    expect(inputValue('City')).toBe('Rockville');
    expect((screen.getByPlaceholderText('Start typing the property address...') as HTMLInputElement).value).toBe('10 Monroe St');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(input.onComplete).toHaveBeenCalledWith(expect.objectContaining({
      propertyAddress: '10 Monroe St', completeAddress: '10 Monroe St', aptSuite: 'QA 101',
      propertyCity: 'Rockville', propertyState: 'MD', propertyZip: '20850', sqft: 1000,
    })));
    expect(input.onPropertyDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
      propertyAddress: '10 Monroe St', completeAddress: '10 Monroe St', aptSuite: 'QA 101',
    }));
  });

  it.each(['', '10 Monroe St'])('keeps a cleared street empty and blocks Continue (initial street: %j)', async (initialStreet) => {
    const input = props();
    input.initialData.propertyAddress = initialStreet;
    input.initialData.completeAddress = initialStreet;
    render(<ClientPropertyForm {...input} />);

    if (!initialStreet) {
      fireEvent.change(screen.getByLabelText('Street Address'), { target: { value: '10 Monroe St' } });
    }
    fireEvent.change(screen.getByLabelText('Street Address'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(screen.getAllByText('Address is required').length).toBeGreaterThan(0));
    expect(inputValue('Street Address')).toBe('');
    expect(inputValue('Apt/Suite')).toBe('QA 101');
    expect(inputValue('City')).toBe('Rockville');
    expect(input.onAddressFieldsChange).toHaveBeenLastCalledWith({
      address: '', city: 'Rockville', state: 'MD', zip: '20850',
    });
    expect(input.onComplete).not.toHaveBeenCalled();
  });

  it('preserves autocomplete selection and subsequent manual correction without resetting provider-filled fields', async () => {
    const input = props();
    const fetchMock = vi.fn(async (url: string | URL | Request) => ({
      ok: true,
      json: async () => String(url).includes('/address/search')
        ? { data: [{ place_id: 'example-address', main_text: '22 Example Road', secondary_text: 'Bethesda, MD 20814', description: '22 Example Road, Bethesda, MD 20814' }] }
        : { data: { address: '22 Example Road', city: 'Bethesda', state: 'MD', zip: '20814', apt_suite: 'Unit 4', sqft: 1400 } },
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ClientPropertyForm {...input} />);

    fireEvent.change(screen.getByPlaceholderText('Start typing the property address...'), { target: { value: '22 Example' } });
    fireEvent.click(await screen.findByRole('button', { name: /22 Example Road.*Bethesda/ }));
    await waitFor(() => expect(inputValue('Street Address')).toBe('22 Example Road'));
    expect(inputValue('Apt/Suite')).toBe('Unit 4');
    expect(inputValue('City')).toBe('Bethesda');

    const lookupCount = fetchMock.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Street Address'), { target: { value: '22 Example Rd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(input.onComplete).toHaveBeenCalledWith(expect.objectContaining({
      propertyAddress: '22 Example Rd', completeAddress: '22 Example Rd', aptSuite: 'Unit 4',
      propertyCity: 'Bethesda', propertyState: 'MD', propertyZip: '20814', sqft: 1400,
    })));
    expect(fetchMock).toHaveBeenCalledTimes(lookupCount);
  });
});
