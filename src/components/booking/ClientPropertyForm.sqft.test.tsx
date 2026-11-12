import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientPropertyForm } from './ClientPropertyForm';
import type { ClientPropertyFormProps } from './useClientPropertyFormController';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/accounts/AccountForm', () => ({ AccountForm: () => null }));

const props = (isClientAccount: boolean, sqft: number): ClientPropertyFormProps => ({
  initialData: {
    clientId: '1', clientName: 'QA Client', clientEmail: 'qa@example.test', clientPhone: '', clientCompany: '',
    propertyAddress: '10 Monroe St', propertyCity: 'Rockville',
    propertyState: 'MD', propertyZip: '20850', propertyType: 'residential', sqft,
  },
  isClientAccount,
  clients: [{ id: '1', name: 'QA Client', email: 'qa@example.test', status: 'active', shootsCount: 0, lastActivity: '' }],
  packages: [], selectedServices: [], onSelectedServicesChange: vi.fn(),
  onComplete: vi.fn(), onPropertyDraftChange: vi.fn(),
});

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe.each([true, false])('booking square footage (client account: %s)', (isClientAccount) => {
  it('starts missing footage blank and submits typed footage without a leading zero', async () => {
    const user = userEvent.setup();
    const input = props(isClientAccount, 0);
    render(<ClientPropertyForm {...input} slide="property" />);
    const sqft = screen.getByRole('spinbutton', { name: /SQFT/ }) as HTMLInputElement;
    expect(sqft.value).toBe('');
    await user.type(sqft, '1064');
    expect(sqft.value).toBe('1064');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(input.onComplete).toHaveBeenCalledWith(expect.objectContaining({ sqft: 1064 })));
  });

  it('keeps an existing value cleared, requires footage, and normalizes pasted leading zeros', async () => {
    const user = userEvent.setup();
    const input = props(isClientAccount, 1800);
    render(<ClientPropertyForm {...input} slide="property" />);
    const sqft = screen.getByRole('spinbutton', { name: /SQFT/ }) as HTMLInputElement;
    await user.clear(sqft);
    await user.tab();
    expect(sqft.value).toBe('');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getAllByText('Square footage is required').length).toBeGreaterThan(0));
    expect(input.onComplete).not.toHaveBeenCalled();
    fireEvent.change(sqft, { target: { value: '001064' } });
    expect(sqft.value).toBe('1064');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(input.onComplete).toHaveBeenCalledWith(expect.objectContaining({ sqft: 1064 })));
  });
});
