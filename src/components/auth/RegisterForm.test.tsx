import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import RegisterForm from './RegisterForm';
import { LoginForm } from './LoginForm';

const mocks = vi.hoisted(() => ({ post: vi.fn(), login: vi.fn(), toast: vi.fn(), mobile: false }));
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return { ...actual, default: { ...actual.default, post: mocks.post } };
});
vi.mock('@/components/auth', () => ({ useAuth: () => ({ login: mocks.login }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mocks.mobile }));
vi.mock('@/components/layout/Logo', () => ({ Logo: () => <span>REPro</span> }));
vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }));
vi.mock('./RegisterLegalDialogs', () => ({
  PrivacyPolicyDialog: () => null,
  TermsAgreementDialog: ({ open, onAgree }: { open: boolean; onAgree: () => void }) => open
    ? <button type="button" onClick={onAgree}>Agree and Close</button> : null,
}));

const duplicateMessage = 'An account with this email already exists. Please verify your email, then log in.';
const duplicate = () => new AxiosError('Request failed', undefined, undefined, undefined, {
  data: { code: 'account_exists', message: duplicateMessage, errors: { email: [duplicateMessage] }, email_verification_required: true },
  status: 422, statusText: 'Error', headers: {}, config: {} as never,
});

async function submitRegistration() {
  fireEvent.change(screen.getByPlaceholderText('First Name'), { target: { value: 'Existing' } });
  fireEvent.change(screen.getByPlaceholderText('Last Name'), { target: { value: 'Client' } });
  fireEvent.change(screen.getByPlaceholderText('Your email'), { target: { value: 'client@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'New-unapplied-password-42' } });
  fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'New-unapplied-password-42' } });
  fireEvent.click(screen.getByRole('button', { name: /Next/ }));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Agree to the Terms and Conditions' }));
  fireEvent.click(screen.getByRole('button', { name: 'Agree and Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'Register' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mobile = false;
  mocks.post.mockReset();
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('registration error recovery', () => {
  it.each([false, true])('keeps duplicate-account feedback visible and actionable (mobile: %s)', async (mobile) => {
    mocks.mobile = mobile;
    mocks.post.mockRejectedValueOnce(duplicate());
    const onSuccess = vi.fn();
    const onLogin = vi.fn();
    render(<RegisterForm onSuccess={onSuccess} onLogin={onLogin} isActive />);
    await submitRegistration();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(duplicateMessage);
    expect(screen.getAllByText(duplicateMessage)).toHaveLength(1);
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(alert).toHaveFocus();
    expect(screen.getByPlaceholderText('Your email')).toHaveValue('client@example.com');
    fireEvent.click(within(alert).getByRole('button', { name: 'Go to login' }));
    expect(onLogin).toHaveBeenCalledWith('client@example.com');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mocks.post).toHaveBeenCalledWith(expect.stringMatching(/\/api\/register$/), expect.any(Object), { headers: { Accept: 'application/json' } });
  });

  it.each([false, true])('shows an ordinary server email error only once (mobile: %s)', async (mobile) => {
    mocks.mobile = mobile;
    const message = 'Please use a valid email address.';
    mocks.post.mockRejectedValueOnce(new AxiosError('Request failed', undefined, undefined, undefined, {
      data: { message, errors: { email: [message] } },
      status: 422, statusText: 'Error', headers: {}, config: {} as never,
    }));
    render(<RegisterForm onSuccess={vi.fn()} isActive />);
    await submitRegistration();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getAllByText(message)).toHaveLength(1);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('keeps client-side validation beside the field without a server error banner', async () => {
    render(<RegisterForm onSuccess={vi.fn()} isActive />);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(await screen.findByText('Invalid email address')).toBeVisible();
    expect(screen.getByPlaceholderText('Your email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(['resolved', 'rejected'])('keeps an HTML %s response inside the form without signing in', async (kind) => {
    const html = '<!doctype html><h1>Under construction</h1>';
    if (kind === 'resolved') mocks.post.mockResolvedValueOnce({ data: html });
    else mocks.post.mockRejectedValueOnce(new AxiosError('Error', undefined, undefined, undefined, {
      data: html, status: 500, statusText: 'Error', headers: {}, config: {} as never,
    }));
    const onSuccess = vi.fn();
    render(<RegisterForm onSuccess={onSuccess} isActive />);
    await submitRegistration();
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't complete registration.");
    expect(screen.queryByText(/Under construction/)).not.toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('returns to login with the existing email and an empty password', async () => {
    mocks.post.mockRejectedValueOnce(duplicate());
    render(<MemoryRouter><LoginForm /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'Previously-entered-password' } });
    await userEvent.click(screen.getByRole('tab', { name: 'Register' }));
    await submitRegistration();
    const alert = await screen.findByRole('alert');
    fireEvent.click(within(alert).getByRole('button', { name: 'Go to login' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Log in to your dashboard' })).toBeVisible());
    expect(screen.getByPlaceholderText('Email')).toHaveValue('client@example.com');
    expect(screen.getByPlaceholderText('Password')).toHaveValue('');
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it('renders safe feedback for malformed object errors without crashing the page', async () => {
    mocks.post.mockRejectedValueOnce(new AxiosError('Error', undefined, undefined, undefined, {
      data: { message: { html: 'Under construction' }, errors: { email: [{ invalid: true }] } },
      status: 422, statusText: 'Error', headers: {}, config: {} as never,
    }));
    const onSuccess = vi.fn();
    render(<RegisterForm onSuccess={onSuccess} isActive />);
    await submitRegistration();
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't complete registration.");
    expect(screen.getByPlaceholderText('Your email')).toBeVisible();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

