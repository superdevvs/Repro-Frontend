import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MessageTemplate } from '@/types/messaging';
import { TemplateEditorDialog } from './TemplateEditorDialog';

const { previewTemplateMock } = vi.hoisted(() => ({
  previewTemplateMock: vi.fn(),
}));

vi.mock('@/services/messaging', () => ({
  createTemplate: vi.fn(),
  previewTemplate: previewTemplateMock,
  testSendTemplate: vi.fn(),
  updateTemplate: vi.fn(),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

const template: MessageTemplate = {
  id: 12,
  channel: 'EMAIL',
  name: 'Plain text preview',
  category: 'GENERAL',
  scope: 'SYSTEM',
  subject: 'Preview contrast check',
  body_html: '',
  body_text: 'This plain text must remain readable.',
  is_system: true,
  is_active: true,
  created_at: '2026-08-16T00:00:00Z',
  updated_at: '2026-08-16T00:00:00Z',
};

describe('TemplateEditorDialog preview contrast', () => {
  beforeEach(() => {
    previewTemplateMock.mockReset();
    previewTemplateMock.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove('dark');
  });

  it('uses email-safe fixed colors for a plain-text preview in dashboard dark mode', async () => {
    document.documentElement.classList.add('dark');
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <TemplateEditorDialog template={template} open onClose={vi.fn()} onSuccess={vi.fn()} />
      </QueryClientProvider>,
    );

    const previewTab = screen.getByRole('tab', { name: /preview/i });
    fireEvent.mouseDown(previewTab, { button: 0, ctrlKey: false });
    fireEvent.click(previewTab);

    const preview = await screen.findByText('This plain text must remain readable.');
    await waitFor(() => expect(preview).toHaveClass('preview-plain-text'));
    expect(getComputedStyle(preview).color).toBe('rgb(64, 88, 117)');
    expect(preview.closest('.preview-shell')).toBeInTheDocument();
  });

  it('normalizes inline colors while keeping custom call-to-action text white', async () => {
    document.documentElement.classList.add('dark');
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const inlineColorTemplate: MessageTemplate = {
      ...template,
      id: 13,
      name: 'Inline color preview',
      body_html: `
        <style>.invisible-copy { color: #ffffff !important; }</style>
        <div data-preview-test-surface style="background:#00141d; color:#ffffff !important">
          <p style="color:#ffffff !important">
            <span class="invisible-copy" style="color:rgb(255, 255, 255) !important">Inline copy stays visible.</span>
          </p>
        </div>
        <a href="https://example.com" style="background-color:#1463ff; color:#ffffff !important">
          <span style="color:#ffffff !important">Open Dashboard</span>
        </a>
      `,
      body_text: '',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <TemplateEditorDialog template={inlineColorTemplate} open onClose={vi.fn()} onSuccess={vi.fn()} />
      </QueryClientProvider>,
    );

    const previewTab = screen.getByRole('tab', { name: /preview/i });
    fireEvent.mouseDown(previewTab, { button: 0, ctrlKey: false });
    fireEvent.click(previewTab);

    const copy = await screen.findByText('Inline copy stays visible.');
    const cta = screen.getByRole('link', { name: 'Open Dashboard' });
    const unsafeSurface = copy.closest<HTMLElement>('[data-preview-test-surface]');

    expect(copy).not.toHaveStyle({ color: '#ffffff' });
    expect(getComputedStyle(copy).color).toBe('rgb(64, 88, 117)');
    expect(unsafeSurface?.style.background).toBe('');
    expect(unsafeSurface?.style.backgroundColor).toBe('');
    expect(cta).toHaveAttribute('data-email-preview-cta');
    expect(cta).toHaveStyle({ backgroundColor: '#1463ff' });
    expect(getComputedStyle(screen.getByText('Open Dashboard')).color).toBe('rgb(255, 255, 255)');
    expect(document.querySelector('.email-preview style')).not.toBeInTheDocument();
  });

  it('uses the server-rendered delivered HTML for an unchanged saved template', async () => {
    const deliveredHtml = '<!doctype html><html><body><p>Server-rendered delivery</p></body></html>';
    previewTemplateMock.mockResolvedValueOnce({
      subject: 'Rendered subject',
      body_html: deliveredHtml,
      body_text: 'Server-rendered delivery',
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <TemplateEditorDialog template={template} open onClose={vi.fn()} onSuccess={vi.fn()} />
      </QueryClientProvider>,
    );

    const previewTab = screen.getByRole('tab', { name: /preview/i });
    fireEvent.mouseDown(previewTab, { button: 0, ctrlKey: false });
    fireEvent.click(previewTab);

    const frame = await screen.findByTitle('Delivered email preview');
    expect(previewTemplateMock).toHaveBeenCalledWith(template.id);
    expect(frame).toHaveAttribute('sandbox', '');
    expect(frame).toHaveAttribute('srcdoc', deliveredHtml);
    expect(screen.getByText(/same server flow used/i)).toBeInTheDocument();

    const htmlTab = screen.getByRole('tab', { name: /html/i });
    fireEvent.mouseDown(htmlTab, { button: 0, ctrlKey: false });
    fireEvent.click(htmlTab);
    fireEvent.change(screen.getByPlaceholderText('Paste your HTML email template here...'), {
      target: { value: '<p>Unsaved draft delivery</p>' },
    });
    fireEvent.mouseDown(previewTab, { button: 0, ctrlKey: false });
    fireEvent.click(previewTab);

    expect(await screen.findByText('Unsaved draft delivery')).toBeInTheDocument();
    expect(screen.queryByTitle('Delivered email preview')).not.toBeInTheDocument();
    expect(previewTemplateMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/save changes to see the exact delivered rendering/i)).toBeInTheDocument();
  });
});
