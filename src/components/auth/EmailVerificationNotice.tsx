import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { apiClient } from '@/services/api';
import { useResendVerificationEmail } from '@/hooks/useResendVerificationEmail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProfileSecurityCard } from '@/components/profile/ProfileSecurityCard';
import { profileSecurityErrorMessage } from '@/services/profileSecurityService';
import { EMAIL_VERIFICATION_REQUIRED_EVENT } from '@/services/apiError';
import {
  fetchCurrentUserProfile,
  USER_PROFILE_MIN_INTERVAL_MS,
} from '@/utils/userProfileClient';

export type EmailVerificationState = {
  enrolled: boolean;
  verified: boolean;
  reminder: boolean;
  required: boolean;
  enforce_at: string | null;
};

/** Keep the exported name for tests; floor matches shared profile client. */
export const EMAIL_VERIFICATION_REFRESH_COOLDOWN_MS = USER_PROFILE_MIN_INTERVAL_MS;

const readVerification = (payload: unknown): EmailVerificationState | null => {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as { email_verification?: EmailVerificationState }).email_verification;
  return value ? { ...value } : null;
};

export function EmailVerificationNotice({ children }: { children: ReactNode }) {
  const { user, logout, isImpersonating } = useAuth();
  const { resendVerification, isResendingVerification } = useResendVerificationEmail();
  const [status, setStatus] = useState<EmailVerificationState | null>(user?.email_verification ?? null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [securityOpen, setSecurityOpen] = useState(false);
  const gateVersion = useRef(0);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    if (!user || isImpersonating) return;
    if (inFlightRef.current) return;

    const version = gateVersion.current;
    inFlightRef.current = true;
    try {
      if (options?.force) {
        // Manual "I've verified" still uses apiClient so the UI can see a fresh envelope
        // even when the shared automatic floor would skip.
        const response = await apiClient.get<{ email_verification?: EmailVerificationState }>('/user');
        if (version === gateVersion.current) {
          setStatus(response.data.email_verification ? { ...response.data.email_verification } : null);
        }
        return;
      }

      const payload = await fetchCurrentUserProfile();
      if (version !== gateVersion.current) return;
      if (!payload || typeof payload !== 'object' || '__status' in payload) return;
      const next = readVerification(payload);
      if (next) setStatus(next);
    } catch {
      // Preserve a known gate while offline. The server remains authoritative.
    } finally {
      inFlightRef.current = false;
    }
  }, [user?.id, isImpersonating]);

  useEffect(() => {
    setStatus(user?.email_verification ?? null);
  }, [user?.id, user?.email_verification?.required, user?.email_verification?.verified, user?.email_verification?.reminder, user?.email_verification?.enrolled, user?.email_verification?.enforce_at]);

  const verificationInactive = Boolean(
    user?.email_verification?.verified
    || (
      user?.email_verification
      && !user.email_verification.reminder
      && !user.email_verification.required
    ),
  );

  useEffect(() => {
    if (!user || isImpersonating) return;

    // Verified clients (e.g. uid 1388) must not poll /api/user at all — the prior
    // mount+interval+/focus path was one amplifier; dual-tab reload was the rest.
    if (verificationInactive) {
      const requireVerification = () => {
        gateVersion.current += 1;
        setStatus(previous => ({
          enrolled: true,
          verified: false,
          reminder: true,
          required: true,
          enforce_at: previous?.enforce_at ?? null,
        }));
        void refresh({ force: true });
      };
      window.addEventListener(EMAIL_VERIFICATION_REQUIRED_EVENT, requireVerification);
      return () => window.removeEventListener(EMAIL_VERIFICATION_REQUIRED_EVENT, requireVerification);
    }

    // One automatic attempt on mount (shared floor dedupes against AuthProvider).
    void refresh();

    const requireVerification = () => {
      gateVersion.current += 1;
      setStatus(previous => ({
        enrolled: true,
        verified: false,
        reminder: true,
        required: true,
        enforce_at: previous?.enforce_at ?? null,
      }));
      void refresh();
    };

    // Intentionally no window `focus` → /user.
    window.addEventListener(EMAIL_VERIFICATION_REQUIRED_EVENT, requireVerification);
    const timer = window.setInterval(() => { void refresh(); }, USER_PROFILE_MIN_INTERVAL_MS);
    return () => {
      window.removeEventListener(EMAIL_VERIFICATION_REQUIRED_EVENT, requireVerification);
      window.clearInterval(timer);
    };
  }, [refresh, user?.id, isImpersonating, verificationInactive]);

  if (!user || isImpersonating || !status || status.verified || (!status.reminder && !status.required)) return <>{children}</>;

  const correct = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFeedback('');
    try {
      await apiClient.post('/profile/email-verification/correct', { email, current_password: password });
      logout();
    } catch (error) {
      setFeedback(profileSecurityErrorMessage(error, 'Could not update your email. Please try again.'));
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  return <>
    <section aria-label="Email verification" className="mb-4 shrink-0 rounded-lg border border-amber-300 bg-amber-50 p-4 text-slate-900 dark:bg-amber-950 dark:text-slate-100">
      <h2 className="font-semibold">Verify your email address</h2>
      <p className="mt-1 text-sm">{status.required
        ? 'Confirm your current email address to continue using the dashboard.'
        : status.enrolled
          ? `Confirm ${user.email} before ${status.enforce_at ? new Date(status.enforce_at).toLocaleDateString() : 'the verification deadline'} to keep using the dashboard.`
          : `Please verify ${user.email}. You can continue using the dashboard.`}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={isResendingVerification} onClick={() => { void resendVerification().then(result => setFeedback(result.message)); }}>Send verification email</Button>
        <Button size="sm" variant="outline" onClick={() => { void refresh({ force: true }); }}>I've verified my email</Button>
        <Button size="sm" variant="outline" onClick={() => setCorrecting(value => !value)}>Correct email address</Button>
        {status.required && <Button size="sm" variant="outline" onClick={() => setSecurityOpen(value => !value)}>Account security</Button>}
        {status.required && <Button size="sm" variant="outline" onClick={logout}>Log out</Button>}
      </div>
      {correcting && <form className="mt-4 max-w-md space-y-2" onSubmit={correct}>
        <Label htmlFor="verification-email">Current email address</Label>
        <Input id="verification-email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required />
        <Label htmlFor="verification-password">Current password</Label>
        <Input id="verification-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required />
        <p className="text-xs">Changing your email signs out existing sessions. Sign in again with the corrected email.</p>
        <Button type="submit" size="sm" disabled={busy}>Update email</Button>
      </form>}
      {feedback && <p role="status" className="mt-2 text-sm">{feedback}</p>}
    </section>
    {status.required ? (securityOpen ? <ProfileSecurityCard /> : null) : (
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    )}
  </>;
}
