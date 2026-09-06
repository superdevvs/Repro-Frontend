import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  disconnectStudioDropbox,
  readStudioDropboxStatus,
  startStudioDropboxConnection,
  type StudioDropboxStatus,
} from '@/services/studioDropbox';

export function StudioDropboxConnectionPanel() {
  const { role, isImpersonating } = useAuth();
  const canManage = !isImpersonating && (role === 'admin' || role === 'superadmin');
  const permitted = useRef(canManage);
  permitted.current = canManage;
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const callbackHandled = useRef(false);
  const [status, setStatus] = useState<StudioDropboxStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<'connect' | 'disconnect' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storageLabels: Record<string, string> = { r2: 'Cloudflare R2', r2_only: 'Cloudflare R2', local: 'Local server', dropbox: 'Dropbox' };
  const storageLabel = status?.storage_mode ? storageLabels[status.storage_mode] : null;

  const refresh = useCallback(async () => {
    if (!permitted.current) return;
    setLoading(true);
    setError(null);
    try {
      const nextStatus = await readStudioDropboxStatus();
      if (permitted.current) setStatus(nextStatus);
    } catch {
      if (permitted.current) setError('Dropbox status could not be loaded. Please try again.');
    } finally {
      if (permitted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    localStorage.removeItem('dropbox_access_token');
    if (canManage) void refresh();
    else setStatus(null);
  }, [canManage, refresh]);

  useEffect(() => {
    const result = searchParams.get('dropbox');
    if (!canManage || callbackHandled.current || (result !== 'connected' && result !== 'error')) return;
    callbackHandled.current = true;
    toast(result === 'connected' ? {
      title: 'Dropbox connection completed',
      description: 'The current studio connection is shown below.',
    } : {
      title: 'Dropbox connection incomplete',
      description: 'Start the connection again when ready.',
      variant: 'destructive',
    });
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('dropbox');
    setSearchParams(nextParams, { replace: true });
  }, [canManage, searchParams, setSearchParams, toast]);

  const connect = async () => {
    if (!permitted.current || pending) return;
    setPending('connect');
    setError(null);
    try {
      const authorizationUrl = await startStudioDropboxConnection();
      if (permitted.current) window.location.assign(authorizationUrl);
    } catch {
      setError('Dropbox connection could not be started. Please try again.');
    } finally {
      setPending(null);
    }
  };

  const disconnect = async () => {
    if (!permitted.current || pending || !status?.connection_version) return;
    setPending('disconnect');
    setError(null);
    try {
      const revocationPending = await disconnectStudioDropbox(status.connection_version);
      if (!permitted.current) return;
      toast({
        title: 'Studio Dropbox disconnected',
        description: revocationPending
          ? 'Studio access is disabled. Dropbox token revocation is pending.'
          : 'The studio is no longer connected to Dropbox.',
      });
      await refresh();
    } catch (failure) {
      const code = (failure as { response?: { status?: number } })?.response?.status;
      if (code === 409) {
        await refresh();
        setError('The Dropbox connection changed. Review the current connection before disconnecting.');
      } else {
        setError('Dropbox could not be disconnected. Please refresh and try again.');
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Studio Dropbox</CardTitle>
        <CardDescription>Connect the Dropbox account used for studio photo storage.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canManage ? (
          <p className="text-sm text-muted-foreground">
            {isImpersonating ? 'Return to your administrator account to manage Dropbox.' : 'An administrator manages the studio Dropbox connection.'}
          </p>
        ) : (
          <>
            <div className="space-y-1 text-sm" aria-live="polite">
              <p>{loading ? 'Checking connection…' : status ? (status.connected ? 'Connected' : 'Not connected') : 'Connection status unavailable'}</p>
              {status?.account_label && <p className="text-muted-foreground">{status.account_label}</p>}
              {storageLabel && <p className="text-muted-foreground">Storage: {storageLabel}</p>}
              {status?.revocation_pending && <p className="text-muted-foreground">Studio access is disabled. Dropbox token revocation is pending.</p>}
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void connect()} disabled={loading || pending !== null || status?.revocation_pending}>
                {pending === 'connect' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {status?.connected ? 'Reconnect Dropbox' : 'Connect Dropbox'}
              </Button>
              {(status?.connected || status?.revocation_pending) && <Button type="button" variant="outline" onClick={() => void disconnect()} disabled={loading || pending !== null || !status.connection_version}>{status.revocation_pending ? 'Retry disconnect' : 'Disconnect Dropbox'}</Button>}
              <Button type="button" variant="ghost" onClick={() => void refresh()} disabled={loading || pending !== null}>Refresh status</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
