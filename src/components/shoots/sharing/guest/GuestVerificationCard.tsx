import { Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  recipient?: string;
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

export function GuestVerificationCard({ recipient, error, message, busy, code, codeSent, onCodeChange, onSendCode, onVerify, onRetry }: Props) {
  return <main className="flex min-h-dvh flex-col bg-muted/20 p-3 text-foreground sm:p-5">
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <span className="text-sm font-semibold tracking-tight">R/E Pro Photos</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Magic Link</span>
      </header>
      <div className="grid flex-1 place-items-center px-4 py-12">
        <section className="w-full max-w-[380px] overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b px-6 py-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
            <h1 className="text-xl font-semibold tracking-tight">Open your Magic Link</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{recipient
              ? `Verify ${recipient} to view the media and tours. No account needed.`
              : error ? 'Ask the sender for a new Magic Link if access has expired.' : 'Opening your Magic Link…'}</p>
          </div>
          <div className="space-y-4 p-6">
            {recipient && (!codeSent
              ? <Button className="w-full gap-2 text-sm" disabled={busy} onClick={onSendCode}><Mail className="h-4 w-4" />{busy ? 'Sending…' : 'Email me a verification code'}</Button>
              : <form onSubmit={onVerify} className="space-y-3">
                <Label htmlFor="guest-code">Six-digit code</Label>
                <Input id="guest-code" value={code} onChange={event => onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
                  className="h-12 text-center text-xl tracking-[.4em]" />
                <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'View property'}</Button>
                <Button type="button" variant="ghost" className="w-full text-xs" disabled={busy} onClick={onSendCode}>Send another code</Button>
              </form>)}
            {!recipient && error && <Button variant="outline" className="w-full" disabled={busy} onClick={onRetry}>Try again</Button>}
            {!recipient && !error && <div aria-hidden="true" className="h-10 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
          </div>
        </section>
      </div>
      <footer className="border-t px-4 py-3 text-center text-[11px] text-muted-foreground">Property media, floorplans and tours · Shared securely with you</footer>
    </div>
  </main>;
}
