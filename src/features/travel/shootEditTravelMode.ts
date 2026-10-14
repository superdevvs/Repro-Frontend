/** Match confirmed edits to update checks while pending requests remain approvals. */
export function shootEditTravelMode(source: unknown): 'update' | 'approve' {
  const shoot = source && typeof source === 'object' ? source as Record<string, unknown> : {};
  const status = String(shoot.status ?? '').toLowerCase();
  const workflow = String(shoot.workflow_status ?? shoot.workflowStatus ?? '').toLowerCase();
  if (status === 'requested' || workflow === 'requested') return 'approve';
  const confirmed = ['scheduled', 'booked', 'uploaded', 'completed', 'editing', 'review', 'ready', 'delivered'];
  return confirmed.includes(status) || confirmed.includes(workflow) ? 'update' : 'approve';
}
