import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { apiClient } from '@/services/api';
import { useResendVerificationEmail } from '@/hooks/useResendVerificationEmail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProfileSecurityCard } from '@/components/profile/ProfileSecurityCard';
import { profileSecurityErrorMessage } from '@/services/profileSecurityService';

export type EmailVerificationState = {
  enrolled: boolean;
  verified: boolean;
  reminder: boolean;
  required: boolean;
  enforce_at: string | null;
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

  const refresh = useCallback(async () => {
    if (!user || isImpersonating) return;
    const version = gateVersion.current;
    try {
      const response = await apiClient.get<{ email_verification?: EmailVerificationState }>('/user');
      if (version === gateVersion.current) {
        setStatus(response.data.email_verification ? { ...response.data.email_verification } : null);
      }
    } catch {
      // Preserve a known gate while offline. The server remains authoritative.
    }
  }, [user?.id, isImpersonating]);

  useEffect(() => {
    setStatus(user?.email_verification ?? null);
    void refresh();
    const listener = () => { void refresh(); };
    const requireVerification = () => {
      gateVersion.current += 1;
      setStatus(previous => ({ ...previous, enrolled: true, verified: false, reminder: true, required: true, enforce_at: previous?.enforce_at ?? null }));
      void refresh();
    };
    window.addEventListener('focus', listener);
    window.addEventListener('email-verification-required', requireVerification);
    const timer = window.setInterval(listener, 60_000);
    return () => {
      window.removeEventListener('focus', listener);
      window.removeEventListener('email-verification-required', requireVerification);
      window.clearInterval(timer);
    };
  }, [refresh, user?.email_verification]);

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
    <section aria-label="Email verification" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-slate-900 dark:bg-amber-950 dark:text-slate-100">
      <h2 className="font-semibold">Verify your email address</h2>
      <p className="mt-1 text-sm">{status.required
        ? 'Confirm your current email address to continue using the dashboard.'
        : status.enrolled
          ? `Confirm ${user.email} before ${status.enforce_at ? new Date(status.enforce_at).toLocaleDateString() : 'the verification deadline'} to keep using the dashboard.`
          : `Please verify ${user.email}. You can continue using the dashboard.`}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={isResendingVerification} onClick={() => { void resendVerification().then(result => setFeedback(result.message)); }}>Send verification email</Button>
        <Button size="sm" variant="outline" onClick={() => { void refresh(); }}>I've verified my email</Button>
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
    {status.required ? (securityOpen ? <ProfileSecurityCard /> : null) : children}
  </>;
}
