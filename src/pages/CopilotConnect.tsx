import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/components/auth';
import { API_BASE_URL } from '@/config/env';
import { getStoredAuthToken } from '@/utils/authToken';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Consent = { request_id: string; client_name: string; scopes: string[]; omitted_scopes?: string[]; account: { name: string; email: string }; expires_at: string };
const scopes: Record<string, string> = {
  'repro.read': 'Read the Repro records your account can access, including shoots, availability and workflow status.',
  'repro.write': 'Prepare and submit reviewed booking, appointment and note changes. Confirmed actions may send configured notifications.',
  'repro.finance': 'Read accounting reports, including collections and photographer, editor and sales rep payouts.',
};

export default function CopilotConnect() {
  const [params] = useSearchParams();
  const { isImpersonating } = useAuth();
  const requestId = params.get('request_id');
  const [consent, setConsent] = useState<Consent | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setConsent(null); setError('');
    if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) { setError('Start the connection from ChatGPT to obtain a valid request.'); return; }
    const controller = new AbortController();
    void fetch(`${API_BASE_URL}/api/copilot/oauth/requests/${requestId}`, { signal: controller.signal,
      headers: { Authorization: `Bearer ${getStoredAuthToken()}`, Accept: 'application/json' } })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Connection request unavailable.'); return data as Consent; })
      .then(setConsent).catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, [requestId]);

  async function respond(approve: boolean) {
    setPending(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/copilot/oauth/requests/${requestId}`, { method: 'POST',
        headers: { Authorization: `Bearer ${getStoredAuthToken()}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ approve }) });
      const data = await response.json() as { redirect_url?: string; message?: string };
      if (!response.ok || !data.redirect_url) throw new Error(data.message || 'The connection could not be completed.');
      const target = new URL(data.redirect_url);
      if (target.protocol !== 'https:' || !['chatgpt.com', 'chat.openai.com'].includes(target.hostname) || target.username || target.password) throw new Error('Invalid connection destination.');
      window.location.assign(target.href);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Connection failed.'); setPending(false); }
  }

  return <main className="min-h-screen bg-background flex items-center justify-center p-4">
    <Card className="w-full max-w-lg"><CardHeader><CardTitle>Connect Repro to ChatGPT</CardTitle>
      <CardDescription>Review the account and access this connection requests.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {isImpersonating && <p role="alert" className="text-destructive">Exit impersonation before connecting your account.</p>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {!consent && !error && <p role="status">Loading connection request…</p>}
        {consent && <><div><p className="font-medium">{consent.account.name}</p><p className="text-sm text-muted-foreground">{consent.account.email}</p></div>
          <div><p className="text-sm font-medium mb-2">Requested by {consent.client_name}</p><ul className="space-y-3">{consent.scopes.map(scope => <li key={scope} className="text-sm">{scopes[scope] || scope}</li>)}</ul></div>
          {!!consent.omitted_scopes?.length && <p className="text-sm text-muted-foreground">Accounting access is unavailable for this account and will be excluded from the connection.</p>}
          <p className="text-sm text-muted-foreground">Your Repro role and permissions apply to every action. You can revoke access from Connected apps at any time.</p>
          <div className="flex flex-wrap gap-2"><Button disabled={pending || isImpersonating} onClick={() => void respond(true)}>{pending ? 'Returning to ChatGPT…' : 'Allow connection'}</Button>
            <Button variant="outline" disabled={pending} onClick={() => void respond(false)}>Decline</Button></div></>}
        <Link to="/dashboard" className="text-sm underline">Return to Repro</Link>
      </CardContent></Card>
  </main>;
}
