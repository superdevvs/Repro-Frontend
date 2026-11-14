import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '@/config/env';
import { GuestOverviewView } from '@/components/shoots/sharing/guest/GuestOverviewView';
import { GuestVerificationCard } from '@/components/shoots/sharing/guest/GuestVerificationCard';
import type { GuestFile, GuestOverview } from '@/components/shoots/sharing/guest/guestOverviewTypes';
import { GuestRequestError } from '@/components/shoots/sharing/guest/guestOverviewTypes';

type GuestResponse = { verified: boolean; recipient: string; sender_name?: string; data: GuestOverview | null };

export default function GuestShootOverview() {
  const { token = '' } = useParams();
  return <GuestShootOverviewContent key={token} token={token} />;
}

function GuestShootOverviewContent({ token }: { token: string }) {
  const pendingRequests = useRef(new Set<AbortController>());
  const loadGeneration = useRef(0);
  useEffect(() => { const pending = pendingRequests.current; return () => { pending.forEach(controller => controller.abort()); }; }, []);
  const [result, setResult] = useState<GuestResponse | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [selected, setSelected] = useState<GuestFile | null>(null);
  const endpoint = `${API_BASE_URL}/api/public/guest-shares/${encodeURIComponent(token)}`;
  const request = useCallback(async (suffix = '', body?: object) => {
    const controller = new AbortController(); pendingRequests.current.add(controller);
    try {
      const response = await fetch(`${endpoint}${suffix}`, { credentials: 'include', cache: 'no-store', signal: controller.signal,
        method: body ? 'POST' : 'GET', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json().catch(() => ({}));
      if (controller.signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
      if (!response.ok) throw new GuestRequestError(data.message || 'This invitation is unavailable.', response.status);
      return data;
    } finally { pendingRequests.current.delete(controller); }
  }, [endpoint]);
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
      const data = await request();
      if (generation !== loadGeneration.current) return;
      setResult(data); setError('');
      if (!data.verified) { setSelected(null); setCodeSent(false); setCode(''); setMessage(''); }
      else setSelected(previous => previous ? data.data?.files.find((file: GuestFile) => file.id === previous.id) ?? null : null);
    } catch (reason) {
      if (generation !== loadGeneration.current) return;
      setResult(null); setSelected(null);
      setError(reason instanceof Error ? reason.message : 'Unable to open the Magic Link.');
    }
  }, [request]);
  useEffect(() => {
    setResult(null); setError('');
    void load();
    return () => { loadGeneration.current += 1; };
  }, [load]);
  useEffect(() => {
    if (!result?.verified) return;
    const refresh = () => { if (!document.hidden) void load(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [result?.verified, load]);
  useEffect(() => {
    const meta = document.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer'; document.head.appendChild(meta);
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex,nofollow'; document.head.appendChild(robots);
    return () => { meta.remove(); robots.remove(); };
  }, []);
  const sendCode = async () => {
    setBusy(true); setError(''); setMessage('');
    try { await request('/code', {}); setCodeSent(true); setMessage('Code sent. Check your inbox.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to send code.'); }
    finally { setBusy(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await request('/verify', { code }); await load(); setCode(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to verify code.'); }
    finally { setBusy(false); }
  };
  const retry = async () => {
    setBusy(true); setError('');
    try { await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to open the Magic Link.'); }
    finally { setBusy(false); }
  };
  const overview = result?.verified ? result.data : null;
  if (!overview) return <GuestVerificationCard recipient={result?.recipient} senderName={result?.sender_name} error={error} message={message}
    busy={busy} code={code} codeSent={codeSent} onCodeChange={setCode} onSendCode={() => void sendCode()}
    onVerify={event => void verify(event)} onRetry={() => void retry()} />;
  return <GuestOverviewView overview={overview} selected={selected} onSelect={setSelected} request={request} onRefreshAccess={load} />;
}
