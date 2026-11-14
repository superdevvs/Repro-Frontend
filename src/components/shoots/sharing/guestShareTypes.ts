export type GuestInvitation = {
  id: number;
  email: string;
  status: 'active' | 'verified' | 'expired' | 'revoked' | 'unavailable' | 'sending' | 'failed';
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_verified_at: string | null;
  last_sent_at?: string | null;
  resend_available_at?: string | null;
  creator?: { id: number; name: string };
  can_copy: boolean;
  can_resend: boolean;
};

export type GuestInviteResult = {
  email: string;
  outcome: 'sent' | 'existing' | 'failed';
  share?: GuestInvitation;
  message?: string;
};

export const MAX_GUEST_RECIPIENTS = 20;
export const normalizeGuestEmails = (value: string) => [...new Set(value.split(/[\s,;]+/).map(email => email.trim().toLowerCase()).filter(Boolean))];
export const isGuestEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const invitationIsActive = (invitation: GuestInvitation) => ['active', 'verified'].includes(invitation.status)
  && !invitation.revoked_at && new Date(invitation.expires_at).getTime() > Date.now();
export const formatGuestDate = (value?: string | null) => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
