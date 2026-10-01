import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RobbieKnowledgePanel from './RobbieKnowledgePanel';
import type { SupportArticle } from '@/services/supportKnowledge';

const mocks = vi.hoisted(() => ({ catalog: vi.fn(), article: vi.fn(), user: { id: '42', role: 'photographer' } }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/services/supportKnowledge', async (original) => ({ ...(await original<typeof import('@/services/supportKnowledge')>()), fetchSupportKnowledge: mocks.catalog, fetchSupportArticle: mocks.article }));

const guide: SupportArticle = { id: 'upload-photos', title: 'Upload shoot photos', summary: 'Send photos from your assigned shoot.', category: 'Uploads', roles: ['photographer'], steps: ['Open the assigned shoot.', 'Choose Upload raw files.'], troubleshooting: ['Retry only failed files.'], escalation: 'Send the team the shoot ID and failed filenames.', links: [{ label: 'Open shoots', url: '/shoot-history' }], updated_at: '2026-09-30' };
const response = { data: [guide], meta: { role: 'photographer', total: 13, categories: ['Uploads', 'Schedule'], pagination: { current_page: 1, per_page: 12, total: 13, last_page: 2 } } };
const onAsk = vi.fn();
function mount(path = '/chat-with-reproai?tab=help', client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={client}><RobbieKnowledgePanel onAsk={onAsk} /></QueryClientProvider></MemoryRouter>);
}

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.user = { id: '42', role: 'photographer' }; mocks.catalog.mockResolvedValue(response); mocks.article.mockResolvedValue(guide); });

describe('Robbie knowledge guides', () => {
  it('loads an article deep link and sends its support context to Robbie', async () => {
    const user = userEvent.setup();
    mount('/chat-with-reproai?tab=help&article=upload-photos');
    await screen.findByText('Choose Upload raw files.');
    expect(mocks.article).toHaveBeenCalledWith('upload-photos', expect.any(AbortSignal));
    expect(screen.getByRole('link', { name: 'Open shoots' })).toHaveAttribute('href', '/shoot-history');
    await user.click(screen.getByRole('button', { name: 'Ask Robbie about this' }));
    expect(onAsk).toHaveBeenCalledWith('Help me with: Upload shoot photos', { intent: 'support_faq', source: 'knowledge_base', knowledge_article_id: 'upload-photos' });
  });

  it('requests the next server page and resets to page one when searching', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('link', { name: /Upload shoot photos/ });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(mocks.catalog).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, per_page: 12 }), expect.any(AbortSignal)));
    await user.type(screen.getByRole('textbox', { name: 'Search help guides' }), 'failed upload');
    await waitFor(() => expect(mocks.catalog).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, query: 'failed upload' }), expect.any(AbortSignal)));
  });

  it('shows a recoverable unavailable state for role-forbidden deep links', async () => {
    mocks.article.mockRejectedValue(new Error('Forbidden'));
    mount('/chat-with-reproai?tab=help&article=admin-billing');
    expect(await screen.findByRole('heading', { name: 'Guide unavailable' })).toBeInTheDocument();
    expect(screen.queryByText('Choose Upload raw files.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All guides' })).toBeInTheDocument();
  });

  it('keeps safe support phone and email actions usable', async () => {
    mocks.article.mockResolvedValue({ ...guide, links: [{ label: 'Call support', url: 'tel:+12028681663' }, { label: 'Email support', url: 'mailto:contact@reprophotos.com' }, { label: 'Unsafe link', url: 'javascript:alert(1)' }] });
    mount('/chat-with-reproai?tab=help&article=upload-photos');
    expect(await screen.findByRole('link', { name: 'Call support' })).toHaveAttribute('href', 'tel:+12028681663');
    expect(screen.getByRole('link', { name: 'Email support' })).toHaveAttribute('href', 'mailto:contact@reprophotos.com');
    expect(screen.queryByRole('link', { name: 'Unsafe link' })).not.toBeInTheDocument();
  });

  it('does not reuse another user role’s cached catalog or article', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['support-knowledge', '1', 'admin', '', '', 1], { ...response, data: [{ ...guide, title: 'Private administrator guide' }] });
    client.setQueryData(['support-article', '1', 'admin', guide.id], { ...guide, title: 'Private administrator guide' });
    mount('/chat-with-reproai?tab=help&article=upload-photos', client);
    await screen.findByText('Choose Upload raw files.');
    expect(screen.queryByText('Private administrator guide')).not.toBeInTheDocument();
  });
});
