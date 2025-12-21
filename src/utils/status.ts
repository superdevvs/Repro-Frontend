// Unified status labels (backend: scheduled, uploaded, editing, review, delivered, on_hold, cancelled)
const STATUS_TEXT: Record<string, string> = {
  scheduled: 'Scheduled',
  uploaded: 'Uploaded',
  editing: 'Editing',
  review: 'Review',
  delivered: 'Delivered',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',

  // Legacy aliases mapped to unified labels
  booked: 'Scheduled',
  raw_upload_pending: 'Scheduled',
  completed: 'Uploaded',  // 'completed' is now mapped to 'uploaded'
  raw_uploaded: 'Uploaded',
  raw_issue: 'Uploaded',
  editing_uploaded: 'Review',
  editing_issue: 'Review',
  pending_review: 'Review',
  ready_for_client: 'Delivered',
  admin_verified: 'Delivered',
  hold_on: 'On Hold',
  in_progress: 'Uploaded',
  photos_uploaded: 'Uploaded',
  editing_complete: 'Review',
  ready_for_review: 'Review',
  qc: 'Review',
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

