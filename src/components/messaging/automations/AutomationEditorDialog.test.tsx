import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { AutomationEditorDialog } from './AutomationEditorDialog';

vi.mock('@/services/messaging', () => ({
  getTemplates: vi.fn().mockResolvedValue([{ id: 4, name: 'Welcome email', channel: 'EMAIL', is_active: true }]),
  getEmailSettings: vi.fn().mockResolvedValue({ channels: [{ id: 1, display_name: 'Studio' }] }),
  createAutomation: vi.fn(),
  updateAutomation: vi.fn(),
}));

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AutomationEditorDialog automation={null} mode="create" open onClose={vi.fn()} onSuccess={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('automation sentence form', () => {
  afterEach(() => cleanup());

  it('keeps the sentence controls that save a real automation', async () => {
    renderDialog();

    expect(await screen.findByRole('heading', { name: 'New automation' })).toBeInTheDocument();
    expect(screen.getByLabelText('When')).toBeInTheDocument();
    expect(screen.getByLabelText('Sends')).toBeInTheDocument();
    expect(screen.getByText('Who')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByText('Only send if')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create and open workflow' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Message' })).toBeInTheDocument();
  });
});
