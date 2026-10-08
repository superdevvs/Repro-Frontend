/** Staff can assign externally shared intake before any dashboard upload. */
export const canSendShootToEditing = (shoot: {
  status?: string | null;
  workflowStatus?: string | null;
} | null | undefined): boolean => {
  const status = String(shoot?.workflowStatus || shoot?.status || '').trim().toLowerCase();
  return ['scheduled', 'booked', 'uploaded', 'raw_uploaded', 'photos_uploaded', 'completed', 'editing'].includes(status);
};
