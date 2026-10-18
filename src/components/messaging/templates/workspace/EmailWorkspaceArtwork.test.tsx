import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailWorkspaceArtwork } from './EmailWorkspaceArtwork';
import { newSection } from './emailWorkspaceModel';
import type { EmailTemplateSection } from '@/types/emailTemplateWorkspace';

const mocks = vi.hoisted(() => ({ generate: vi.fn(), status: vi.fn(), error: vi.fn() }));
vi.mock('@/services/emailTemplateWorkspace', () => ({ generateEmailArtwork: mocks.generate, getEmailArtwork: mocks.status }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 7 } }) }));
vi.mock('@/lib/sonner-toast', () => ({ toast: { error: mocks.error } }));
function setup(target?: EmailTemplateSection) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onUse = vi.fn();
  return { ...render(<QueryClientProvider client={queryClient}><EmailWorkspaceArtwork onUse={onUse} target={target}/></QueryClientProvider>), onUse };
}
describe('queued email artwork', () => {
  beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });
  afterEach(cleanup);
  it('retries an uncertain start with the same generation ID, then lets the user insert the result', async () => {
    mocks.generate.mockRejectedValueOnce(new Error('Network interrupted')).mockImplementationOnce(async request => ({ ...request, status: 'queued', url: null, error: null }));
    mocks.status.mockImplementation(async id => ({ id, status: 'completed', kind: 'icon', url: 'https://example.com/lens.png', error: null }));
    const view = setup();
    fireEvent.change(screen.getByLabelText('Artwork type'), { target: { value: 'icon' } });
    fireEvent.change(screen.getByLabelText('Describe the image'), { target: { value: 'A camera lens' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate artwork' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Retry this request' }));
    const insert = await screen.findByRole('button', { name: 'Use this image' });
    expect(mocks.generate.mock.calls[0][0].id).toBe(mocks.generate.mock.calls[1][0].id);
    expect(mocks.generate.mock.calls[1][0].kind).toBe('icon');
    expect(view.onUse).not.toHaveBeenCalled();
    fireEvent.click(insert);
    expect(view.onUse).toHaveBeenCalledWith('https://example.com/lens.png', 'A camera lens', 'icon');
  });
  it('restores a pending request and checks status without starting another paid generation', async () => {
    localStorage.setItem('repro-email-artwork:7', JSON.stringify({ request: { id: 'saved-request', kind: 'illustration', prompt: 'Camera equipment' }, initial: { id: 'saved-request', kind: 'illustration', status: 'queued', url: null, error: null } }));
    mocks.status.mockResolvedValue({ id: 'saved-request', kind: 'illustration', status: 'completed', url: 'https://example.com/equipment.png', error: null });
    setup();
    await screen.findByRole('button', { name: 'Use this image' });
    expect(mocks.status).toHaveBeenCalledWith('saved-request');
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('generates a wide header by default and explicitly places it as a header', async () => {
    mocks.generate.mockImplementation(async request => ({ ...request, status: 'completed', url: 'https://example.com/header.png', error: null }));
    mocks.status.mockImplementation(async id => ({ id, kind: 'header', status: 'completed', url: 'https://example.com/header.png', error: null }));
    const view = setup();
    expect(screen.getByLabelText('Artwork type')).toHaveValue('header');
    fireEvent.change(screen.getByLabelText('Describe the image'), { target: { value: 'A wide blue glass camera and homes scene' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate artwork' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use as header image' }));
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'header' }));
    expect(view.onUse).toHaveBeenCalledWith('https://example.com/header.png', 'A wide blue glass camera and homes scene', 'header');
  });
  it('prefills an existing feature icon so it can be regenerated as a transparent PNG', () => {
    setup({ ...newSection('feature'), alt: 'A blue glass gift box', image_url: 'https://example.com/opaque.png' });
    expect(screen.getByLabelText('Artwork type')).toHaveValue('icon');
    expect(screen.getByLabelText('Describe the image')).toHaveValue('A blue glass gift box');
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
