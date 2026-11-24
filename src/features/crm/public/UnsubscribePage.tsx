import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { publicCrmApi, toApiError } from '../api';
import { Note } from '../ui/primitives';
import { PublicShell } from './PublicShell';
import '../crm.css';

interface State { email: string; unsubscribed: boolean; can_resubscribe: boolean }

/** Unsubscribe page linked from every marketing email (/unsubscribe/:token). */
export default function UnsubscribePage() {
  const { token } = useParams();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ['unsubscribe', token], queryFn: () => publicCrmApi.get<State>(`/unsubscribe/${token}`), retry: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (path: '' | '/resubscribe') => {
    setBusy(true);
    setError(null);
    try {
      client.setQueryData(['unsubscribe', token], await publicCrmApi.post<State>(`/unsubscribe/${token}${path}`));
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicShell>
      <h1 className="text-2xl font-semibold tracking-tight">Email preferences</h1>
      {q.isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {q.isError && <p className="mt-4 text-sm">This link isn’t valid. Reply to any of our emails and we’ll remove you by hand.</p>}
      {q.data && (
        <div className="mt-4 flex flex-col gap-4">
          {q.data.unsubscribed ? (
            <>
              <Note tone="ok"><b>{q.data.email}</b> won’t get marketing email from R/E Pro Photos. You’ll still get messages about shoots you book.</Note>
              {q.data.can_resubscribe && <Button variant="outline" className="self-start" disabled={busy} onClick={() => void act('/resubscribe')}>I changed my mind, resubscribe</Button>}
            </>
          ) : (
            <>
              <p className="text-[15px]">Stop marketing email to <b>{q.data.email}</b>?</p>
              <Button className="self-start" disabled={busy} onClick={() => void act('')}>Unsubscribe</Button>
            </>
          )}
          {error && <Note tone="bad">{error}</Note>}
        </div>
      )}
    </PublicShell>
  );
}
