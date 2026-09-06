import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EmailVerificationNotice, type EmailVerificationState } from './EmailVerificationNotice';

const mocks = vi.hoisted(() => ({
  context: { user: { id: '7', email: 'owner@example.com', email_verification: { enrolled: true, verified: false, reminder: true, required: false, enforce_at: '2026-09-20T12:00:00Z' } as EmailVerificationState }, isImpersonating: false, logout: vi.fn() },
  get: vi.fn(), post: vi.fn(), resend: vi.fn(),
}));
vi.mock('./AuthProvider', () => ({ useAuth: () => mocks.context }));
vi.mock('@/services/api', () => ({ apiClient: { get: mocks.get, post: mocks.post } }));
vi.mock('@/hooks/useResendVerificationEmail', () => ({ useResendVerificationEmail: () => ({ resendVerification: mocks.resend, isResendingVerification: false }) }));
vi.mock('@/components/profile/ProfileSecurityCard', () => ({ ProfileSecurityCard: () => <div>Security recovery controls</div> }));

describe('email verification pilot notice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context.isImpersonating = false;
    mocks.context.user.email_verification = { enrolled: true, verified: false, reminder: true, required: false, enforce_at: '2026-09-20T12:00:00Z' };
    mocks.get.mockImplementation(async () => ({ data: { email_verification: mocks.context.user.email_verification } }));
    mocks.resend.mockResolvedValue({ message: 'Verification email sent.' });
  });
  afterEach(cleanup);

  it('shows a reminder and keeps dashboard usable during the pilot', async () => {
    render(<EmailVerificationNotice><div>Dashboard data</div></EmailVerificationNotice>);
    expect(screen.getByText('Dashboard data')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send verification email' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Verification email sent.');
  });

  it('replaces protected content after the server gate and retains recovery controls', async () => {
    render(<EmailVerificationNotice><div>Dashboard data</div></EmailVerificationNotice>);
    mocks.context.user.email_verification.required = true;
    window.dispatchEvent(new CustomEvent('email-verification-required'));
    await waitFor(() => expect(screen.queryByText('Dashboard data')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Account security' }));
    expect(screen.getByText('Security recovery controls')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('requires current password for email correction and logs out only after success', async () => {
    mocks.context.user.email_verification.required = true;
    mocks.post.mockResolvedValue({ data: { reauth_required: true } });
    render(<EmailVerificationNotice><div>Dashboard data</div></EmailVerificationNotice>);
    fireEvent.click(screen.getByRole('button', { name: 'Correct email address' }));
    fireEvent.change(screen.getByLabelText('Current email address'), { target: { value: 'correct@example.com' } });
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Secret123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update email' }));
    await waitFor(() => expect(mocks.context.logout).toHaveBeenCalledOnce());
    expect(mocks.post).toHaveBeenCalledWith('/profile/email-verification/correct', { email: 'correct@example.com', current_password: 'Secret123!' });
  });

  it('immediately hides protected content on a server gate while status refresh is pending', async () => {
    render(<EmailVerificationNotice><div>Dashboard data</div></EmailVerificationNotice>);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledOnce());
    mocks.get.mockImplementation(() => new Promise(() => {}));
    window.dispatchEvent(new CustomEvent('email-verification-required'));
    await waitFor(() => expect(screen.queryByText('Dashboard data')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Correct email address' })).toBeInTheDocument();
  });

  it('reminds grandfathered unverified accounts without a deadline or loss of access', () => {
    mocks.context.user.email_verification.enrolled = false;
    mocks.context.user.email_verification.enforce_at = null;
    render(<EmailVerificationNotice><div>Dashboard data</div></EmailVerificationNotice>);
    expect(screen.getByRole('region', { name: 'Email verification' })).toHaveTextContent('You can continue using the dashboard.');
    expect(screen.queryByText(/before|deadline|to keep using/)).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send verification email' })).toBeInTheDocument();
  });

  it('shows no reminder while the pilot is inactive', () => {
    mocks.context.user.email_verification.enrolled = false;
    mocks.context.user.email_verification.reminder = false;
    mocks.context.user.email_verification.enforce_at = null;
    render(<EmailVerificationNotice><div>Dashboard data</div></EmailVerificationNotice>);
    expect(screen.queryByRole('region', { name: 'Email verification' })).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard data')).toBeInTheDocument();
  });

  it('does not treat impersonation as self verification', () => {
    mocks.context.isImpersonating = true;
    render(<EmailVerificationNotice><div>Dashboard data</div></EmailVerificationNotice>);
    expect(screen.queryByRole('region', { name: 'Email verification' })).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard data')).toBeInTheDocument();
  });
});
