import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClientShootRecord } from '@/utils/dashboardDerivedUtils';
import { updateShootAccessInfo } from '@/services/shoots';
import { ClientAccessInfoDialog } from './ClientAccessInfoDialog';

vi.mock('@/services/shoots', () => ({ updateShootAccessInfo: vi.fn().mockResolvedValue({}) }));
vi.mock('@/hooks/useShootMutationRefresh', () => ({ useShootMutationRefresh: () => vi.fn() }));
vi.mock('@/lib/sonner-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const record = (presenceOption?: string) => ({
  data: { id: '123', propertyDetails: presenceOption ? { presenceOption } : {} },
  summary: { addressLine: '10 Example Street' },
}) as unknown as ClientShootRecord;

describe('client access confirmation', () => {
  it('requires an actual choice for an existing shoot and saves Self after it is selected', async () => {
    const query = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const onOpenChange = vi.fn();
    const view = render(<QueryClientProvider client={query}>
      <ClientAccessInfoDialog open onOpenChange={onOpenChange} record={record()} />
    </QueryClientProvider>);
    const self = screen.getByRole('radio', { name: 'Self / client' });
    expect(self).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Save access info' }));
    expect(updateShootAccessInfo).not.toHaveBeenCalled();
    fireEvent.click(self);
    fireEvent.click(self);
    expect(self).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Save access info' }));
    await waitFor(() => expect(updateShootAccessInfo).toHaveBeenCalledWith('123', expect.objectContaining({ presenceOption: 'self' })));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    view.rerender(<QueryClientProvider client={query}>
      <ClientAccessInfoDialog open onOpenChange={onOpenChange} record={record('self')} />
    </QueryClientProvider>);
    expect(screen.getByRole('radio', { name: 'Self / client' })).toBeChecked();
  });

  it('keeps exactly one access method selected when changing to a lockbox', () => {
    const query = new QueryClient();
    render(<QueryClientProvider client={query}>
      <ClientAccessInfoDialog open onOpenChange={vi.fn()} record={record('self')} />
    </QueryClientProvider>);
    fireEvent.click(screen.getByRole('radio', { name: 'Lockbox' }));
    expect(screen.getByRole('radio', { name: 'Lockbox' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Self / client' })).not.toBeChecked();
    expect(screen.getAllByRole('radio').filter((item) => item.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    expect(screen.getByLabelText('Lockbox / gate code')).toBeInTheDocument();
  });
});
