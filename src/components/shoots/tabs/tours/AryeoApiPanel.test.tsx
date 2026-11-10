import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AryeoApiPanel } from './AryeoApiPanel';
import { apiClient } from '@/services/api';

vi.mock('@/services/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const fixture = (status = 'draft') => ({ destinations: [{ destination: { id: 'dest', workflow: 'ordinary', provider_job_id: 'job', listing_url: 'https://www.zillow.com/test', association_status: 'matched', on_hold: false, client_id: 3, recipients: [{ email: 'agent@example.com', provider_customer_id: 'customer' }] }, blockers: [], exports: [{ id: 'export', revision: 'a'.repeat(64), status, phase: 'review', blocker: status === 'outcome_unknown' ? 'outcome_unknown' : null, outcomes: { delivery: 'pending', media: 'awaiting_verification', hd: 'eligibility_unknown' }, snapshot: { company_id: 'company', unit_id: 42, legacy_listing_id: 'listing', listing_url: 'https://www.zillow.com/test', recipients: [{ email: 'agent@example.com', provider_customer_id: 'customer' }], consent: { intent: 'initial' }, release: { paid: false, release_override: true }, assets: [{ id: 1, filename: 'photo.jpg', type: 'photos', content: { sha256: 'b'.repeat(64), bytes: 12 } }], tours: [] }, operations: status === 'outcome_unknown' ? [{ id: 'op', operation_key: 'deliver', status: 'unknown', error_code: null }] : [], cases: [], evidence: [] }] }], installations: [] });

beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiClient.get).mockResolvedValue({ data: fixture() }); vi.mocked(apiClient.post).mockResolvedValue({ data: {} }); });
afterEach(cleanup);

describe('Aryeo API delivery review', () => {
  it('requires package and editing-window acknowledgment before approving the exact revision', async () => {
    render(<AryeoApiPanel shootId={9} unitId={42} />);
    const approve = await screen.findByRole('button', { name: 'Approve this revision' });
    expect(approve).toBeDisabled();
    expect(screen.getByText(/Explicit release override/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /^I reviewed this destination/ }));
    fireEvent.click(approve);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/integrations/aryeo/api/exports/export/actions/approve', expect.objectContaining({ revision: 'a'.repeat(64), no_external_editing_acknowledged: true })));
    expect(apiClient.get).toHaveBeenCalledWith('/shoots/9/aryeo-api', expect.objectContaining({ params: { unit_id: 42 } }));
  });

  it('offers reconciliation for an unknown outcome without an automatic retry button', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: fixture('outcome_unknown') });
    render(<AryeoApiPanel shootId={9} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reconcile provider outcome' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/integrations/aryeo/api/exports/export/actions/reconcile', {}));
    expect(screen.queryByRole('button', { name: 'Submit / resume approved work' })).not.toBeInTheDocument();
    expect(screen.getByText('media: awaiting verification')).toBeInTheDocument();
  });

  it('records evidence for a single feature and revision', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: fixture('delivered') });
    render(<AryeoApiPanel shootId={9} />);
    await screen.findByText(/Revision aaaaaaaaaa/);
    fireEvent.change(screen.getByLabelText('Verification feature'), { target: { value: 'branding' } });
    fireEvent.change(screen.getByLabelText('Verification evidence URL'), { target: { value: 'https://evidence.test/branding' } });
    fireEvent.submit(screen.getByLabelText('Verification evidence URL').closest('form')!);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/integrations/aryeo/api/exports/export/evidence', expect.objectContaining({ feature: 'branding', status: 'verified', revision: 'a'.repeat(64) })));
  });
});
