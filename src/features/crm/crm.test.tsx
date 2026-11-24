import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrmMeta, Proposal } from './types';

const get = vi.fn();
const post = vi.fn();
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return {
    ...actual,
    crmApi: {
      get: (...args: unknown[]) => get(...args),
      post: (...args: unknown[]) => post(...args),
      patch: (...args: unknown[]) => post(...args),
      put: (...args: unknown[]) => post(...args),
      upload: (...args: unknown[]) => post(...args),
    },
  };
});

const meta = (can: Partial<CrmMeta['can']> = {}): CrmMeta => ({
  me: { id: 7, name: 'Maya Torres', initials: 'MT' },
  can: {
    view_all: false, create: true, update: true, assign: false, import: false, manage_event_types: false, enrol_drips: true, manage_drips: false,
    create_campaigns: true, approve_campaigns: false, approve_templates: false, approve_signatures: false, approve_quotes: false,
    recruiting: false, recruiting_manage: false, recruiting_documents: false, ...can,
  },
  counts: { unassigned: 3, duplicate_attempts: 1, unread_notices: 0, follow_ups_due: 2 },
  reps: [{ id: 7, name: 'Maya Torres' }],
  stages: [{ key: 'outreach', label: 'Outreach' }],
  pipeline_stages: ['outreach', 'inquiry', 'estimate', 'booked'],
  segments: [{ key: 'residential', label: 'Residential' }, { key: 'commercial', label: 'Commercial' }],
  client_types: [], lost_reasons: [], lead_sources: [], markets: [],
  settings: { first_contact_business_days: 1, quote_discount_approval_percent: 10 },
});

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('CRM sidebar', () => {
  it('shows a rep CRM sections only, with the way back to the Dashboard', async () => {
    get.mockResolvedValue(meta());
    const { CrmSidebar } = await import('./layout/CrmSidebar');
    wrap(<CrmSidebar />);
    expect(await screen.findByRole('link', { name: /follow-ups/i })).toBeInTheDocument();
    const homeLink = screen.getByRole('link', { name: 'R/E Pro CRM home' });
    expect(homeLink).toHaveAttribute('href', '/crm');
    expect(homeLink).toHaveTextContent('R/E Pro CRM');
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: /unassigned/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /recruiting/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /accounting/i })).not.toBeInTheDocument();
  });

  it('adds the admin sections when the permissions allow them', async () => {
    get.mockResolvedValue(meta({ assign: true, view_all: true, recruiting: true }));
    const { CrmSidebar } = await import('./layout/CrmSidebar');
    wrap(<CrmSidebar />);
    expect(await screen.findByRole('link', { name: /unassigned/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /recruiting/i })).toBeInTheDocument();
  });
});

describe('Add contact', () => {
  it('tells a rep about a duplicate without revealing whose it is, and blocks saving', async () => {
    get.mockResolvedValue(meta());
    post.mockRejectedValue({ response: { status: 409, data: {
      message: 'This contact is already in the CRM. You can’t add them again. An admin has been notified and will follow up with you.',
      duplicate: { blocked: true, reason: 'email', admin_notified: true, overridable: false },
    } } });
    const { ContactFormDialog } = await import('./components/ContactFormDialog');
    wrap(<ContactFormDialog open onOpenChange={() => undefined} />);

    fireEvent.change(await screen.findByLabelText(/full name/i), { target: { value: 'Dana Whitfield' } });
    fireEvent.change(screen.getByLabelText(/^segment/i), { target: { value: 'residential' } });
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'dana@whitfieldrowe.com' } });
    fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

    expect(await screen.findByText(/an admin has been notified/i)).toBeInTheDocument();
    expect(screen.queryByText(/matches/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add contact/i })).toBeDisabled();
    expect(post).toHaveBeenCalledWith('/contacts', expect.objectContaining({ name: 'Dana Whitfield', segment: 'residential' }));
    expect(post.mock.calls[0][1]).not.toHaveProperty('assigned_rep_id');
  });
});

describe('Robbie proposals', () => {
  const proposal: Proposal = {
    id: 41, kind: 'note', summary: 'Add a note to Dana Whitfield', payload: { body: 'Prefers texts after 4pm' }, status: 'pending',
    contact: { id: 5, name: 'Dana Whitfield', company: null }, editable: ['body'], result: null, expires_at: null,
  };

  it('does nothing until confirmed, then sends the edit', async () => {
    post.mockResolvedValue({ proposal: { ...proposal, status: 'confirmed' } });
    const { ProposalCard } = await import('./robbie/ProposalCard');
    wrap(<ProposalCard proposal={proposal} />);
    expect(post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Prefers texts after 4:30pm' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/robbie/proposals/41/confirm', { edits: { body: 'Prefers texts after 4:30pm' } }));
    expect(await screen.findByText(/logged via robbie/i)).toBeInTheDocument();
  });
});

describe('feature flag', () => {
  it('keeps the CRM dark unless the build turns it on', async () => {
    const { CRM_ENABLED } = await import('./featureFlag');
    expect(CRM_ENABLED).toBe(['1', 'true', 'yes', 'on'].includes(String(import.meta.env.VITE_CRM_ENABLED ?? 'false').toLowerCase()));
  });
});
