import { Dispatch, SetStateAction, useState } from 'react';
import { ShootData } from '@/types/shoots';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import {
  finalizeEditedUploadQueue,
  finalizeRawUploadQueue,
} from '@/services/dropboxMediaService';
import { blurActiveElement } from '../dialogFocusUtils';

type PendingAction = 'hold' | 'cancel' | null;

interface ToastApi {
  toast: (options: {
    title: string;
    description: string;
    variant?: 'default' | 'destructive';
  }) => void;
}

interface UseShootDetailsModalWorkflowOptions {
  shoot: ShootData | null;
  isClient: boolean;
  canWithdrawRequestedShoot: boolean;
  canRequestCancellation: boolean;
  isWithinCancellationFeeWindow: boolean;
  refreshShoot: () => Promise<ShootData | null>;
  setShoot: Dispatch<SetStateAction<ShootData | null>>;
  updateShoot: (id: string, data: ShootData, options?: { skipApi?: boolean }) => void;
  onShootUpdate?: () => void;
  toast: ToastApi['toast'];
}

export function useShootDetailsModalWorkflow({
  shoot,
  isClient,
  canWithdrawRequestedShoot,
  canRequestCancellation,
  isWithinCancellationFeeWindow,
  refreshShoot,
  setShoot,
  updateShoot,
  onShootUpdate,
  toast,
}: UseShootDetailsModalWorkflowOptions) {
  const [isOnHoldDialogOpen, setIsOnHoldDialogOpen] = useState(false);
  const [onHoldReason, setOnHoldReason] = useState('');
  const [isCancellationFeeDialogOpen, setIsCancellationFeeDialogOpen] = useState(false);
  const [shouldAddCancellationFee, setShouldAddCancellationFee] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isCancelShootDialogOpen, setIsCancelShootDialogOpen] = useState(false);
  const [cancelShootReason, setCancelShootReason] = useState('');
  const [cancelWithoutNotification, setCancelWithoutNotification] = useState(false);
  const [isCancellingShoot, setIsCancellingShoot] = useState(false);
  const [isSendingToEditing, setIsSendingToEditing] = useState(false);
  const [isFinalising, setIsFinalising] = useState(false);
  const [isSubmittingRaw, setIsSubmittingRaw] = useState(false);
  const [isSubmittingEdits, setIsSubmittingEdits] = useState(false);
  const [submitConfirm, setSubmitConfirm] = useState<{ kind: 'raw' | 'edited' } | null>(null);
  const shouldShowCancellationFeePrompt = !isClient && isWithinCancellationFeeWindow;
  const currentStatus = String(shoot?.workflowStatus || shoot?.status || '').toLowerCase();
  const shouldShowClientCancellationFeeNotice =
    isClient &&
    canRequestCancellation &&
    !canWithdrawRequestedShoot &&
    ['scheduled', 'booked', 'on_hold'].includes(currentStatus);

  const handleSendToEditing = async () => {
    if (!shoot || isSendingToEditing) return;

    try {
      setIsSendingToEditing(true);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const currentStatus = shoot.status || shoot.workflowStatus || 'booked';

      if (String(currentStatus).toLowerCase() === 'editing') {
        toast({
          title: 'Already in editing',
          description: 'This shoot has already been sent to editing.',
        });
        await refreshShoot();
        return;
      }

      if (String(currentStatus).toLowerCase() !== 'uploaded') {
        throw new Error('Shoot must be in Uploaded status before sending to editing');
      }

      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/start-editing`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to send to editing' }));
        throw new Error(errorData.message || 'Failed to send to editing');
      }

      toast({
        title: 'Success',
        description: 'Shoot sent to editing',
      });
      await refreshShoot();
    } catch (error: any) {
      console.error('Send to editing error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to send to editing',
        variant: 'destructive',
      });
    } finally {
      setIsSendingToEditing(false);
    }
  };

  const pollFinalizeCompletion = async (): Promise<{ delivered: boolean; failed: boolean }> => {
    const deliveredStatuses = [
      'delivered',
      'ready_for_client',
      'admin_verified',
      'client_delivered',
      'workflow_completed',
      'finalized',
    ];

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const latestShoot = await refreshShoot();
      const latestStatus = String(
        (latestShoot as any)?.workflowStatus || (latestShoot as any)?.status || '',
      ).toLowerCase();
      if (deliveredStatuses.includes(latestStatus)) {
        return { delivered: true, failed: false };
      }

      const workflowLogs = (latestShoot as any)?.workflowLogs || (latestShoot as any)?.workflow_logs || [];
      const hasFinalizeFailure =
        Array.isArray(workflowLogs) &&
        workflowLogs.some((log: any) => String(log?.action || '').toLowerCase() === 'finalize_failed');

      if (hasFinalizeFailure) {
        return { delivered: false, failed: true };
      }

      await new Promise((resolve) => window.setTimeout(resolve, 4000));
    }

    return { delivered: false, failed: false };
  };

  const handleFinalise = async () => {
    if (!shoot || isFinalising) return;

    try {
      setIsFinalising(true);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/finalize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ final_status: 'admin_verified' }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to finalize shoot' }));
        throw new Error(errorData.message || 'Failed to finalize shoot');
      }

      const isQueued = res.status === 202;
      toast({
        title: isQueued ? 'Finalize started' : 'Success',
        description: isQueued
          ? 'Finalize started in background. You can continue working.'
          : 'Shoot finalized successfully',
      });

      if (!isQueued) {
        await refreshShoot();
        return;
      }

      const result = await pollFinalizeCompletion();
      if (result.failed) {
        toast({
          title: 'Finalize failed',
          description: 'Finalize failed in background. Check Activity Log for details.',
          variant: 'destructive',
        });
        return;
      }

      if (result.delivered) {
        toast({
          title: 'Finalize complete',
          description: 'Shoot is now delivered.',
        });
        return;
      }

      toast({
        title: 'Still processing',
        description: 'Finalize is still running in background. Check back in a moment.',
      });
    } catch (error: any) {
      console.error('Finalize error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to finalize shoot',
        variant: 'destructive',
      });
    } finally {
      setIsFinalising(false);
    }
  };

  const handleMarkOnHoldClick = () => {
    blurActiveElement();
    if (shouldShowCancellationFeePrompt) {
      setPendingAction('hold');
      setIsCancellationFeeDialogOpen(true);
    } else {
      setIsOnHoldDialogOpen(true);
    }
  };

  const handleMarkOnHold = async () => {
    if (!shoot || !onHoldReason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for putting the shoot on hold.',
        variant: 'destructive',
      });
      return;
    }

    const isHoldRequest = isClient;
    if (isHoldRequest && shoot.holdRequestedAt) {
      toast({
        title: 'Hold already requested',
        description: 'Your hold request is already pending approval.',
      });
      return;
    }

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const payload: Record<string, unknown> = { reason: onHoldReason.trim() };
      const shouldApplyCancellationFee =
        !isHoldRequest && isWithinCancellationFeeWindow && shouldAddCancellationFee;

      if (shouldApplyCancellationFee) {
        payload.cancellation_fee = 60;
      }

      const endpoint = isHoldRequest ? 'request-hold' : 'put-on-hold';
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.message || (isHoldRequest ? 'Failed to request hold' : 'Failed to put shoot on hold'),
        );
      }

      await refreshShoot();

      toast({
        title: isHoldRequest ? 'Hold request submitted' : 'Shoot put on hold',
        description: isHoldRequest
          ? 'Your hold request is pending admin approval.'
          : shouldApplyCancellationFee
            ? 'The shoot has been marked on hold. $60 cancellation fee has been added.'
            : 'The shoot has been successfully marked on hold.',
      });

      setIsOnHoldDialogOpen(false);
      setIsCancellationFeeDialogOpen(false);
      setOnHoldReason('');
      setShouldAddCancellationFee(false);
      setPendingAction(null);

      onShootUpdate?.();
    } catch (error) {
      console.error('Error submitting hold request:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : isHoldRequest
              ? 'Failed to request hold. Please try again.'
              : 'Failed to put shoot on hold. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCancellationFeeConfirm = () => {
    setIsCancellationFeeDialogOpen(false);
    if (pendingAction === 'hold') {
      blurActiveElement();
      setIsOnHoldDialogOpen(true);
    } else if (pendingAction === 'cancel') {
      blurActiveElement();
      setIsCancelShootDialogOpen(true);
    }
  };

  const handleCancelShoot = async () => {
    if (!shoot) return;

    setIsCancellingShoot(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const isClientImmediateWithdrawal = canWithdrawRequestedShoot;
      const isClientCancellationRequest = canRequestCancellation && !canWithdrawRequestedShoot;
      const payload: Record<string, unknown> = {
        reason:
          cancelShootReason.trim() ||
          (isClientImmediateWithdrawal
            ? 'Client withdrew requested shoot'
            : isClientCancellationRequest
              ? 'Client requested cancellation'
              : 'Cancelled by admin'),
      };

      if (!isClientImmediateWithdrawal && !isClientCancellationRequest) {
        payload.notify_client = !cancelWithoutNotification;
        payload.suppress_notifications = cancelWithoutNotification;
      }

      if (!isClient && isWithinCancellationFeeWindow && shouldAddCancellationFee) {
        payload.cancellation_fee = 60;
      }
      if (isClientCancellationRequest) {
        payload.cancellation_fee_notice_acknowledged = true;
      }

      const endpoint = isClientImmediateWithdrawal
        ? 'withdraw-request'
        : isClientCancellationRequest
          ? 'request-cancellation'
          : 'cancel';
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel shoot');
      }

      await refreshShoot();

      toast({
        title: isClientCancellationRequest ? 'Cancellation request submitted' : 'Shoot cancelled',
        description: isClientCancellationRequest
          ? 'Your cancellation request is pending admin approval.'
          : shouldAddCancellationFee && !isClient
          ? 'The shoot has been cancelled. $60 cancellation fee has been added.'
          : isClientImmediateWithdrawal
            ? 'Your requested shoot has been cancelled.'
            : 'The shoot has been successfully cancelled.',
      });

      setIsCancelShootDialogOpen(false);
      setCancelShootReason('');
      setCancelWithoutNotification(false);
      setShouldAddCancellationFee(false);
      onShootUpdate?.();
    } catch (error) {
      console.error('Error cancelling shoot:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to cancel shoot. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCancellingShoot(false);
    }
  };

  const handleCancelShootClick = () => {
    blurActiveElement();
    if (shouldShowCancellationFeePrompt || shouldShowClientCancellationFeeNotice) {
      setPendingAction('cancel');
      setIsCancellationFeeDialogOpen(true);
    } else {
      setIsCancelShootDialogOpen(true);
    }
  };

  const handleResumeFromHold = async () => {
    if (!shoot) return;

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');

      let scheduledDate: Date;
      if (shoot.scheduledDate && !isNaN(new Date(shoot.scheduledDate).getTime())) {
        scheduledDate = new Date(shoot.scheduledDate);
        const now = new Date();
        if (scheduledDate <= now) {
          scheduledDate = new Date();
          scheduledDate.setDate(scheduledDate.getDate() + 1);
          scheduledDate.setHours(10, 0, 0, 0);
        }
      } else {
        scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 1);
        scheduledDate.setHours(10, 0, 0, 0);
      }

      if (shoot.time) {
        const timeParts = shoot.time.split(':');
        const hours = parseInt(timeParts[0]) || 10;
        const minutes = parseInt(timeParts[1]) || 0;
        scheduledDate.setHours(hours, minutes, 0, 0);
      }

      const payload: Record<string, unknown> = {
        scheduled_at: scheduledDate.toISOString(),
      };

      if (shoot.photographer?.id) {
        const photographerId =
          typeof shoot.photographer.id === 'string'
            ? parseInt(shoot.photographer.id, 10)
            : shoot.photographer.id;
        if (!isNaN(photographerId)) {
          payload.photographer_id = photographerId;
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/schedule`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        const validationErrors = errorData.errors || {};
        const errorMessage =
          errorData.message ||
          errorData.error ||
          (Object.keys(validationErrors).length > 0
            ? `Validation failed: ${Object.entries(validationErrors)
                .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                .join('; ')}`
            : 'Failed to resume shoot from hold');
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (result.data) {
        const updatedShootData = { ...result.data } as ShootData;

        if (updatedShootData.status === 'scheduled' || updatedShootData.workflowStatus === 'booked') {
          updatedShootData.status = 'scheduled';
          updatedShootData.workflowStatus = 'booked';
        }

        if (updatedShootData.status === 'hold_on' || updatedShootData.status === 'on_hold') {
          updatedShootData.status = 'scheduled';
        }
        if (updatedShootData.workflowStatus === 'hold_on' || updatedShootData.workflowStatus === 'on_hold') {
          updatedShootData.workflowStatus = 'booked';
        }

        setShoot(updatedShootData);
        updateShoot(String(shoot.id), updatedShootData, { skipApi: true });
      }

      toast({
        title: 'Shoot resumed',
        description: 'The shoot has been moved back to scheduled status.',
      });

      await refreshShoot();
      onShootUpdate?.();
    } catch (error) {
      console.error('Error resuming shoot from hold:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to resume shoot from hold. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const openSubmitRawConfirm = () => {
    blurActiveElement();
    setSubmitConfirm({ kind: 'raw' });
  };

  const openSubmitEditedConfirm = () => {
    blurActiveElement();
    setSubmitConfirm({ kind: 'edited' });
  };

  const closeSubmitConfirm = () => setSubmitConfirm(null);

  const runSubmitFinalize = async (kind: 'raw' | 'edited') => {
    if (!shoot) return;
    const headers = getApiHeaders();
    const setBusy = kind === 'raw' ? setIsSubmittingRaw : setIsSubmittingEdits;
    setBusy(true);
    try {
      const res = kind === 'raw'
        ? await finalizeRawUploadQueue(shoot.id, headers)
        : await finalizeEditedUploadQueue(shoot.id, headers);
      const changed = Boolean((res as any)?.workflow_status_changed);
      toast({
        title: changed
          ? kind === 'raw' ? 'Raw files submitted' : 'Edited files submitted'
          : 'Already submitted',
        description: (res as any)?.message || (changed
          ? (kind === 'raw'
              ? 'Shoot moved to Uploaded.'
              : 'Shoot moved to Ready for finalization.')
          : 'No changes were applied to the shoot.'),
      });
      await refreshShoot();
      onShootUpdate?.();
      setSubmitConfirm(null);
    } catch (error: any) {
      const payload = error?.response?.data;
      const description = payload?.message
        || (error instanceof Error ? error.message : 'Failed to submit.');
      toast({
        title: kind === 'raw' ? 'Submit raw failed' : 'Submit edits failed',
        description,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmSubmit = () => {
    if (!submitConfirm) return;
    void runSubmitFinalize(submitConfirm.kind);
  };

  return {
    isOnHoldDialogOpen,
    setIsOnHoldDialogOpen,
    onHoldReason,
    setOnHoldReason,
    isCancellationFeeDialogOpen,
    setIsCancellationFeeDialogOpen,
    shouldAddCancellationFee,
    setShouldAddCancellationFee,
    pendingAction,
      setPendingAction,
      isCancelShootDialogOpen,
      setIsCancelShootDialogOpen,
      cancelShootReason,
      setCancelShootReason,
      cancelWithoutNotification,
      setCancelWithoutNotification,
      isCancellingShoot,
      isSendingToEditing,
      isFinalising,
    handleSendToEditing,
    handleFinalise,
    handleMarkOnHoldClick,
    handleMarkOnHold,
    handleCancellationFeeConfirm,
    handleCancelShoot,
    handleCancelShootClick,
    handleResumeFromHold,
    submitConfirm,
    isSubmittingRaw,
    isSubmittingEdits,
    handleSubmitRaw: openSubmitRawConfirm,
    handleSubmitEdits: openSubmitEditedConfirm,
    closeSubmitConfirm,
    confirmSubmit,
  };
}
