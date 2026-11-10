import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import type { MediaFile } from '@/hooks/useShootFiles';

export type DeliveryMode = 'media' | 'external' | 'manual_no_content' | 'auto';
export interface DeliveryComponent {
  id: string; shoot_service_id: number; unit_id: number | null; service_name?: string;
  label: string; kind: 'photo' | 'video' | 'floorplan' | 'tour' | 'external' | 'legacy';
  status: 'pending' | 'ready' | 'delivered' | 'cancelled'; resolved: boolean; required: boolean;
  file_ids: number[]; output_count?: number; reason_codes: string[]; reason: string | null;
  methods: DeliveryMode[]; external_url?: string | null; scheduled_at?: string | null;
  photographer_id?: number | null; editor_id?: number | null;
}
export interface DeliveryPlan {
  revision: string; shoot_id: number; components: DeliveryComponent[];
  ready_component_ids: string[]; remaining_component_ids: string[];
  capabilities: { can_finalize: boolean; can_manual_no_content: boolean; can_assign_service: boolean };
  summary: string;
}
export interface AssignmentTarget {
  id: number; service_id: number; name: string; unit_id: number | null; unit_label?: string | null;
  assignee_name?: string | null; photographer?: { name?: string }; editor?: { name?: string };
  scheduled_at?: string | null; workflow_status?: string; delivery_status?: string;
  assignable?: boolean; reason?: string | null; blockers?: string[];
  accepted_lanes?: string[]; upload_intake_type?: string;
  accepted_types?: string[]; historical?: boolean;
  timezone?: string;
}
export interface AssignmentFile { id: number; shoot_service_id: number | null; content_version: number }
export interface AssignmentPreview {
  capabilities: { can_assign_service: boolean }; targets: AssignmentTarget[]; files: AssignmentFile[];
  blockers: Array<string | { message?: string; reason?: string }>; can_apply: boolean;
  media_revision?: number; updated_count?: number;
  requires_historical_confirmation?: boolean; receipt_revision?: string;
}
export class MediaMarkRequestError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = 'MediaMarkRequestError'; }
}
export async function mediaMarkRequest<T>(shootId: string | number, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: getApiHeaders(), signal,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new MediaMarkRequestError(response.status, result.message || 'This action could not be completed. Refresh and try again.');
  return (result.data ?? result) as T;
}
export const getDeliveryPlan = (id: string | number, signal?: AbortSignal) => mediaMarkRequest<DeliveryPlan>(id, 'delivery-plan', undefined, signal);
export const previewServiceAssignment = (id: string | number, body: Record<string, unknown>, signal?: AbortSignal) =>
  mediaMarkRequest<AssignmentPreview>(id, 'media/assign-service', { ...body, dry_run: true }, signal);
export const applyServiceAssignment = (id: string | number, body: Record<string, unknown>) =>
  mediaMarkRequest<AssignmentPreview>(id, 'media/assign-service', { ...body, dry_run: false });
export const selectedMediaIds = (files: MediaFile[]) => [...new Set(files.map(file => Number(file.id)).filter(id => Number.isSafeInteger(id) && id > 0))];
export const assignmentIdentities = (files: AssignmentFile[]) => files.map(file => ({ id: Number(file.id), shoot_service_id: file.shoot_service_id == null ? null : Number(file.shoot_service_id), content_version: Number(file.content_version) }));
export const assignmentBlocker = (blocker: AssignmentPreview['blockers'][number]) => typeof blocker === 'string' ? blocker : blocker.message || blocker.reason || 'Assignment needs review.';
export const deliveryComponentSelectable = (component: DeliveryComponent, mode: DeliveryMode) => !component.resolved
  && component.methods.includes(mode) && (mode === 'manual_no_content' || mode === 'external' && component.reason_codes.includes('external_review_required') || component.status === 'ready');
