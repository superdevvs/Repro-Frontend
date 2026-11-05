import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { sendShootToEditing } from '@/services/shootEditingDispatch';
import { useShootDetailsModalWorkflow } from './useShootDetailsModalWorkflow';
import { MEDIA_MARK_EVENT } from '../tabs/media/mark/mediaMarkEvents';

vi.mock('@/hooks/useShootMutationRefresh', () => ({ useShootMutationRefresh: () => vi.fn() }));
vi.mock('@/services/shootEditingDispatch', () => ({ sendShootToEditing: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('external editing handoff handler', () => {
  it('opens the shared Delivery review for a Scheduled shoot with zero files', async () => {
    const shoot = { id: '5930', status: 'scheduled', workflowStatus: 'scheduled', rawPhotoCount: 0, editedPhotoCount: 0, files: [], canFinalizeNoMedia: false } as ShootData;
    const open = vi.fn(); window.addEventListener(MEDIA_MARK_EVENT, open);
    const { result } = renderHook(() => useShootDetailsModalWorkflow({ shoot, isClient: false, canWithdrawRequestedShoot: false, canRequestCancellation: false, isWithinCancellationFeeWindow: false, refreshShoot: vi.fn().mockResolvedValue(shoot), setShoot: vi.fn(), updateShoot: vi.fn(), toast: vi.fn() }));
    await act(async () => result.current.handleFinalise());
    expect(open).toHaveBeenCalledOnce(); expect((open.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ shootId: '5930', initialTab: 'delivery' });
    window.removeEventListener(MEDIA_MARK_EVENT, open);
  });
  it.each(['scheduled', 'uploaded'])('opens the dispatch dialog for %s without dashboard RAWs', async status => {
    const shoot = { id: '123', status, workflowStatus: status, rawPhotoCount: 0, files: [] } as ShootData;
    const refreshShoot = vi.fn().mockResolvedValue(shoot);
    vi.mocked(sendShootToEditing).mockResolvedValue(true);
    const { result } = renderHook(() => useShootDetailsModalWorkflow({
      shoot, isClient: false, canWithdrawRequestedShoot: false, canRequestCancellation: false,
      isWithinCancellationFeeWindow: false, refreshShoot, setShoot: vi.fn(), updateShoot: vi.fn(), toast: vi.fn(),
    }));
    await act(async () => { await result.current.handleSendToEditing(); });
    expect(sendShootToEditing).toHaveBeenCalledWith('123');
    expect(refreshShoot).toHaveBeenCalledOnce();
  });

  it('does not dispatch a requested shoot before approval', async () => {
    const shoot = { id: '123', status: 'requested', workflowStatus: 'requested', rawPhotoCount: 0, files: [] } as ShootData;
    const toast = vi.fn();
    const { result } = renderHook(() => useShootDetailsModalWorkflow({
      shoot, isClient: false, canWithdrawRequestedShoot: false, canRequestCancellation: false,
      isWithinCancellationFeeWindow: false, refreshShoot: vi.fn().mockResolvedValue(shoot),
      setShoot: vi.fn(), updateShoot: vi.fn(), toast,
    }));
    await act(async () => { await result.current.handleSendToEditing(); });
    expect(sendShootToEditing).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Shoot must be in Scheduled or Uploaded status before sending to editing' }));
  });

  it('does not dispatch an already editing shoot even with a stale Uploaded status', async () => {
    const shoot = { id: '123', status: 'uploaded', workflowStatus: 'editing' } as ShootData;
    const { result } = renderHook(() => useShootDetailsModalWorkflow({
      shoot, isClient: false, canWithdrawRequestedShoot: false, canRequestCancellation: false,
      isWithinCancellationFeeWindow: false, refreshShoot: vi.fn().mockResolvedValue(shoot),
      setShoot: vi.fn(), updateShoot: vi.fn(), toast: vi.fn(),
    }));
    await act(async () => { await result.current.handleSendToEditing(); });
    expect(sendShootToEditing).not.toHaveBeenCalled();
  });
});
