import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { sendShootToEditing } from '@/services/shootEditingDispatch';
import { useShootDetailsModalWorkflow } from './useShootDetailsModalWorkflow';

vi.mock('@/hooks/useShootMutationRefresh', () => ({ useShootMutationRefresh: () => vi.fn() }));
vi.mock('@/services/shootEditingDispatch', () => ({ sendShootToEditing: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('external editing handoff handler', () => {
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
