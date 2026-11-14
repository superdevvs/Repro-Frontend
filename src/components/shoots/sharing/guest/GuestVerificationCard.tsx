import { Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/layout/Logo';
import { useIsMobile } from '@/hooks/use-mobile';
import { GuestLoginShell } from './GuestLoginShell';

type Props = {
  recipient?: string;
  senderName?: string;
  error: string;
  message: string;
  busy: boolean;
  code: string;
  codeSent: boolean;
  onCodeChange: (value: string) => void;
  onSendCode: () => void;
  onVerify: (event: React.FormEvent) => void;
  onRetry: () => void;
};

const primaryButtonClass = 'h-12 w-full gap-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-base font-semibold text-white shadow-lg shadow-blue-600/25 hover:opacity-90';

export function GuestVerificationCard({ recipient, senderName, error, message, busy, code, codeSent, onCodeChange, onSendCode, onVerify, onRetry }: Props) {
  const isMobile = useIsMobile();
  const sender = senderName?.trim();
  return <GuestLoginShell>
    <div className="w-full text-white">
      <div className={isMobile ? 'mb-5 space-y-2.5 text-left' : 'mb-8 text-center'}>
        <div className={`mb-4 flex h-[34px] items-center ${isMobile ? 'mt-[10px] justify-start' : 'justify-center'}`}><Logo className="h-[34px] w-auto" variant="light" /></div>
        <h1 className="text-2xl font-semibold">Open your Magic Link</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{sender
          ? <><span className="font-semibold text-white">{sender}</span> shared this link with you.</>
          : 'You have been invited to view shared property media.'}</p>
      </div>

      <div className="mb-6 border-b border-white/15 pb-3">
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-white"><ShieldCheck className="h-4 w-4 text-cyan-400" />Secure guest access</p>
      </div>
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-slate-300">{recipient
          ? `Verify ${recipient} to view the media and tours. No account needed.`
          : error ? 'Ask the sender for a new Magic Link if access has expired.' : 'Opening your Magic Link…'}</p>
        {recipient && (!codeSent
          ? <Button className={primaryButtonClass} disabled={busy} onClick={onSendCode}><Mail className="h-4 w-4 shrink-0" />{busy ? 'Sending…' : 'Email me a verification code'}</Button>
          : <form onSubmit={onVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guest-code" className="text-sm text-slate-300">Six-digit code</Label>
              <Input id="guest-code" value={code} onChange={event => onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
                className="h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-center text-xl tracking-[.4em] text-white placeholder:text-slate-400 focus-visible:border-cyan-400/40 focus-visible:ring-1 focus-visible:ring-cyan-400/20 focus-visible:ring-offset-0" />
            </div>
            <Button type="submit" className={primaryButtonClass} disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'View property'}</Button>
            <Button type="button" variant="ghost" className="h-9 w-full text-sm text-cyan-300 hover:bg-white/5 hover:text-cyan-200" disabled={busy} onClick={onSendCode}>Send another code</Button>
          </form>)}
        {!recipient && error && <Button className={primaryButtonClass} disabled={busy} onClick={onRetry}>Try again</Button>}
        {!recipient && !error && <div aria-hidden="true" className="h-12 animate-pulse rounded-full bg-white/5 motion-reduce:animate-none" />}
        {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-sm text-red-200">{error}</p>}
        {message && <p role="status" className="text-sm text-cyan-200">{message}</p>}
        <p className="text-center text-xs leading-relaxed text-slate-400">Photos, floorplans and tours, shared securely with you.</p>
      </div>
    </div>
  </GuestLoginShell>;
}
