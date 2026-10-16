import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData, ShootServiceObject } from '@/types/shoots';
import { RawUploadSection } from './RawUploadSection';
import { rawUploadBlockReason } from './rawUploadAvailability';

const mocks = vi.hoisted(() => ({ toast: vi.fn(), trackUpload: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/context/UploadContext', () => ({ useUpload: () => ({ trackUpload: mocks.trackUpload, uploads: [] }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '1163', role: 'photographer' } }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const actor = { id: '1163', role: 'photographer' };
const shoot = (intake: string, photographer = '1163'): ShootData => ({
  id: '2498', services: ['Comped Reshoot'],
  serviceObjects: [{ id: '88', shoot_service_id: '2635', name: 'Comped Reshoot', photographer_id: photographer,
    price: 0, quantity: 1, upload_intake_type: intake, uses_hdr_brackets: true, bracket_mode: 3, photo_count: null } as ShootServiceObject],
} as ShootData);
const panel = (data: ShootData) => <QueryClientProvider client={new QueryClient()}><RawUploadSection shoot={data} onUploadComplete={vi.fn()} /></QueryClientProvider>;

describe('raw upload service availability', () => {
  it('explains a non-capture booking before offering the file picker', () => {
    render(panel(shoot('none')));
    expect(screen.getByRole('alert')).toHaveTextContent('No assigned service on this shoot accepts photo or video uploads');
    expect(screen.queryByTestId('raw-upload-input')).not.toBeInTheDocument();
    expect(mocks.trackUpload).not.toHaveBeenCalled();
  });

  it('lets the assigned photographer stage a free Comped Reshoot photo', () => {
    render(panel(shoot('photo')));
    fireEvent.change(screen.getByTestId('raw-upload-input'), { target: { files: [new File(['raw'], 'frame.CR3')] } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Selected Files (1)')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirm & upload' })).toBeEnabled();
  });

  it('blocks stale assignments and rejects video on a photo-only service', () => {
    expect(rawUploadBlockReason(shoot('photo', '999'), actor)).toMatch(/No assigned service/);
    expect(rawUploadBlockReason(shoot('photo'), actor, [new File(['video'], 'clip.mp4', { type: 'video/mp4' })])).toMatch(/accepts video uploads/);
    expect(rawUploadBlockReason(shoot('video'), actor)).toBeNull();
    expect(rawUploadBlockReason({ id: 'old', services: [] } as ShootData, actor)).toBeNull();
  });
});
