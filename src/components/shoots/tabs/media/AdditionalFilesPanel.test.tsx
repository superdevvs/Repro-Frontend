import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData, ShootServiceObject } from '@/types/shoots';
import { AdditionalFilesPanel } from './AdditionalFilesPanel';
import { RawUploadSection } from './RawUploadSection';

const mocks = vi.hoisted(() => ({
  user: { id: '1163', role: 'photographer' }, get: vi.fn(), upload: vi.fn(), complete: vi.fn(), toast: vi.fn(),
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/services/api', () => ({ apiClient: { get: mocks.get }, getApiHeaders: () => ({ Accept: 'application/json', 'Content-Type': 'application/json' }) }));
vi.mock('./uploadMediaRequest', async importOriginal => ({ ...(await importOriginal<object>()), uploadMediaRequest: mocks.upload }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/context/UploadContext', () => ({ useUpload: () => ({ trackUpload: vi.fn(), uploads: [] }) }));

const shoot = (intake = 'none'): ShootData => ({
  id: '2498', services: ['Comped Reshoot'],
  serviceObjects: [{ id: '88', shoot_service_id: '2635', name: 'Comped Reshoot', photographer_id: '1163',
    price: 0, quantity: 1, upload_intake_type: intake, uses_hdr_brackets: true, bracket_mode: 3, photo_count: null } as ShootServiceObject],
} as ShootData);
const wrapper = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const success = { ok: true, status: 200, responseText: JSON.stringify({ success_count: 1, error_count: 0, file_outcomes: [{ filename: 'reference.jpg', destination: 'additional', note: 'Additional file; not counted toward booked photos.' }] }) };

beforeEach(() => { mocks.user.role = 'photographer'; mocks.get.mockResolvedValue({ data: { files: [] } }); mocks.upload.mockResolvedValue(success); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('additional files on every assigned shoot', () => {
  it('accepts a file on a non-capture shoot without preparing a RAW batch', async () => {
    wrapper(<AdditionalFilesPanel shoot={shoot()} onUploadComplete={mocks.complete} />);
    fireEvent.click(screen.getByRole('button', { name: /Additional files/ }));
    fireEvent.change(screen.getByLabelText('Use additional files as'), { target: { value: 'keep' } });
    const input = screen.getByTestId('additional-files-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['image'], 'reference.jpg', { type: 'image/jpeg' })] } });
    expect(input.value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Upload additional files' }));
    await screen.findByText('Saved');
    const request = mocks.upload.mock.calls[0][0];
    expect(request.url).toMatch(/\/api\/shoots\/2498\/upload$/);
    expect(request.body.get('upload_type')).toBe('additional');
    expect(request.body.get('route_media')).toBe('0');
    expect(request.body.get('shoot_service_id')).toBeNull();
    expect(request.body.get('files[]').name).toBe('reference.jpg');
    expect(request.headers['Content-Type']).toBeUndefined();
    expect(screen.getByText(/not counted toward booked photos/)).toBeVisible();
    expect(mocks.complete).toHaveBeenCalledOnce();
  });

  it('retains the same file and idempotency key after an interrupted upload', async () => {
    mocks.upload.mockResolvedValueOnce({ ok: false, message: 'Connection interrupted' }).mockResolvedValueOnce(success);
    wrapper(<AdditionalFilesPanel shoot={shoot('photo')} onUploadComplete={mocks.complete} />);
    fireEvent.click(screen.getByRole('button', { name: /Additional files/ }));
    fireEvent.change(screen.getByLabelText('Additional file service'), { target: { value: '2635' } });
    fireEvent.change(screen.getByTestId('additional-files-input'), { target: { files: [new File(['zip'], 'frames.zip', { type: 'application/zip' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload additional files' }));
    const retry = await screen.findByRole('button', { name: 'Retry remaining files' });
    await waitFor(() => expect(retry).toBeEnabled());
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Additional file service')).toBeDisabled();
    fireEvent.click(retry);
    await screen.findByText('Saved');
    const first = mocks.upload.mock.calls[0][0].body;
    const second = mocks.upload.mock.calls[1][0].body;
    expect(first.get('idempotency_key')).toBe(second.get('idempotency_key'));
    expect(first.get('files[]')).toBe(second.get('files[]'));
    expect(second.get('shoot_service_id')).toBe('2635');
    expect(second.get('route_media')).toBe('1');
    expect(mocks.complete).toHaveBeenCalledOnce();
  });

  it('refreshes accepted media after a partial ZIP result while keeping its retry available', async () => {
    mocks.upload.mockResolvedValueOnce({ ok: true, status: 207, responseText: JSON.stringify({ success_count: 1, error_count: 1, errors: [{ message: 'One photo needs another attempt' }] }) });
    wrapper(<AdditionalFilesPanel shoot={shoot('photo')} onUploadComplete={mocks.complete} />);
    fireEvent.click(screen.getByRole('button', { name: /Additional files/ }));
    fireEvent.change(screen.getByTestId('additional-files-input'), { target: { files: [new File(['zip'], 'frames.zip', { type: 'application/zip' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload additional files' }));
    const retry = await screen.findByRole('button', { name: 'Retry remaining files' });
    await waitFor(() => expect(retry).toBeEnabled());
    expect(mocks.complete).toHaveBeenCalledOnce();
    expect(screen.getByText('One photo needs another attempt')).toBeVisible();
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('hands ZIP selection in the RAW picker to the dedicated intake without uploading or counting it', async () => {
    wrapper(<RawUploadSection shoot={shoot('photo')} onUploadComplete={mocks.complete} />);
    fireEvent.change(screen.getByTestId('raw-upload-input'), { target: { files: [new File(['zip'], 'camera.zip', { type: 'application/zip' })] } });
    await screen.findByText('camera.zip');
    expect(screen.getByRole('button', { name: 'Upload additional files' })).toBeVisible();
    expect(screen.queryByText('Selected Files (1)')).not.toBeInTheDocument();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('does not show the additional-files mutation panel to clients or editors', () => {
    mocks.user.role = 'client';
    const view = wrapper(<AdditionalFilesPanel shoot={shoot()} onUploadComplete={mocks.complete} />);
    expect(screen.queryByRole('region', { name: 'Additional files' })).not.toBeInTheDocument();
    mocks.user.role = 'editor'; view.rerender(<QueryClientProvider client={new QueryClient()}><AdditionalFilesPanel shoot={shoot()} onUploadComplete={mocks.complete} /></QueryClientProvider>);
    expect(screen.queryByRole('region', { name: 'Additional files' })).not.toBeInTheDocument();
  });
});
