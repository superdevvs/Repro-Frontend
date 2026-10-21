import { apiClient } from './api';
import type { SupportStatus } from './supportTickets';
import { FREE_EDITS_PATH } from '@/config/listingStudio';

export type PhotoEditType = 'virtual_staging' | 'decluttering' | 'green_grass' | 'twilight';
export interface FreeEditsClaim {
  id: number;
  ticket_id: number;
  status: SupportStatus;
  support_url: string;
}
export interface FreeEditsEligibility {
  eligible: boolean;
  reason: null | 'already_claimed' | 'email_not_verified' | 'email_already_claimed';
  email_verified: boolean;
  offer: {
    photo_count: number;
    max_file_size_bytes: number;
    allowed_mime_types: string[];
    edit_types: Array<{ code: PhotoEditType; label: string }>;
  };
  claim: FreeEditsClaim | null;
}
export interface FreeEditsDraft {
  request_key: string;
  attachments: File[];
  edit_types: PhotoEditType[];
  notes: string;
}

export const getFreeEditsEligibility = async (signal?: AbortSignal): Promise<FreeEditsEligibility> =>
  (await apiClient.get(FREE_EDITS_PATH, { signal })).data.data;

export async function submitFreeEdits(data: FreeEditsDraft): Promise<FreeEditsClaim> {
  const form = new FormData();
  form.append('request_key', data.request_key);
  form.append('notes', data.notes.trim());
  data.attachments.forEach((file, index) => form.append(`attachments[${index}]`, file));
  data.edit_types.forEach((type, index) => form.append(`edit_types[${index}]`, type));
  return (await apiClient.post(FREE_EDITS_PATH, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data.data;
}

export function freeEditsSupportPath(claim: FreeEditsClaim): string {
  // Derive the internal destination; never navigate to a stored external URL.
  return `/messaging/email/inbox?tab=support&ticket=${encodeURIComponent(claim.ticket_id)}`;
}
