import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE_URL } from '@/config/env';
import { getStoredAuthToken } from '@/utils/authToken';

type Controls = { enabled: boolean; allow_changes: boolean; listing_url: string; features: Record<string, boolean> };
type Feature = { key: string; label: string; description: string };
type Configuration = { settings: Controls; version: string; can_manage: boolean; features: Feature[];
  connection_url: string; connection_mode: 'listing' | 'setup'; mcp_url: string };
type Connection = { id: string; name: string; scopes: string; created_at: string };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/copilot/${path}`, { ...init,
    headers: { Authorization: `Bearer ${getStoredAuthToken()}`, Accept: 'application/json',
      'Content-Type': 'application/json', ...init.headers } });
  const data = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(data.message || 'Copilot controls could not be loaded.');
  return data;
}

export function CopilotIntegration() {
  const { isImpersonating } = useAuth();
  const [config, setConfig] = useState<Configuration | null>(null);
  const [draft, setDraft] = useState<Controls | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionError, setConnectionError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const editable = !!config?.can_manage && !isImpersonating;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(config?.settings);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const result = await request<{ data: Configuration }>('settings', { signal });
      setConfig(result.data); setDraft(result.data.settings);
    } catch (reason) {
      if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message);
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    void request<{ data: Connection[] }>('oauth/connections', { signal: controller.signal })
      .then(data => setConnections(data.data)).catch((reason: Error) => {
        if (reason.name !== 'AbortError') setConnectionError(reason.message);
      });
    return () => controller.abort();
  }, [load]);
  async function save() {
    if (!draft || !config) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await request<{ data: Configuration }>('settings', { method: 'PUT', body: JSON.stringify({ ...draft, version: config.version }) });
      setConfig(result.data); setDraft(result.data.settings);
      setNotice('Copilot controls saved. Refresh Repro in ChatGPT to update its available tools.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Save failed.'); }
    finally { setSaving(false); }
  }
  async function revoke(id: string) {
    setRevoking(id); setConnectionError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/copilot/oauth/connections/${id}`, { method: 'DELETE',
        headers: { Authorization: `Bearer ${getStoredAuthToken()}`, Accept: 'application/json' } });
      if (!response.ok) throw new Error('Could not revoke this connection.');
      setConnections(current => current.filter(item => item.id !== id));
    } catch (reason) { setConnectionError(reason instanceof Error ? reason.message : 'Revoke failed.'); }
    finally { setRevoking(null); }
  }
  const destination = config?.connection_url;
  const safeDestination = destination && /^https:\/\/chatgpt\.com\/(?:plugins|apps|connectors)(?:\/[A-Za-z0-9_-]+\/?|\/?$)$/.test(destination);
  return <Card>
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Repro Copilot</CardTitle>
        <CardDescription className="mt-2">Control how ChatGPT can work with Repro.</CardDescription></div>
      {draft && <div className="flex items-center gap-3"><Label htmlFor="copilot-enabled">{draft.enabled ? 'Enabled' : 'Off'}{dirty ? ' (unsaved)' : ''}</Label>
        <Switch id="copilot-enabled" aria-label="Enable Repro Copilot" checked={draft.enabled} disabled={!editable || saving}
          onCheckedChange={enabled => setDraft({ ...draft, enabled })} /></div>}
    </div></CardHeader>
    <CardContent className="space-y-6">
      {loading && <p role="status">Loading Copilot controls…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error} <Button size="sm" variant="outline" onClick={() => void load()}>Reload controls</Button></p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {config && draft && <>
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <p className="font-medium">{connections.length ? 'Your ChatGPT account is connected' : 'Connect your ChatGPT account'}</p>
          <p className="text-sm text-muted-foreground">{config.connection_mode === 'listing'
            ? 'Open the Repro listing in ChatGPT and approve access to your Repro account.'
            : 'A published Repro App Store listing has not been configured yet. Open ChatGPT to add Repro as a custom app.'}</p>
          <div className="flex flex-wrap gap-2">
            {safeDestination && config.settings.enabled && !isImpersonating
              ? <Button asChild><a href={destination} target="_blank" rel="noopener noreferrer">{config.connection_mode === 'listing' ? 'Connect in ChatGPT App Store' : 'Open ChatGPT'}<ExternalLink className="ml-2 h-4 w-4" /></a></Button>
              : <Button disabled>{isImpersonating ? 'Exit impersonation to connect' : 'Enable Copilot to connect'}</Button>}
            <Button asChild variant="outline"><Link to="/copilot/connections">Manage my connections</Link></Button>
          </div>
          {config.connection_mode === 'setup' && <details className="text-sm"><summary className="cursor-pointer">Custom app setup</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5"><li>In ChatGPT Plugins, choose Add custom MCP server.</li>
              <li>Use Repro Copilot as the name, OAuth authentication and the server URL below.</li><li>Create the plugin, then sign into Repro and approve the connection.</li></ol>
            <code className="mt-3 block break-all rounded border bg-background p-2">{config.mcp_url}</code>
            <Button className="mt-2" variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(config.mcp_url)
              .then(() => setNotice('Server URL copied.')).catch(() => setError('Copy failed. Select the displayed URL to copy it.'))}>Copy server URL</Button>
          </details>}
        </div>
        <div className="rounded-lg border p-4 flex items-start justify-between gap-4">
          <div><Label htmlFor="copilot-changes">Allow reviewed changes</Label><p className="mt-1 text-sm text-muted-foreground">Turn off for read-only access. Booking, rescheduling, note changes and watch changes require this control and your confirmation.</p></div>
          <Switch id="copilot-changes" checked={draft.allow_changes} disabled={!editable || saving || !draft.enabled}
            onCheckedChange={allow_changes => setDraft({ ...draft, allow_changes })} />
        </div>
        <div><h3 className="mb-3 font-medium">Enabled features</h3><div className="grid gap-3 md:grid-cols-2">
          {config.features.map(feature => <div key={feature.key} className="rounded-lg border p-4 flex items-start justify-between gap-3">
            <div className="min-w-0"><Label htmlFor={`copilot-${feature.key}`}>{feature.label}</Label><p className="mt-1 text-sm text-muted-foreground">{feature.description}</p></div>
            <Switch id={`copilot-${feature.key}`} checked={draft.features[feature.key]} disabled={!editable || saving || !draft.enabled}
              onCheckedChange={enabled => setDraft({ ...draft, features: { ...draft.features, [feature.key]: enabled } })} />
          </div>)}
        </div></div>
        <p className="flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Account roles, record permissions and action confirmations always apply. Turning Copilot off blocks its tools and pauses watch checks; saved watches resume when enabled.</p>
        {editable && <div className="space-y-2"><Label htmlFor="copilot-listing">Published ChatGPT App Store listing URL</Label>
          <Input id="copilot-listing" type="url" value={draft.listing_url} placeholder="https://chatgpt.com/plugins/your-published-listing" disabled={saving}
            onChange={event => setDraft({ ...draft, listing_url: event.target.value })} />
          <p className="text-xs text-muted-foreground">Paste the official Repro listing link after publication. This makes the connection button open that listing directly.</p></div>}
        {config.can_manage && <div className="flex flex-wrap gap-2"><Button onClick={() => void save()} disabled={!editable || saving || !dirty}>{saving ? 'Saving…' : 'Save Copilot controls'}</Button>
          <Button variant="outline" disabled={saving || !dirty} onClick={() => { setDraft(config.settings); setError(''); }}>Discard changes</Button></div>}
        {!config.can_manage && <p className="text-sm text-muted-foreground">An integration administrator manages these controls. You can manage your own connections below.</p>}
        {isImpersonating && <p role="alert" className="text-sm text-destructive">Exit impersonation before changing controls, connecting or revoking access.</p>}
        <div className="border-t pt-5 space-y-3"><h3 className="font-medium">Your connections</h3>
          {connectionError && <p role="alert" className="text-sm text-destructive">{connectionError}</p>}
          {!connections.length && !connectionError && <p className="text-sm text-muted-foreground">No active ChatGPT connections for your Repro account.</p>}
          {connections.map(connection => <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div><p className="font-medium">{connection.name}</p><p className="text-xs text-muted-foreground">Connected {new Date(connection.created_at).toLocaleDateString()} · {connection.scopes.split(' ').map(scope => scope.replace('repro.', '')).join(' · ')}</p></div>
            <Button variant="outline" size="sm" disabled={!!revoking || isImpersonating} onClick={() => void revoke(connection.id)}>{revoking === connection.id ? 'Revoking…' : 'Revoke access'}</Button>
          </div>)}
        </div>
      </>}
    </CardContent>
  </Card>;
}
