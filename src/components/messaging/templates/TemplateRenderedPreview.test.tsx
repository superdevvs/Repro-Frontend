import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplateRenderedPreview } from './TemplateRenderedPreview';
import { newSection, startingEmail } from './workspace/emailWorkspaceModel';
import { artworkRenderDraft, emailArtworkPreview, type EmailArtworkStates } from './workspace/emailArtworkPreview';

const preview = vi.hoisted(() => vi.fn());
vi.mock('@/services/messaging', () => ({ previewTemplate: preview }));

const draft = startingEmail('blank');
draft.subject = 'Your invoice guide';
draft.editor_document_json.sections = [
  { ...newSection('hero'), id: 'header', heading: 'Review your invoice', artwork_id: 'wide', alt: 'Wide invoice scene', image_url: 'https://example.com/old.png' },
  { ...newSection('feature'), id: 'feature', heading: 'Submit from Earnings', artwork_id: 'icon', alt: 'Invoice icon', image_url: 'https://example.com/old.png' },
];
const html = '<html><body><h1>Review your invoice</h1><div data-email-section="header"><img src="https://example.com/old.png"></div><div data-email-section="feature"><img src="https://example.com/old.png"></div></body></html>';
const loading: EmailArtworkStates = { wide: { status: 'loading', kind: 'header' }, icon: { status: 'loading', kind: 'icon' } };
const props = { compact: true, templateId: null, draft, enabled: true, theme: 'dark' as const, viewport: 'desktop' as const, onThemeChange: vi.fn(), onViewportChange: vi.fn() };

describe('progressive email preview', () => {
  beforeEach(() => { preview.mockReset(); });
  afterEach(cleanup);

  it('shows the ready copy immediately while the initial email render is pending', async () => {
    preview.mockReturnValue(new Promise(() => {}));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><TemplateRenderedPreview {...props} artwork={loading} fallback={<p>Your invoice guide is ready to edit</p>}/></QueryClientProvider>);
    expect(screen.getByText('Your invoice guide is ready to edit')).toBeInTheDocument();
    await waitFor(() => expect(preview).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Rendering email preview…')).not.toBeInTheDocument();
  });

  it('fills each rendered image slot independently without refetching or blanking the email', async () => {
    preview.mockResolvedValue({ html, subject: draft.subject });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = (artwork: EmailArtworkStates) => <QueryClientProvider client={client}><TemplateRenderedPreview {...props} artwork={artwork}/></QueryClientProvider>;
    const { rerender } = render(view(loading));
    const frame = await screen.findByTitle('Delivered email preview');
    expect(frame.getAttribute('srcdoc')).toContain('Creating wide header');
    expect(frame.getAttribute('srcdoc')).toContain('Creating icon');
    expect(frame.getAttribute('srcdoc')).toContain('aspect-ratio: 12 / 5');
    const oneReady: EmailArtworkStates = { ...loading, wide: { kind: 'header', status: 'ready', url: 'https://example.com/header.png' } };
    rerender(view(oneReady));
    expect(screen.getByTitle('Delivered email preview')).toBe(frame);
    expect(frame.getAttribute('srcdoc')).toContain('https://example.com/header.png');
    expect(frame.getAttribute('srcdoc')).toContain('Creating icon');
    expect(frame.getAttribute('srcdoc')).not.toContain('Creating wide header');
    rerender(view({ ...oneReady, icon: { kind: 'icon', status: 'ready', url: 'https://example.com/icon.png' } }));
    expect(frame.getAttribute('srcdoc')).toContain('https://example.com/icon.png');
    expect(frame.getAttribute('srcdoc')).not.toContain('data-artwork-loading');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    expect(preview).toHaveBeenCalledTimes(1);
    expect(draft.editor_document_json.sections[0].image_url).toBe('https://example.com/old.png');
    expect(frame).toHaveAttribute('sandbox', '');
  });

  it('retains the visible preview during a background refresh', async () => {
    preview.mockResolvedValueOnce({ html });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><TemplateRenderedPreview {...props}/></QueryClientProvider>);
    const frame = await screen.findByTitle('Delivered email preview');
    preview.mockReturnValue(new Promise(() => {}));
    await act(async () => { void client.invalidateQueries({ queryKey: ['template-editor-preview'] }); });
    expect(screen.getByTitle('Delivered email preview')).toBe(frame);
    expect(screen.queryByText('Rendering email preview…')).not.toBeInTheDocument();
  });

  it('keeps failures and placeholders local to their image slot and out of saved content', () => {
    const failed: EmailArtworkStates = { ...loading, icon: { kind: 'icon', status: 'failed' } };
    const result = emailArtworkPreview(html, draft, failed, 'light');
    const doc = new DOMParser().parseFromString(result, 'text/html');
    expect(doc.querySelector('[data-email-section="header"] [role="status"]')?.textContent).toContain('Creating wide header');
    expect(doc.querySelector('[data-email-section="feature"] img')?.getAttribute('src')).toBe('https://example.com/old.png');
    expect(artworkRenderDraft(draft, loading)).toEqual(artworkRenderDraft(draft, { wide: { kind: 'header', status: 'ready', url: 'https://example.com/new.png' }, icon: failed.icon }));
    expect(draft.editor_document_json.sections[0].image_url).toBe('https://example.com/old.png');
  });
});
