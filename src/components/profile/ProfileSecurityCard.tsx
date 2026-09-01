import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Laptop2,
  Loader2,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/lib/sonner-toast';
import { useSelfProfileSave } from '@/hooks/useSelfProfileSave';
import {
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  getProfileSecurity,
  notifyProfileActivityChanged,
  profileSecurityErrorMessage,
  regenerateTwoFactorRecoveryCodes,
  revokeOtherProfileSessions,
  revokeProfileSession,
  type ProfileSecurityStatus,
  type TwoFactorSetup,
} from '@/services/profileSecurityService';

type SetupStep = 'password' | 'verify' | 'recovery';

const relativeDate = (value: string | null) => {
  if (!value) return 'Not recorded yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded yet' : formatDistanceToNow(date, { addSuffix: true });
};

const errorText = (error: unknown, fallback: string) => profileSecurityErrorMessage(error, fallback);

export function ProfileSecurityCard() {
  const { saveProfile } = useSelfProfileSave();
  const [status, setStatus] = useState<ProfileSecurityStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirmation: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>('password');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);

  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState<string | null>(null);
  const [isDisabling, setIsDisabling] = useState(false);

  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [replacementCodes, setReplacementCodes] = useState<string[]>([]);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [isReplacingCodes, setIsReplacingCodes] = useState(false);

  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessionsPassword, setSessionsPassword] = useState('');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [busySession, setBusySession] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setStatus(await getProfileSecurity());
    } catch (error) {
      setLoadError(errorText(error, 'Could not load security settings.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const resetSetup = useCallback(() => {
    setSetupStep('password');
    setSetupPassword('');
    setSetupCode('');
    setSetup(null);
    setRecoveryCodes([]);
    setSetupError(null);
  }, []);

  const resetPasswordDialog = () => {
    setPasswordForm({ current: '', next: '', confirmation: '' });
    setPasswordError(null);
  };

  const closePasswordDialog = () => {
    resetPasswordDialog();
    setPasswordOpen(false);
  };

  const handlePasswordOpenChange = (open: boolean) => {
    if (!open && isChangingPassword) return;
    if (open) setPasswordOpen(true);
    else closePasswordDialog();
  };

  const closeSetupDialog = () => {
    resetSetup();
    setSetupOpen(false);
  };

  const handleSetupOpenChange = (open: boolean) => {
    if (!open && (isSettingUp || setupStep === 'recovery')) return;
    if (open) setSetupOpen(true);
    else closeSetupDialog();
  };

  const resetDisableDialog = () => {
    setDisablePassword('');
    setDisableCode('');
    setDisableError(null);
  };

  const closeDisableDialog = () => {
    resetDisableDialog();
    setDisableOpen(false);
  };

  const handleDisableOpenChange = (open: boolean) => {
    if (!open && isDisabling) return;
    if (open) setDisableOpen(true);
    else closeDisableDialog();
  };

  const resetRecoveryDialog = () => {
    setRecoveryPassword('');
    setRecoveryCode('');
    setReplacementCodes([]);
    setRecoveryError(null);
  };

  const closeRecoveryDialog = () => {
    resetRecoveryDialog();
    setRecoveryOpen(false);
  };

  const handleRecoveryOpenChange = (open: boolean) => {
    if (!open && (isReplacingCodes || replacementCodes.length > 0)) return;
    if (open) setRecoveryOpen(true);
    else closeRecoveryDialog();
  };

  const resetSessionsDialog = () => {
    setSessionsPassword('');
    setSessionError(null);
  };

  const closeSessionsDialog = () => {
    resetSessionsDialog();
    setSessionsOpen(false);
  };

  const handleSessionsOpenChange = (open: boolean) => {
    if (!open && busySession !== null) return;
    if (open) setSessionsOpen(true);
    else closeSessionsDialog();
  };

  const otherSessionCount = useMemo(
    () => status?.sessions.filter((session) => !session.current).length ?? 0,
    [status],
  );

  const markSecurityChanged = useCallback(async () => {
    await loadStatus();
    notifyProfileActivityChanged();
  }, [loadStatus]);

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (passwordForm.next.length < 8) {
      setPasswordError('Use at least 8 characters for your new password.');
      return;
    }
    if (passwordForm.next !== passwordForm.confirmation) {
      setPasswordError('The new passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await saveProfile({
        current_password: passwordForm.current,
        new_password: passwordForm.next,
        new_password_confirmation: passwordForm.confirmation,
      });
      if (!result.reauthRequired) {
        toast.success(result.message);
        closePasswordDialog();
      }
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Could not change your password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const startTwoFactor = async (event: React.FormEvent) => {
    event.preventDefault();
    setSetupError(null);
    setIsSettingUp(true);
    try {
      setSetup(await beginTwoFactorSetup(setupPassword));
      setSetupStep('verify');
    } catch (error) {
      setSetupError(errorText(error, 'Could not start two-factor setup.'));
    } finally {
      setIsSettingUp(false);
    }
  };

  const confirmTwoFactor = async (event: React.FormEvent) => {
    event.preventDefault();
    setSetupError(null);
    setIsSettingUp(true);
    try {
      const codes = await confirmTwoFactorSetup(setupPassword, setupCode);
      setRecoveryCodes(codes);
      setSetupStep('recovery');
      await markSecurityChanged();
      toast.success('Two-factor authentication enabled');
    } catch (error) {
      setSetupError(errorText(error, 'That authenticator code could not be verified.'));
    } finally {
      setIsSettingUp(false);
    }
  };

  const copyRecoveryCodes = async () => {
    try {
      await navigator.clipboard.writeText((replacementCodes.length > 0 ? replacementCodes : recoveryCodes).join('\n'));
      toast.success('Recovery codes copied');
    } catch {
      toast.error('Could not copy the recovery codes. Select and copy them manually.');
    }
  };

  const downloadRecoveryCodes = () => {
    const codesToDownload = replacementCodes.length > 0 ? replacementCodes : recoveryCodes;
    const blob = new Blob([
      `Repro Photos two-factor recovery codes\n\n${codesToDownload.join('\n')}\n\nEach code can be used once.`,
    ], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'repro-photos-recovery-codes.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const replaceRecoveryCodes = async (event: React.FormEvent) => {
    event.preventDefault();
    setRecoveryError(null);
    setIsReplacingCodes(true);
    try {
      const codes = await regenerateTwoFactorRecoveryCodes(recoveryPassword, recoveryCode);
      setReplacementCodes(codes);
      await markSecurityChanged();
      toast.success('Recovery codes replaced');
    } catch (error) {
      setRecoveryError(errorText(error, 'Could not replace recovery codes.'));
    } finally {
      setIsReplacingCodes(false);
    }
  };

  const handleDisable = async (event: React.FormEvent) => {
    event.preventDefault();
    setDisableError(null);
    setIsDisabling(true);
    try {
      await disableTwoFactor(disablePassword, disableCode);
      closeDisableDialog();
      await markSecurityChanged();
      toast.success('Two-factor authentication disabled. Other sessions were signed out.');
    } catch (error) {
      setDisableError(errorText(error, 'Could not disable two-factor authentication.'));
    } finally {
      setIsDisabling(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setBusySession(sessionId);
    setSessionError(null);
    try {
      await revokeProfileSession(sessionId, sessionsPassword);
      await markSecurityChanged();
      toast.success('Session signed out');
    } catch (error) {
      setSessionError(errorText(error, 'Could not sign out that session.'));
    } finally {
      setSessionsPassword('');
      setBusySession(null);
    }
  };

  const revokeOthers = async () => {
    setBusySession('others');
    setSessionError(null);
    try {
      const revoked = await revokeOtherProfileSessions(sessionsPassword);
      await markSecurityChanged();
      toast.success(revoked > 0 ? `${revoked} other session${revoked === 1 ? '' : 's'} signed out` : 'No other sessions found');
    } catch (error) {
      setSessionError(errorText(error, 'Could not sign out the other sessions.'));
    } finally {
      setSessionsPassword('');
      setBusySession(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> Security
          </CardTitle>
          <CardDescription>Password, authenticator, and signed-in devices</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading security…
            </div>
          ) : loadError || !status ? (
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p>{loadError || 'Security settings are unavailable.'}</p>
              <Button variant="outline" size="sm" onClick={() => void loadStatus()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              <div className="space-y-3 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Password</p>
                    <p className="text-xs text-muted-foreground">Last changed {relativeDate(status.password.changed_at)}</p>
                  </div>
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setPasswordOpen(true)}>
                  Change password
                </Button>
              </div>

              <div className="space-y-3 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Two-factor authentication</p>
                    <p className="text-xs text-muted-foreground">
                      {status.two_factor.enabled
                        ? `${status.two_factor.recovery_codes_remaining} recovery codes remaining`
                        : 'Require an authenticator code at sign-in'}
                    </p>
                  </div>
                  <Badge variant="outline" className={status.two_factor.enabled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'}>
                    {status.two_factor.enabled ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <TriangleAlert className="mr-1 h-3 w-3" />}
                    {status.two_factor.enabled ? 'Enabled' : 'Off'}
                  </Badge>
                </div>
                {status.two_factor.enabled ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRecoveryOpen(true)}>
                      Replace codes
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDisableOpen(true)}>
                      Disable 2FA
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setSetupOpen(true)}>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Enable 2FA
                  </Button>
                )}
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Active sessions</p>
                    <p className="text-xs text-muted-foreground">{status.sessions.length} signed-in device{status.sessions.length === 1 ? '' : 's'}</p>
                  </div>
                  <Laptop2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setSessionsOpen(true)}>
                  Manage sessions
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={passwordOpen} onOpenChange={handlePasswordOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Changing your password signs out every dashboard session, including this one.</DialogDescription>
          </DialogHeader>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="security-current-password">Current password</Label>
              <Input id="security-current-password" type="password" autoComplete="current-password" value={passwordForm.current} onChange={(event) => setPasswordForm((value) => ({ ...value, current: event.target.value }))} disabled={isChangingPassword} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="security-new-password">New password</Label>
              <Input id="security-new-password" type="password" autoComplete="new-password" value={passwordForm.next} onChange={(event) => setPasswordForm((value) => ({ ...value, next: event.target.value }))} minLength={8} disabled={isChangingPassword} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="security-confirm-password">Confirm new password</Label>
              <Input id="security-confirm-password" type="password" autoComplete="new-password" value={passwordForm.confirmation} onChange={(event) => setPasswordForm((value) => ({ ...value, confirmation: event.target.value }))} minLength={8} disabled={isChangingPassword} required />
            </div>
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handlePasswordOpenChange(false)} disabled={isChangingPassword}>Cancel</Button>
              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Change password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={setupOpen} onOpenChange={handleSetupOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enable two-factor authentication</DialogTitle>
            <DialogDescription>
              {setupStep === 'password' && 'Confirm your password to begin.'}
              {setupStep === 'verify' && 'Scan the QR code, then enter the 6-digit code from your authenticator app.'}
              {setupStep === 'recovery' && 'Save these one-time recovery codes somewhere secure.'}
            </DialogDescription>
          </DialogHeader>

          {setupStep === 'password' && (
            <form onSubmit={startTwoFactor} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="two-factor-password">Current password</Label>
                <Input id="two-factor-password" type="password" autoComplete="current-password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)} disabled={isSettingUp} required />
              </div>
              {setupError && <p className="text-sm text-destructive">{setupError}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleSetupOpenChange(false)} disabled={isSettingUp}>Cancel</Button>
                <Button type="submit" disabled={isSettingUp}>
                  {isSettingUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continue
                </Button>
              </DialogFooter>
            </form>
          )}

          {setupStep === 'verify' && setup && (
            <form onSubmit={confirmTwoFactor} className="space-y-4">
              <div className="mx-auto w-fit rounded-xl border bg-white p-3">
                <QRCodeSVG value={setup.otpauth_uri} size={180} level="M" />
              </div>
              <div className="space-y-2">
                <Label>Manual setup key</Label>
                <code className="block break-all rounded-md bg-muted p-3 text-center text-xs tracking-wider">{setup.secret}</code>
              </div>
              <div className="space-y-2">
                <Label htmlFor="two-factor-code">Authenticator code</Label>
                <Input id="two-factor-code" inputMode="numeric" autoComplete="one-time-code" value={setupCode} onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="text-center font-mono text-lg tracking-[0.35em]" disabled={isSettingUp} required />
              </div>
              {setupError && <p className="text-sm text-destructive">{setupError}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleSetupOpenChange(false)} disabled={isSettingUp}>Cancel</Button>
                <Button type="submit" disabled={isSettingUp || setupCode.length !== 6}>
                  {isSettingUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verify and enable
                </Button>
              </DialogFooter>
            </form>
          )}

          {setupStep === 'recovery' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
                {recoveryCodes.map((code) => <span key={code}>{code}</span>)}
              </div>
              <p className="text-sm text-muted-foreground">Each recovery code works once. They will not be shown again.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={() => void copyRecoveryCodes()}><Copy className="mr-2 h-4 w-4" /> Copy</Button>
                <Button type="button" variant="outline" onClick={downloadRecoveryCodes}><Download className="mr-2 h-4 w-4" /> Download</Button>
              </div>
              <Button type="button" className="w-full" onClick={closeSetupDialog} disabled={isSettingUp}>I saved my codes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={handleDisableOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable two-factor authentication?</DialogTitle>
            <DialogDescription>Confirm with your password and a current authenticator or recovery code. Other sessions will be signed out.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDisable} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disable-two-factor-password">Current password</Label>
              <Input id="disable-two-factor-password" type="password" autoComplete="current-password" value={disablePassword} onChange={(event) => setDisablePassword(event.target.value)} disabled={isDisabling} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disable-two-factor-code">Authenticator or recovery code</Label>
              <Input id="disable-two-factor-code" autoComplete="one-time-code" value={disableCode} onChange={(event) => setDisableCode(event.target.value)} disabled={isDisabling} required />
            </div>
            {disableError && <p className="text-sm text-destructive">{disableError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDisableOpenChange(false)} disabled={isDisabling}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={isDisabling}>
                {isDisabling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Disable 2FA
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={recoveryOpen} onOpenChange={handleRecoveryOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Replace recovery codes</DialogTitle>
            <DialogDescription>
              {replacementCodes.length > 0
                ? 'Save these new one-time codes. Every previous recovery code is now invalid.'
                : 'Confirm with your password and authenticator. Every existing recovery code will be invalidated.'}
            </DialogDescription>
          </DialogHeader>
          {replacementCodes.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
                {replacementCodes.map((code) => <span key={code}>{code}</span>)}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={() => void copyRecoveryCodes()}><Copy className="mr-2 h-4 w-4" /> Copy</Button>
                <Button type="button" variant="outline" onClick={downloadRecoveryCodes}><Download className="mr-2 h-4 w-4" /> Download</Button>
              </div>
              <Button type="button" className="w-full" onClick={closeRecoveryDialog} disabled={isReplacingCodes}>I saved my codes</Button>
            </div>
          ) : (
            <form onSubmit={replaceRecoveryCodes} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="replace-codes-password">Current password</Label>
                <Input id="replace-codes-password" type="password" autoComplete="current-password" value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} disabled={isReplacingCodes} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replace-codes-authenticator">Authenticator or recovery code</Label>
                <Input id="replace-codes-authenticator" autoComplete="one-time-code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} disabled={isReplacingCodes} required />
              </div>
              {recoveryError && <p className="text-sm text-destructive">{recoveryError}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleRecoveryOpenChange(false)} disabled={isReplacingCodes}>Cancel</Button>
                <Button type="submit" disabled={isReplacingCodes}>
                  {isReplacingCodes && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Replace codes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={sessionsOpen} onOpenChange={handleSessionsOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Active sessions</DialogTitle>
            <DialogDescription>Review devices with access to your dashboard and sign out ones you do not recognize.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[45vh] pr-4">
            <div className="divide-y">
              {status?.sessions.map((session) => (
                <div key={session.id} className="flex items-start justify-between gap-4 py-4 first:pt-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{session.device}</p>
                      {session.current && <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">This device</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last active {relativeDate(session.last_active_at)}{session.ip_address ? ` · IP ${session.ip_address}` : ''}
                    </p>
                  </div>
                  {!session.current && (
                    <Button variant="ghost" size="sm" disabled={!sessionsPassword || busySession !== null} onClick={() => void revokeSession(session.id)}>
                      {busySession === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="mr-2 h-4 w-4" /> Sign out</>}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          {otherSessionCount > 0 && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
               <Label htmlFor="sessions-password">Current password</Label>
               <p className="text-xs text-muted-foreground">Required each time you sign out one or all other devices.</p>
               <div className="flex flex-col gap-2 sm:flex-row">
                 <Input id="sessions-password" type="password" autoComplete="current-password" value={sessionsPassword} onChange={(event) => { setSessionsPassword(event.target.value); setSessionError(null); }} placeholder="Enter your current password" disabled={busySession !== null} />
                 <Button variant="destructive" disabled={!sessionsPassword || busySession !== null} onClick={() => void revokeOthers()}>
                  {busySession === 'others' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign out all others
                </Button>
              </div>
            </div>
          )}
          {sessionError && <p className="text-sm text-destructive">{sessionError}</p>}
          <DialogFooter>
             <Button variant="outline" onClick={() => handleSessionsOpenChange(false)} disabled={busySession !== null}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
