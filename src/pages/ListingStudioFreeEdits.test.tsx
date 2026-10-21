import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ListingStudioFreeEdits from './ListingStudioFreeEdits';
import type { FreeEditsEligibility } from '@/services/listingStudioFreeEdits';

const mocks = vi.hoisted(() => ({
  get: vi.fn(), submit: vi.fn(), resend: vi.fn(),
  auth: { user: { id: '41', role: 'client' }, isImpersonating: false },
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useResendVerificationEmail', () => ({ useResendVerificationEmail: () => ({ resendVerification: mocks.resend, isResendingVerification: false }) }));
vi.mock('@/services/listingStudioFreeEdits', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/listingStudioFreeEdits')>(),
  getFreeEditsEligibility: mocks.get, submitFreeEdits: mocks.submit,
}));

const available: FreeEditsEligibility = {
  eligible: true, reason: null, email_verified: true, claim: null,
  offer: { photo_count: 3, max_file_size_bytes: 10485760, allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'], edit_types: [
    { code: 'virtual_staging', label: 'Virtual staging' }, { code: 'decluttering', label: 'Digital decluttering' },
    { code: 'green_grass', label: 'Green grass' }, { code: 'twilight', label: 'Digital dusk / twilight' },
  ] },
};
const claim = { id: 1, ticket_id: 93, status: 'open', support_url: '/messaging/email/inbox?tab=support&ticket=93' };
const image = (number: number, type = 'image/jpeg') => new File([`photo ${number}`], `room-${number}.jpg`, { type, lastModified: number });

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<MemoryRouter><QueryClientProvider client={client}><ListingStudioFreeEdits /></QueryClientProvider></MemoryRouter>);
}
async function fillPhotos() {
  await screen.findByRole('form', { name: 'Free photo edit request' });
  const types = ['virtual_staging', 'decluttering', 'twilight'];
  for (let i = 1; i <= 3; i++) {
    fireEvent.change(screen.getByLabelText(`Upload photo ${i}`), { target: { files: [image(i)] } });
    fireEvent.change(screen.getByLabelText(`Edit for photo ${i}`), { target: { value: types[i - 1] } });
  }
}
function submit() { fireEvent.submit(screen.getByRole('form', { name: 'Free photo edit request' })); }

beforeEach(() => {
  vi.clearAllMocks(); mocks.get.mockReset(); mocks.submit.mockReset();
  mocks.auth.user = { id: '41', role: 'client' }; mocks.auth.isImpersonating = false;
  mocks.get.mockResolvedValue(structuredClone(available));
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:photo'), revokeObjectURL: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Listing Studio free edits intake', () => {
  it('requires all three different photos and their edit choices', async () => {
    mount(); await screen.findByRole('form'); submit();
    expect(screen.getByRole('alert')).toHaveTextContent('Choose three photos and an edit for each');
    expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Upload photo 1'), { target: { files: [image(1)] } });
    fireEvent.change(screen.getByLabelText('Upload photo 2'), { target: { files: [image(1)] } });
    expect(screen.getByRole('alert')).toHaveTextContent('three different photos');
    expect(screen.getByText('1 of 3 photos selected')).toBeVisible();
  });

  it('rejects unsupported and oversized uploads without retaining the invalid file', async () => {
    mount(); await screen.findByRole('form');
    fireEvent.change(screen.getByLabelText('Upload photo 1'), { target: { files: [image(1, 'application/pdf')] } });
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG, PNG or WebP');
    const large = image(2); Object.defineProperty(large, 'size', { value: 10485761 });
    fireEvent.change(screen.getByLabelText('Upload photo 1'), { target: { files: [large] } });
    expect(screen.getByRole('alert')).toHaveTextContent('up to 10 MB');
    expect(screen.getByText('0 of 3 photos selected')).toBeVisible();
  });

  it('submits ordered photo edits once, then links to the support conversation', async () => {
    let complete!: (value: typeof claim) => void;
    mocks.submit.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    mount(); await fillPhotos();
    fireEvent.change(screen.getByLabelText('Additional notes (optional)'), { target: { value: 'Modern staging for photo 1.' } });
    submit(); submit();
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Submitting photos…' })).toBeDisabled();
    expect(mocks.submit.mock.calls[0][0]).toMatchObject({ edit_types: ['virtual_staging', 'decluttering', 'twilight'], notes: 'Modern staging for photo 1.' });
    complete(claim);
    expect(await screen.findByRole('link', { name: 'View request and photos' })).toHaveAttribute('href', claim.support_url);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('keeps the photos and request key when retrying after a lost response', async () => {
    mocks.submit.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(claim);
    mount(); await fillPhotos(); submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Check your connection');
    expect(screen.getByText('3 of 3 photos selected')).toBeVisible();
    submit();
    await screen.findByRole('link', { name: 'View request and photos' });
    expect(mocks.submit.mock.calls[1][0].request_key).toBe(mocks.submit.mock.calls[0][0].request_key);
  });

  it('uses refreshed support status after submission', async () => {
    mocks.submit.mockResolvedValueOnce(claim);
    mount(); await fillPhotos();
    mocks.get.mockResolvedValue({ ...available, eligible: false, reason: 'already_claimed', claim: { ...claim, status: 'resolved' } });
    submit();
    expect(await screen.findByText('Resolved')).toBeVisible();
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
  });

  it('uses a new request key after changing a rejected draft', async () => {
    mocks.submit.mockRejectedValue({ response: { status: 422, data: { errors: { 'attachments.0': ['Photo 1 cannot be read.'] } } } });
    mount(); await fillPhotos(); submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Photo 1 cannot be read');
    fireEvent.change(screen.getByLabelText('Upload photo 1'), { target: { files: [image(4)] } });
    submit();
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));
    expect(mocks.submit.mock.calls[1][0].request_key).not.toBe(mocks.submit.mock.calls[0][0].request_key);
  });

  it('shows an existing claim without exposing another submit form or an external stored URL', async () => {
    mocks.get.mockResolvedValue({ ...available, eligible: false, reason: 'already_claimed', claim: { ...claim, status: 'resolved', support_url: 'https://unsafe.example' } });
    mount();
    expect(await screen.findByRole('link', { name: 'View request and photos' })).toHaveAttribute('href', claim.support_url);
    expect(screen.getByText('Resolved')).toBeVisible();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('recovers the existing claim when another tab submits first', async () => {
    mocks.submit.mockRejectedValue({ response: { status: 409, data: { code: 'trial_already_claimed', data: claim } } });
    mount(); await fillPhotos(); submit();
    expect(await screen.findByRole('link', { name: 'View request and photos' })).toHaveAttribute('href', claim.support_url);
  });

  it('requires verified email and refreshes eligibility after verification', async () => {
    mocks.get.mockResolvedValueOnce({ ...available, eligible: false, email_verified: false, reason: 'email_not_verified' });
    mocks.resend.mockResolvedValue({ ok: true, message: 'Verification sent.' });
    mount(); await screen.findByRole('region', { name: 'Verify email for free edits' });
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send verification email' }));
    expect(mocks.resend).toHaveBeenCalledWith('/listing-studio/free-edits');
    await screen.findByText('Verification sent.');
    fireEvent.click(screen.getByRole('button', { name: 'I’ve verified my email' }));
    expect(await screen.findByRole('form')).toBeVisible();
  });

  it.each(['email_not_verified', 'email_verification_required'])('handles the server verification gate %s', async code => {
    mocks.get.mockRejectedValue({ response: { status: 403, data: { code } } });
    mount(); expect(await screen.findByRole('region', { name: 'Verify email for free edits' })).toBeVisible();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('keeps another account’s claim private when an email has already claimed', async () => {
    mocks.get.mockResolvedValue({ ...available, eligible: false, reason: 'email_already_claimed' });
    mount(); expect(await screen.findByText('This introductory offer has already been used')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'View request and photos' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Support' })).toHaveAttribute('href', '/messaging/email/inbox?tab=support');
  });

  it.each(['admin', 'salesRep', 'superadmin', 'editor', 'photographer'])('does not open client intake for %s', role => {
    mocks.auth.user.role = role; mount();
    expect(screen.getByText('Sign in with your client account')).toBeVisible();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('does not claim while impersonating a client', () => {
    mocks.auth.isImpersonating = true; mount();
    expect(screen.getByText('Sign in with your client account')).toBeVisible();
    expect(mocks.get).not.toHaveBeenCalled();
  });

});
