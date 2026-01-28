// Unified status labels (backend: requested, scheduled, uploaded, editing, review, delivered, on_hold, cancelled, declined)
const STATUS_TEXT: Record<string, string> = {
  requested: 'Requested',
  scheduled: 'Scheduled',
  uploaded: 'Uploaded',
  editing: 'Editing',
  delivered: 'Delivered',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  declined: 'Declined',

  // Legacy aliases mapped to unified labels
  booked: 'Scheduled',
  raw_upload_pending: 'Scheduled',
  completed: 'Uploaded',  // 'completed' is now mapped to 'uploaded'
  raw_uploaded: 'Uploaded',
  raw_issue: 'Uploaded',
  editing_uploaded: 'Editing',
  editing_issue: 'Editing',
  pending_review: 'Editing',
  ready_for_client: 'Delivered',
  admin_verified: 'Delivered',
  hold_on: 'On Hold',
  in_progress: 'Uploaded',
  photos_uploaded: 'Uploaded',
  editing_complete: 'Editing',
  ready_for_review: 'Editing',
  qc: 'Editing',
  review: 'Editing',
  ready: 'Delivered',
};

const humanize = (value: string) =>
  value
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join('');

export const formatWorkflowStatus = (status?: string | null, fallback = 'Scheduled') => {
  if (!status) return fallback;
  const key = status.toLowerCase();
  return STATUS_TEXT[key] || humanize(key);
};

