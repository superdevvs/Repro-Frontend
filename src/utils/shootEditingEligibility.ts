/** Editing managers can hand off scheduled or uploaded shoots using external RAWs. */
export const canSendShootToEditing = (shoot: {
  status?: string | null;
  workflowStatus?: string | null;
} | null | undefined, role?: string | null): boolean => {
  const status = String(shoot?.workflowStatus || shoot?.status || '').trim().toLowerCase();
  return role === 'editing_manager' && ['scheduled', 'booked', 'uploaded', 'raw_uploaded', 'photos_uploaded', 'completed'].includes(status);
};
