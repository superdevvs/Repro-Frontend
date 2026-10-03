import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/services/api';
import { studioError } from '@/services/studioWorkspaceService';
import { Button } from '@/components/ui/button';

interface Device { id: string; name: string; platform: string; photoshop_detected: boolean; auto_upload: boolean; last_seen_at?: string; expires_at: string }
interface Settings { available: boolean; reason?: string; installers: Record<string, string | null>; devices: Device[] }
interface Pairing { id: string; status: string; name?: string; comparison_code?: string; platform?: string }
export function DesktopEditingSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const load = useCallback(async () => {
    try { const { data } = await apiClient.get<{ data: Settings }>('/desktop-editing'); setSettings(data.data); }
    catch (e) { setError(studioError(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!pairing || pairing.status === 'approved') return;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      apiClient.get<{ data: Pairing }>(`/desktop-editing/pairings/${pairing.id}`, { signal: controller.signal })
        .then(({ data }) => setPairing(data.data)).catch(e => { if (!controller.signal.aborted) { setError(studioError(e)); setPairing(null); } });
    }, 3000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [pairing]);
  const act = async (operation: () => Promise<unknown>) => {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(null);
    try { await operation(); await load(); } catch (e) { setError(studioError(e)); } finally { inFlight.current = false; setBusy(false); }
  };
  const connect = () => act(async () => {
    const { data } = await apiClient.post<{ data: { id: string; launch_url: string } }>('/desktop-editing/pairings');
    setPairing({ id: data.data.id, status: 'waiting' }); window.location.assign(data.data.launch_url);
  });
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const platformLabels: Record<string, string> = { 'win32-x64': 'Windows installer', 'darwin-arm64': 'Mac · Apple Silicon', 'darwin-x64': 'Mac · Intel' };
  return <section className="space-y-6 rounded-xl border p-5">
    <div><h2 className="text-lg font-semibold">Desktop editing</h2><p className="mt-1 text-sm text-muted-foreground">Use Photoshop on your computer and return edits to the same gallery image. Previous versions are retained.</p></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!settings && <p role="status">Checking helper availability…</p>}
    {settings && <>
      {!settings.available ? <div className="rounded-lg bg-muted p-4"><p className="font-medium">Helper release pending</p><p className="mt-1 text-sm">{settings.reason}</p><p className="mt-2 text-sm">For now, download an edited image, edit it in Photoshop, export JPEG, PNG or TIFF, then choose Versions / upload saved edit from its image menu.</p></div>
        : <div className="space-y-3"><p className="text-sm">Install RePro Edit Helper, then connect this computer. Normal operating-system installation confirmations apply.</p>
          <div className="flex flex-wrap gap-2">{Object.entries(platformLabels).filter(([platform]) => isMac ? platform.startsWith('darwin') : platform === 'win32-x64').map(([platform, label]) => {
            const url = settings.installers[platform]; return url && /^https:\/\//.test(url) ? <Button asChild key={platform} variant="outline"><a href={url}>{label}</a></Button> : null;
          })}</div>
          <Button disabled={busy} onClick={() => void connect()}>Connect installed helper</Button>
        </div>}
      {pairing && <div className="space-y-3 rounded-lg border p-4"><p>{pairing.status === 'approved' ? 'Device approved. Finish connecting in the helper.' : pairing.status === 'claimed' ? 'Confirm this is your helper installation' : 'Waiting for the installed helper to open…'}</p>
        {pairing.comparison_code && <><p className="text-sm">{pairing.name} · {pairing.platform}</p><p className="text-2xl font-semibold tracking-widest">{pairing.comparison_code}</p><p className="text-sm">Approve only if the same code appears in RePro Edit Helper on your computer.</p>
          {pairing.status !== 'approved' && <Button disabled={busy} onClick={() => void act(async () => {
            await apiClient.post(`/desktop-editing/pairings/${pairing.id}/approve`, { comparison_code: pairing.comparison_code }); setPairing({ ...pairing, status: 'approved' });
          })}>Codes match · approve device</Button>}</>}
      </div>}
      <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-medium">Connected devices</h3><Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}>Refresh status</Button></div>
        {!settings.devices.length && <p className="text-sm text-muted-foreground">No helper devices connected.</p>}
        {settings.devices.map(device => <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{device.name} · {platformLabels[device.platform] ?? device.platform}</p>
          <p className="text-sm text-muted-foreground">{device.photoshop_detected ? 'Photoshop detected' : 'Photoshop not detected yet'} · {device.auto_upload ? 'Auto-upload opted in for new sessions' : 'Manual upload by default'}</p>
          <p className="text-xs text-muted-foreground">{device.last_seen_at ? `Last connected ${new Date(device.last_seen_at).toLocaleString()}` : 'Waiting for first connection'} · Connection expires {new Date(device.expires_at).toLocaleDateString()}</p></div>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void act(() => apiClient.delete(`/desktop-editing/devices/${device.id}`))}>Disconnect device</Button></div>)}
      </div>
      <div className="space-y-2 text-sm"><h3 className="font-medium">Save and upload preferences</h3><p>Manual upload is the default. Enable Auto-upload on save in the helper for each image, or opt in for new sessions. Only files in that session’s working folder are watched.</p>
        <p>For a layered PSD, use Photoshop’s export command to create JPEG, PNG or TIFF. If Save As creates a file elsewhere, use Export file in the helper to select it.</p></div>
      <details className="space-y-2 text-sm"><summary className="cursor-pointer font-medium">Troubleshooting</summary><p>If Photoshop is missing, use Choose Photoshop in the helper. If the application link does not open, reinstall the correct platform installer. For expired sessions, reopen the image from the dashboard; unsent working files remain on your computer.</p><p>Offline saves stay queued. A newer gallery edit pauses publication and can be resolved with Replace latest or Save as copy in the image’s version history.</p></details>
    </>}
  </section>;
}
