import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { SignaturesTab } from './SignaturesTab';

const get = vi.hoisted(() => vi.fn());
vi.mock('../../api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../api')>(),
  crmApi: { get },
}));

it('renders the API review description and approval action for a pending signature', async () => {
  get.mockImplementation(async (path: string) => {
    if (path === '/meta') return { can: { approve_signatures: true } };
    if (path === '/signatures/me') {
      return { latest: null, approved: null, defaults: { name: 'CRM Admin', email: 'admin@example.test' }, sender_domain: 'example.test' };
    }
    return {
      data: [{
        id: 1, user: { name: 'Test Rep' }, version: 1, sender_email: 'rep@example.test',
        submitted_at: '2026-11-24T12:00:00Z', html: '<p>Sales Representative</p>', change: 'New signature',
      }],
    };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><SignaturesTab /></QueryClientProvider>);
  expect(await screen.findByText('New signature')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
});
