import type { StudioItemStatus, StudioPagination, StudioService } from './listingStudioClient';

export type StudioRevisionStatus = 'queued' | 'assigned' | 'in_progress' | 'delivered' | 'cancelled';
export type StudioRevisionReason = 'quality_review' | 'source_issue' | 'instructions_unclear' | 'unable_to_complete' | 'client_cancelled';
export interface StudioRevisionDeliveryAttempt {
  id: string; status: 'pending' | 'finalizing' | 'completed' | 'needs_attention';
  reasonCode: string | null; message: string | null; canResume: boolean;
}
export interface StudioRevisionTask {
  id: string; orderId: string; itemId: string; version: number; status: StudioRevisionStatus; itemStatus: StudioItemStatus;
  service: StudioService; client: { id: string; name: string }; assignee: { id: string; name: string } | null;
  instructions: string; createdAt: string; updatedAt: string; assignedAt: string | null; startedAt: string | null; deliveredAt: string | null;
  source: { originalPreviewAvailable: boolean; resultPreviewAvailable: boolean }; deliveryPreviewAvailable: boolean;
  actions: { canAssign: boolean; canStart: boolean; canDeliver: boolean; canViewSource: boolean; canViewDelivery: boolean; canResumeDelivery: boolean; canHold: boolean; canFail: boolean; canCancel: boolean };
  recovery: { state: string; reasonCode: string | null; message: string | null };
  deliveryAttempt: StudioRevisionDeliveryAttempt | null;
  deliveryConstraints: { mimeTypes: string[]; maxFileBytes: number; maxPixels: number; maxFiles: number };
}
export interface StudioRevisionPage { tasks: StudioRevisionTask[]; pagination: StudioPagination }
export interface StudioRevisionAssignees { taskId: string; version: number; assignees: { id: string; name: string; role: string }[] }
