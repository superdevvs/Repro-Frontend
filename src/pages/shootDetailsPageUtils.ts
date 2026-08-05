import type { ShootData } from '@/types/shoots';

type ShootWorkflowLog = {
  action?: string | null;
  [key: string]: unknown;
};

type ShootWithWorkflowLogs = ShootData & {
  workflowLogs?: ShootWorkflowLog[];
  workflow_logs?: ShootWorkflowLog[];
};

type ShootWithLegacyEditedCount = ShootData & {
  edited_photo_count?: number;
};

export const getShootDetailsErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const errorWithResponse = error as {
      message?: unknown;
      response?: { data?: { message?: unknown; error?: unknown } };
    };
    const responseMessage = errorWithResponse.response?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage;
    const responseError = errorWithResponse.response?.data?.error;
    if (typeof responseError === 'string' && responseError.trim()) return responseError;
    if (typeof errorWithResponse.message === 'string' && errorWithResponse.message.trim()) {
      return errorWithResponse.message;
    }
  }
  return fallback;
};

export const getShootWorkflowLogs = (shoot: ShootData | null | undefined): ShootWorkflowLog[] => {
  if (!shoot) return [];
  const source = shoot as ShootWithWorkflowLogs;
  return source.workflowLogs ?? source.workflow_logs ?? [];
};

export const getLegacyEditedPhotoCount = (shoot?: ShootData | null) => {
  if (!shoot || typeof shoot !== 'object') return undefined;
  return (shoot as ShootWithLegacyEditedCount).edited_photo_count;
};
