import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { approveEditingReview, finalizeEditedUploadQueue } from '@/services/shootMediaService';
import { useShootDetailsModalWorkflow } from './useShootDetailsModalWorkflow';

vi.mock('@/services/shootMediaService', () => ({
  approveEditingReview: vi.fn(), finalizeEditedUploadQueue: vi.fn(), finalizeRawUploadQueue: vi.fn(),
}));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({}) }));
vi.mock('@/hooks/useShootMutationRefresh', () => ({ useShootMutationRefresh: () => vi.fn() }));
vi.mock('@/components/shoots/finalize/finalizeShootWithProgressToast', () => ({ finalizeShootWithProgressToast: vi.fn() }));

const shoot = { id: '100', status: 'in_review', workflowStatus: 'in_review' } as ShootData;
const options = () => ({
  shoot, isClient: false, canWithdrawRequestedShoot: false, canRequestCancellation: false,
  isWithinCancellationFeeWindow: false, refreshShoot: vi.fn().mockResolvedValue(shoot),
  setShoot: vi.fn(), updateShoot: vi.fn(), onShootUpdate: vi.fn(), toast: vi.fn(),
});
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('editing review workflow', () => {
  it('refreshes the shoot and parent after approval and stays busy until the refresh finishes', async () => {
    vi.mocked(approveEditingReview).mockResolvedValue({ workflow_status_changed: true, shoot_status: 'ready' });
    const props = options();
    let finishRefresh!: (value: ShootData) => void;
    props.refreshShoot.mockImplementation(() => new Promise<ShootData>(resolve => { finishRefresh = resolve; }));
    const { result } = renderHook(() => useShootDetailsModalWorkflow(props));
    let approval!: Promise<void>;
    act(() => { approval = result.current.handleApproveEditingReview(); });
    await waitFor(() => expect(props.refreshShoot).toHaveBeenCalledOnce());
    expect(result.current.isApprovingEditingReview).toBe(true);
    expect(props.onShootUpdate).not.toHaveBeenCalled();
    await act(async () => {
      finishRefresh({ ...shoot, status: 'ready', workflowStatus: 'ready' });
      await approval;
    });
    expect(result.current.isApprovingEditingReview).toBe(false);
    expect(props.onShootUpdate).toHaveBeenCalledOnce();
    expect(approveEditingReview).toHaveBeenCalledOnce();
  });

  it.each([
    ['review', 'Shoot moved to In Review for approval.'],
    ['ready', 'Shoot moved to Ready for finalization.'],
    [undefined, 'Edited files submitted.'],
  ])('uses actual edited submission status %s and refreshes before closing confirmation', async (status, description) => {
    vi.mocked(finalizeEditedUploadQueue).mockResolvedValue({ workflow_status_changed: true, shoot_status: status });
    const props = options();
    const { result } = renderHook(() => useShootDetailsModalWorkflow(props));
    act(() => result.current.handleSubmitEdits());
    act(() => result.current.confirmSubmit());
    await waitFor(() => expect(result.current.submitConfirm).toBeNull());
    expect(props.toast).toHaveBeenCalledWith({ title: 'Edited files submitted', description });
    expect(props.refreshShoot).toHaveBeenCalledOnce();
    expect(props.onShootUpdate).toHaveBeenCalledOnce();
  });
});
