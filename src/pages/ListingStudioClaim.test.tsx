import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetListingStudioClaim, readListingStudioClaim, rememberListingStudioClaim } from '@/lib/listingStudioClaim';
import ListingStudioClaim from './ListingStudioClaim';

const mocks = vi.hoisted(() => ({
  claim: vi.fn(), get: vi.fn(), download: vi.fn(),
  auth: { user: { id: '41', role: 'client', email_verification: { required: true, verified: false } }, isImpersonating: false },
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/services/listingStudioTrials', () => ({ claimListingStudioTrials: mocks.claim, getListingStudioTrials: mocks.get, downloadListingStudioTrial: mocks.download }));
const token = 'b'.repeat(64);
const trial = { id: 'trial-1', service: 'staging', status: 'completed', progress: 100, previewAvailable: true, downloadAvailable: true, createdAt: '', completedAt: '', expiresAt: null, error: null, errorCode: null };
const failure = (code: string, status: number) => ({ response: { status, data: { code, message: 'Request could not be completed' } } });
beforeEach(() => {
  vi.resetAllMocks();
  const stored = readListingStudioClaim(); if (stored) forgetListingStudioClaim(stored);
  sessionStorage.clear();
  mocks.auth.user = { id: '41', role: 'client', email_verification: { required: true, verified: false } };
  mocks.auth.isImpersonating = false;
  mocks.get.mockResolvedValue([]);
  mocks.claim.mockResolvedValue([trial]);
  mocks.download.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('Listing Studio client downloads', () => {
  it('claims after login without an email verification gate and survives StrictMode replay', async () => {
    rememberListingStudioClaim(`#${token}`);
    render(<StrictMode><ListingStudioClaim /></StrictMode>);
    expect(await screen.findByRole('button', { name: 'Download Virtual staging' })).toBeEnabled();
    expect(mocks.claim).toHaveBeenCalledExactlyOnceWith(token);
    expect(readListingStudioClaim()).toBeNull();
    expect(screen.queryByText(/verify your email/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download Virtual staging' }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledExactlyOnceWith(trial));
  });
  it('loads the authenticated owner list on a clean visit or refresh', async () => {
    mocks.get.mockResolvedValue([trial]);
    render(<ListingStudioClaim />);
    expect(await screen.findByText('Ready to download')).toBeVisible();
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it.each([['claim_expired', 410, 'expired'], ['claim_conflict', 409, 'another account'], ['trial_allowance_used', 409, 'already used']])('explains %s and preserves existing downloads', async (code, status, text) => {
    rememberListingStudioClaim(`#${token}`);
    mocks.claim.mockRejectedValue(failure(String(code), Number(status)));
    mocks.get.mockResolvedValue([trial]);
    render(<ListingStudioClaim />);
    expect(await screen.findByRole('alert')).toHaveTextContent(String(text));
    expect(screen.getByRole('button', { name: 'Download Virtual staging' })).toBeEnabled();
    expect(readListingStudioClaim()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(mocks.claim).toHaveBeenCalledTimes(1);
  });
  it('retains the token after a lost response so an explicit retry can recover the claim', async () => {
    rememberListingStudioClaim(`#${token}`);
    mocks.claim.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([trial]);
    render(<ListingStudioClaim />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Ready to download')).toBeVisible();
    expect(mocks.claim).toHaveBeenCalledTimes(2);
  });
  it('does not claim while impersonating a client', () => {
    mocks.auth.isImpersonating = true;
    rememberListingStudioClaim(`#${token}`);
    render(<ListingStudioClaim />);
    expect(screen.getByText('Use your client account')).toBeVisible();
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it('shows a recoverable download error without navigating to a file URL', async () => {
    mocks.get.mockResolvedValue([trial]);
    mocks.download.mockRejectedValue({ response: { status: 410, data: { code: 'trial_expired', message: 'This photo has expired.' } } });
    render(<ListingStudioClaim />);
    fireEvent.click(await screen.findByRole('button', { name: 'Download Virtual staging' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This photo has expired.');
    expect(screen.getByRole('button', { name: 'Download Virtual staging' })).toBeEnabled();
  });
});
