import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import CampaignPage from './CampaignPage';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('../../api', async (importOriginal) => ({ ...await importOriginal<typeof import('../../api')>(), crmApi: api }));
it('requires fresh review of edited approved content before delivery', async () => {
  const campaign = { id: 22, name: 'Spring', status: 'approved', owner: { id: 4, name: 'Rep' }, subject: 'Original subject', body_html: '<p>Original body</p>',
    template: { name: 'Campaign' }, audience: {}, audience_summary: { total: 9, reachable: 7, opted_out: 2, bounced: 0 }, rendered: { html: '<p>Preview</p>' } };
  api.get.mockImplementation(async (url: string) => url === '/meta' ? { me: { id: 4 }, can: { approve_campaigns: false }, stages: [], reps: [], segments: [], markets: [], client_types: [] } : { campaign });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={['/crm/email/campaigns/22']}><Routes>
    <Route path="/crm/email/campaigns/:id" element={<CampaignPage />} />
  </Routes></MemoryRouter></QueryClientProvider>);
  const send = await screen.findByRole('button', { name: 'Send now to 7' });
  expect(send).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Edited subject' } });
  expect(send).toBeDisabled();
  fireEvent.click(send);
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});
