import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiHeaders } from '@/services/api';
import { API_BASE_URL } from '@/config/env';
import type { GuestInvitation, GuestInviteResult } from './guestShareTypes';

export function useShootGuestSharing(shootId: string, open: boolean) {
  const pending = useRef(new Set<AbortController>());
  const generation = useRef(0);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const [invitations, setInvitations] = useState<GuestInvitation[]>([]);
  const [results, setResults] = useState<GuestInviteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copyFallback, setCopyFallback] = useState<{ email: string; url: string } | null>(null);
  const endpoint = `${API_BASE_URL}/api/shoots/${encodeURIComponent(shootId)}/guest-shares`;

  useEffect(() => {
    const requests = pending.current;
    return () => { generation.current += 1; requests.forEach(controller => controller.abort()); clearTimeout(copyTimer.current); };
  }, []);
  const request = useCallback(async (url: string, method = 'GET', body?: object) => {
    const controller = new AbortController(); pending.current.add(controller);
    try {
      const response = await fetch(url, { method, credentials: 'include', cache: 'no-store', signal: controller.signal,
        headers: getApiHeaders(), ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json().catch(() => ({}));
      if (controller.signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
      if (!response.ok) throw new Error(data.message || 'Unable to update sharing. Please try again.');
      return data;
    } finally { pending.current.delete(controller); }
  }, []);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const response = await request(endpoint);
      if (current === generation.current) { setInvitations(response.data ?? []); setNextCursor(response.meta?.next_cursor ?? null); }
    } finally { if (current === generation.current) setLoading(false); }
  }, [endpoint, request]);
  useEffect(() => {
    if (!open) { setCopyFallback(null); return; }
    setError('');
    void refresh().catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to load sharing.'));
  }, [open, refresh]);

  const loadMore = async () => {
    if (nextCursor === null || loadingMore) return;
    const current = generation.current;
    setLoadingMore(true); setError('');
    try {
      const response = await request(`${endpoint}?before_id=${encodeURIComponent(nextCursor)}`);
      if (current !== generation.current) return;
      setInvitations(previous => [...previous, ...(response.data ?? []).filter((item: GuestInvitation) => !previous.some(old => old.id === item.id))]);
      setNextCursor(response.meta?.next_cursor ?? null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load older invitations.'); }
    finally { setLoadingMore(false); }
  };

  const invite = async (emails: string[]): Promise<GuestInviteResult[] | null> => {
    setBusy(true); setError(''); setMessage(''); setResults([]);
    try {
      const response = await request(endpoint, 'POST', { emails });
      const next: GuestInviteResult[] = response.data ?? [];
      setResults(next);
      const sent = next.filter(result => result.outcome === 'sent').length;
      const existing = next.filter(result => result.outcome === 'existing').length;
      const failed = next.filter(result => result.outcome === 'failed').length;
      setMessage([sent && `${sent} Magic Link${sent === 1 ? '' : 's'} sent.`, existing && `${existing} already invited.`, failed && `${failed} could not be sent; retry those recipients below.`].filter(Boolean).join(' '));
      try { await refresh(); }
      catch { setError('Invitations were processed, but the access list could not refresh. Reopen Manage access to reload it.'); }
      return next;
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to send invitations.'); return null; }
    finally { setBusy(false); }
  };
  const manage = async (invitation: GuestInvitation, action: 'revoke' | 'resend') => {
    setBusy(true); setError(''); setMessage(''); setCopyFallback(null);
    try {
      const response = await request(`${endpoint}/${invitation.id}${action === 'resend' ? '/resend' : ''}`, action === 'resend' ? 'POST' : 'DELETE', action === 'resend' ? {} : undefined);
      setInvitations(previous => action === 'revoke'
        ? previous.map(item => item.id === invitation.id ? { ...item, status: 'revoked', revoked_at: new Date().toISOString(), can_copy: false, can_resend: false } : item)
        : response.data?.id ? [response.data, ...previous.filter(item => item.id !== response.data.id)] : previous);
      setMessage(action === 'revoke' ? `Access revoked for ${invitation.email}.` : `Magic Link sent to ${invitation.email}.`);
      try { await refresh(); }
      catch { setError('The change was saved, but the access list could not refresh. Reopen Manage access to reload it.'); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update access.'); }
    finally { setBusy(false); }
  };
  const copy = async (invitation: GuestInvitation) => {
    setBusy(true); setError(''); setCopyFallback(null);
    try {
      const response = await request(`${endpoint}/${invitation.id}/link`);
      const url = response.data?.url;
      if (typeof url !== 'string') throw new Error('This link is unavailable. Send a new invitation.');
      try {
        await navigator.clipboard.writeText(url);
        setCopiedId(invitation.id); clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopiedId(null), 2000);
      } catch { setCopyFallback({ email: invitation.email, url }); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to copy this link.'); }
    finally { setBusy(false); }
  };
  return { invitations, results, loading, loadingMore, hasMore: nextCursor !== null, busy, message, error, copiedId, copyFallback, invite, manage, copy, loadMore };
}
