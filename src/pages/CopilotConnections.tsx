import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '@/config/env';
import { getStoredAuthToken } from '@/utils/authToken';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Connection = { id: string; name: string; scopes: string; created_at: string };
export default function CopilotConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${API_BASE_URL}/api/copilot/oauth/connections`, { signal: controller.signal, headers: { Authorization: `Bearer ${getStoredAuthToken()}`, Accept: 'application/json' } })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Could not load connections.'); return data.data as Connection[]; })
      .then(setConnections).catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  async function disconnect(id: string) {
    setPending(id); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/copilot/oauth/connections/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getStoredAuthToken()}`, Accept: 'application/json' } });
      if (!response.ok) throw new Error('Could not revoke this connection.');
      setConnections(current => current.filter(item => item.id !== id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not revoke connection.'); } finally { setPending(null); }
  }
  return <main className="min-h-screen bg-background p-4 md:p-8"><div className="max-w-2xl mx-auto space-y-5">
    <Link to="/dashboard" className="text-sm underline">Back to dashboard</Link>
    <Card><CardHeader><CardTitle>Connected apps</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Manage ChatGPT connections to your Repro account. Revoking access immediately blocks its plugin tokens.</p>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {loading ? <p role="status">Loading…</p> : connections.length === 0 ? <p>No active connections. Add Repro in ChatGPT to connect your account.</p> : connections.map(connection => <div key={connection.id} className="border-b pb-4 flex flex-wrap justify-between gap-3">
        <div><p className="font-medium">{connection.name}</p><p className="text-sm text-muted-foreground">Connected {new Date(connection.created_at).toLocaleDateString()}</p><p className="text-sm">{connection.scopes.split(' ').map(scope => scope.replace('repro.', '')).join(' · ')}</p></div>
        <Button variant="outline" disabled={pending === connection.id} onClick={() => void disconnect(connection.id)}>{pending === connection.id ? 'Revoking…' : 'Revoke access'}</Button>
      </div>)}
    </CardContent></Card>
  </div></main>;
}
