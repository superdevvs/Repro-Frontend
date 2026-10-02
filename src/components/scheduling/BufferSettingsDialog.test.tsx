import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BufferSettingsDialog } from './BufferSettingsDialog';
import { bufferValidation, type BufferSettingsResponse } from './bufferSettings';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const data: BufferSettingsResponse = {
  version: 'a'.repeat(64),
  settings: { mode: 'google', fixed_minutes: 15, minimum_minutes: 15, allowance_minutes: 5, fallback: 'mileage', near_minutes: 15, medium_minutes: 30, far_minutes: 45 },
  google: { key_configured: false, budget: { used_elements: 7600, limit_elements: 10000, usage_percent: 76, estimated_cost_usd: 76, budget_usd: 100, exhausted: false } },
};

describe('buffer settings dialog', () => {
  it('loads the active policy, switches mode and only writes after an explicit save', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data })));
    vi.stubGlobal('fetch', fetch);
    const close = vi.fn();
    render(<BufferSettingsDialog open onOpenChange={close} />);
    await screen.findByText(/Setup needed/);
    expect(screen.getByText('76% of the Routes allowance used.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save buffer settings' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Fixed gap/ }));
    fireEvent.change(screen.getByLabelText('Gap between shoots'), { target: { value: '30' } });
    expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ data })));
    fireEvent.click(screen.getByRole('button', { name: 'Save buffer settings' }));
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
    const [, options] = fetch.mock.calls[1];
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toMatchObject({ mode: 'fixed', fixed_minutes: 30, version: data.version });
  });

  it('rejects invalid minutes, keeps failed saves open and preserves the draft', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Buffer settings changed. Reopen this dialog.' }), { status: 409 }));
    vi.stubGlobal('fetch', fetch);
    const close = vi.fn(); render(<BufferSettingsDialog open onOpenChange={close} />);
    await screen.findByLabelText('Minimum gap');
    fireEvent.change(screen.getByLabelText('Minimum gap'), { target: { value: '17' } });
    expect(screen.getByRole('alert')).toHaveTextContent('5-minute steps');
    expect(screen.getByRole('button', { name: 'Save buffer settings' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Minimum gap'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save buffer settings' }));
    await screen.findByText('Buffer settings changed. Reopen this dialog.');
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Minimum gap')).toHaveValue(30);
  });

  it('retries load failures and never saves on cancel', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data })));
    vi.stubGlobal('fetch', fetch);
    const close = vi.fn(); render(<BufferSettingsDialog open onOpenChange={close} />);
    await screen.findByText('Network unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByLabelText('Minimum gap');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(close).toHaveBeenCalledWith(false);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.every(([, options]) => options.method === 'GET')).toBe(true);
  });

  it('validates ascending mileage bands and the allowance range', () => {
    expect(bufferValidation({ ...data.settings, near_minutes: 45 })).toMatch(/Longer-distance/);
    expect(bufferValidation({ ...data.settings, allowance_minutes: 35 })).toMatch(/allowance/);
    expect(bufferValidation({ ...data.settings, allowance_minutes: 0 })).toBeNull();
  });
});
