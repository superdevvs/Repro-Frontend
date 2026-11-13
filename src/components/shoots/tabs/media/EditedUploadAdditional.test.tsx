import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import type { MediaFile } from '@/hooks/useShootFiles';
import { EditedUploadSection } from './EditedUploadSection';
import { uploadMediaRequest } from './uploadMediaRequest';
import { resolveEligibleUploadServices } from './mediaUploadUtils';

const mocks = vi.hoisted(() => ({ role: 'admin', toast: vi.fn(), trackUpload: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/context/UploadContext', () => ({ useUpload: () => ({ trackUpload: mocks.trackUpload }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '101', role: mocks.role } }) }));
vi.mock('./uploadMediaRequest', async (original) => ({
  ...await original<typeof import('./uploadMediaRequest')>(), uploadMediaRequest: vi.fn(),
}));

const item = (id: number, overrides = {}) => ({
  id, shoot_service_id: id, name: `Photos ${id}`, upload_intake_type: 'photo',
  requires_editing: true, editor_id: '101', photographer_id: '101',
  workflow_status: 'delivered', delivery_status: 'delivered', ...overrides,
});
const shoot = {
  id: '5985', status: 'delivered', workflowStatus: 'delivered', expectedFinalCount: 26,
  services: [], serviceItems: [item(71), item(72)],
} as unknown as ShootData;

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('additional edited files after delivery', () => {
  it.each(['admin', 'superadmin', 'editing_manager'])('lets %s upload above the required count to a selected delivered service', async (role) => {
    mocks.role = role;
    const complete = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const editedFiles = Array.from({ length: 28 }, (_, index) => ({
      id: String(index + 1), filename: `delivered-${index}.jpg`, shoot_service_id: 71,
      media_type: 'edited', workflow_stage: 'verified',
    })) as MediaFile[];
    render(<QueryClientProvider client={client}>
      <EditedUploadSection shoot={shoot} editedFiles={editedFiles} onUploadComplete={complete} />
    </QueryClientProvider>);
    expect(screen.getByText('26')).toBeVisible();
    expect(screen.getByText('28')).toBeVisible();
    expect(screen.getByText(/use Finalize shoot to review and release the added files/)).toBeVisible();
    expect(screen.queryByText(/No outstanding booked service/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Service for edited upload batch' }), { target: { value: '72' } });
    fireEvent.change(screen.getByTestId('edited-upload-input'), {
      target: { files: [new File(['extra photo'], 'additional.jpg', { type: 'image/jpeg' })] },
    });
    vi.mocked(uploadMediaRequest).mockResolvedValue({ ok: true, status: 200, responseText: JSON.stringify({
      success_count: 1, uploaded_files: [{ id: 29, filename: 'additional.jpg', upload_type: 'edited', shoot_service_id: 72 }],
    }) });
    fireEvent.click(screen.getByRole('button', { name: 'Upload Edited Files' }));
    expect(mocks.trackUpload).toHaveBeenCalledOnce();
    await act(async () => { await mocks.trackUpload.mock.calls[0][0].uploadFn(vi.fn(), new AbortController().signal); });
    const body = vi.mocked(uploadMediaRequest).mock.calls[0][0].body as FormData;
    expect(body.get('shoot_service_id')).toBe('72');
    expect(body.get('upload_type')).toBe('edited');
    expect(complete).toHaveBeenCalledOnce();
  });

  it.each(['editor', 'photographer', 'client', 'salesRep'])('keeps the closed-service picker restricted for %s', (role) => {
    expect(resolveEligibleUploadServices(shoot, { id: '101', role }, 'edited')).toEqual([]);
  });

  it.each(['admin', 'superadmin', 'editing_manager'])('keeps RAW intake and invalid work rows excluded for %s', (role) => {
    const actor = { id: '101', role };
    expect(resolveEligibleUploadServices(shoot, actor, 'raw')).toEqual([]);
    const invalid = { ...shoot, serviceItems: [
      item(73, { workflow_status: 'cancelled' }), item(74, { delivery_status: 'cancelled' }),
      item(75, { is_deliverable: false }), item(76, { is_invoice_adjustment: true }),
    ] } as unknown as ShootData;
    expect(resolveEligibleUploadServices(invalid, actor, 'edited')).toEqual([]);
  });
});
