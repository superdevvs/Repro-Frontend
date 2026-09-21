import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Call, INotification, TelnyxRTC } from '@telnyx/webrtc';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermissions } from '@/context/PermissionsContext';
import { BrowserPhoneContext, type BrowserPhoneActiveCall, type BrowserPhoneContextValue } from '@/context/BrowserPhoneContext';
import * as api from '@/services/voiceBrowser';
import type { VoiceBrowserSession, VoiceBrowserToken } from '@/types/voiceBrowser';
import { useBrowserPhoneActions } from './useBrowserPhoneActions';
import { matchesBrowserOffer } from './browserPhoneIdentity';

const BrowserPhoneBar = lazy(() => import('./BrowserPhoneBar'));

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const TERMINAL = ['hangup', 'destroy', 'purge'];
const errorText = (error: unknown) => error instanceof Error ? error.message : 'The browser phone could not complete this action.';

export function BrowserPhoneProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isImpersonating } = useAuth();
  const { can } = usePermissions();
  const eligible = isAuthenticated && !isImpersonating && can('voice-calls', 'view') && (can('voice-calls', 'operate') || can('voice-calls', 'supervise'));
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ['voice-browser-config', user?.id], queryFn: api.getVoiceBrowserConfig, enabled: eligible, retry: false, refetchInterval: 60000 });
  const [status, setStatus] = useState<BrowserPhoneContextValue['status']>('disconnected');
  const [session, setSession] = useState<VoiceBrowserSession | null>(null);
  const [active, setActive] = useState<BrowserPhoneActiveCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [inputId, setInputId] = useState('');
  const [outputId, setOutputId] = useState('');
  const rtc = useRef<TelnyxRTC | null>(null);
  const sdkCall = useRef<Call | null>(null);
  const sessionRef = useRef<VoiceBrowserSession | null>(null);
  const activeRef = useRef<BrowserPhoneActiveCall | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const epoch = useRef(0);
  const busyRef = useRef(false);
  const reconciling = useRef(new Set<string>());
  const eligibleRef = useRef(eligible);
  eligibleRef.current = eligible;

  const updateActive = useCallback((next: BrowserPhoneActiveCall | null) => { activeRef.current = next; setActive(next); }, []);
  const updateSession = useCallback((next: VoiceBrowserSession | null) => {
    // JWTs never enter React state, query caches, or browser storage.
    const safe = next ? { id: next.id, device_id: next.device_id, status: next.status, expires_at: next.expires_at, registered: next.registered, offers: next.offers ?? [] } : null;
    sessionRef.current = safe;
    setSession(safe);
  }, []);
  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['voice-calls'] });
    void queryClient.invalidateQueries({ queryKey: ['voice-call'] });
    void queryClient.invalidateQueries({ queryKey: ['voice-browser-call'] });
  }, [queryClient]);

  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    if (busyRef.current) throw new Error('Another phone action is in progress.');
    busyRef.current = true; setBusy(true); setError(null);
    try { return await operation(); }
    catch (cause) { setError(errorText(cause)); throw cause; }
    finally { busyRef.current = false; setBusy(false); }
  }, []);

  const sync = useCallback(async (registered?: boolean) => {
    const current = sessionRef.current;
    const currentEpoch = epoch.current;
    if (!current) return null;
    const next = registered === undefined ? await api.getVoiceBrowserSession(current.id) : await api.heartbeatVoiceBrowserSession(current.id, registered);
    if (sessionRef.current?.id !== current.id || epoch.current !== currentEpoch) return null;
    updateSession(next);
    const live = activeRef.current;
    if (live) {
      const server = await api.getVoiceBrowserCallState(live.offer.voice_call_id);
      if (activeRef.current?.offer.agent_call_control_id === live.offer.agent_call_control_id) {
        if (['ended', 'failed'].includes(server.state)) {
          const terminalCall = sdkCall.current;
          sdkCall.current = null; updateActive(null); invalidate();
          await terminalCall?.hangup().catch(() => undefined);
          return next;
        }
        updateActive({ ...activeRef.current, server, held: server.held ?? live.held, muted: Boolean(server.muted || sdkCall.current?.isAudioMuted) });
      }
    }
    return next;
  }, [invalidate, updateActive, updateSession]);

  const playAudio = useCallback(async () => {
    if (!audio.current?.srcObject) return;
    try { await audio.current.play(); setPlaybackBlocked(false); }
    catch { setPlaybackBlocked(true); }
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!rtc.current) return;
    const [mic, speakers] = await Promise.all([rtc.current.getAudioInDevices(), rtc.current.getAudioOutDevices()]);
    setInputs(mic); setOutputs(speakers);
  }, []);

  const handleNotification = useCallback(async (notification: INotification, connectionEpoch: number) => {
    const call = notification.call;
    if (notification.type !== 'callUpdate' || !call || connectionEpoch !== epoch.current) return;
    const legId = call.telnyxIDs?.telnyxCallControlId;
    if (!legId) return;
    if (TERMINAL.includes(call.state)) {
      if (activeRef.current && matchesBrowserOffer(activeRef.current.offer, legId)) {
        sdkCall.current = null; updateActive(null); setPlaybackBlocked(false); invalidate();
        void sync().catch(() => undefined);
      }
      return;
    }
    if (activeRef.current && matchesBrowserOffer(activeRef.current.offer, legId)) {
      sdkCall.current = call;
      updateActive({ ...activeRef.current, state: call.state, muted: call.isAudioMuted });
      if (call.state === 'active') { void playAudio(); void sync().catch(() => undefined); }
      return;
    }
    if (activeRef.current) { await call.hangup(); return; }
    if (reconciling.current.has(legId)) return;
    reconciling.current.add(legId);
    try {
    // Reconcile the carrier leg with an authenticated, server-owned offer.
    let offer = sessionRef.current?.offers.find((item) => matchesBrowserOffer(item, legId));
    for (let attempt = 0; !offer && attempt < 17; attempt += 1) {
      if (attempt) await wait(500);
      const current = await sync();
      if (connectionEpoch !== epoch.current) return;
      offer = current?.offers.find((item) => matchesBrowserOffer(item, legId));
    }
    if (!offer) { await call.hangup(); setError('An unrecognized phone connection was declined.'); return; }
    if (TERMINAL.includes(call.state) || connectionEpoch !== epoch.current) return;
    if (activeRef.current && !matchesBrowserOffer(activeRef.current.offer, legId)) { await call.hangup(); return; }
    sdkCall.current = call;
    if (offer.mode === 'monitor') call.muteAudio();
    updateActive({ offer, state: call.state, muted: call.isAudioMuted, held: false });
    void sync().catch(() => undefined);
    } catch (cause) {
      if (connectionEpoch === epoch.current) await call.hangup().catch(() => undefined);
      throw cause;
    } finally { reconciling.current.delete(legId); }
  }, [invalidate, playAudio, sync, updateActive]);

  const closeConnection = useCallback(async (revoke = true) => {
    epoch.current += 1;
    const current = sessionRef.current;
    const client = rtc.current;
    rtc.current = null; sdkCall.current = null;
    reconciling.current.clear();
    updateSession(null); updateActive(null); setStatus('disconnected'); setPlaybackBlocked(false);
    if (client) { client.off('telnyx.ready'); client.off('telnyx.notification'); client.off('telnyx.error'); client.off('telnyx.socket.close'); await client.disconnect().catch(() => undefined); }
    if (revoke && current) await api.deleteVoiceBrowserSession(current.id);
  }, [updateActive, updateSession]);

  const connect = useCallback(() => run(async () => {
    if (!eligibleRef.current) throw new Error('You do not have permission to connect a browser phone.');
    if (rtc.current) {
      if (status === 'ready' || activeRef.current) return;
      await closeConnection();
    }
    if (!config.data?.ready || config.isError) throw new Error(config.data?.blockers?.[0] || 'Browser calling is not configured yet.');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Use a browser that supports microphone access over HTTPS.');
    setStatus('connecting');
    const connectionEpoch = ++epoch.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      stream.getTracks().forEach((track) => track.stop());
      if (connectionEpoch !== epoch.current || !eligibleRef.current) return;
      // Separate identity per browser tab/device; only the opaque device ID is stored.
      const storageKey = `repro.voice.device.${user?.id}`;
      let deviceId: string;
      try { deviceId = sessionStorage.getItem(storageKey) || crypto.randomUUID(); sessionStorage.setItem(storageKey, deviceId); }
      catch { deviceId = crypto.randomUUID(); }
      const sdk = await import('@telnyx/webrtc');
      const credential = await api.createVoiceBrowserSession(deviceId);
      if (connectionEpoch !== epoch.current || !eligibleRef.current) { await api.deleteVoiceBrowserSession(credential.id); return; }
      updateSession(credential);
      await wait(Math.max(0, Math.min(credential.registration_delay_ms ?? 0, 10000)));
      if (connectionEpoch !== epoch.current) return;
      const client = new sdk.TelnyxRTC({ login_token: credential.token, debug: false, enableCallReports: false, enableCallRecording: false, hangupOnBeforeUnload: true });
      rtc.current = client;
      if (audio.current) client.remoteElement = audio.current;
      client.on('telnyx.ready', () => {
        if (connectionEpoch !== epoch.current) return;
        void (async () => {
          let registered = await client.getIsRegistered();
          for (let attempt = 0; !registered && attempt < 8 && connectionEpoch === epoch.current; attempt += 1) { await wait(500); registered = await client.getIsRegistered(); }
          if (connectionEpoch !== epoch.current) return;
          if (!registered) throw new Error('The phone could not register. Reconnect to try again.');
          await sync(true);
          if (connectionEpoch !== epoch.current) return;
          setStatus('ready'); setError(null);
          await refreshDevices();
        })().catch((cause) => { if (connectionEpoch === epoch.current) { setError(errorText(cause)); setStatus('error'); } });
      });
      client.on('telnyx.notification', (event: INotification) => { void handleNotification(event, connectionEpoch).catch((cause) => setError(errorText(cause))); });
      client.on('telnyx.error', () => { if (connectionEpoch === epoch.current) { setError('The phone connection failed. Reconnect or check your network.'); setStatus('error'); } });
      client.on('telnyx.socket.close', () => { if (connectionEpoch === epoch.current) { setStatus('reconnecting'); void sync(false).catch(() => undefined); } });
      await client.connect();
    } catch (cause) {
      if (connectionEpoch === epoch.current) { await closeConnection().catch(() => undefined); setStatus('error'); }
      throw cause;
    }
  }), [closeConnection, config.data, config.isError, handleNotification, refreshDevices, run, status, sync, updateSession, user?.id]);

  useEffect(() => {
    if (!eligible) return;
    return () => { void closeConnection().catch(() => undefined); };
  }, [closeConnection, eligible, user?.id]);

  useEffect(() => {
    if (!session?.id) return;
    const timer = window.setInterval(() => {
      void (async () => {
        const registered = status === 'ready' && Boolean(await rtc.current?.getIsRegistered());
        await sync(registered);
        if (!registered && status === 'ready') { setStatus('reconnecting'); setError('Phone registration was lost. Reconnecting…'); }
      })().catch((cause) => setError(errorText(cause)));
    }, 15000);
    return () => window.clearInterval(timer);
  }, [session?.id, status, sync]);

  useEffect(() => {
    const current = sessionRef.current;
    if (!current) return;
    const delay = Math.max(1000, new Date(current.expires_at).getTime() - Date.now() - 120000);
    if (!Number.isFinite(delay)) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        const token: VoiceBrowserToken = await api.refreshVoiceBrowserToken(current.id, current.device_id);
        if (sessionRef.current?.id !== current.id || !rtc.current) return;
        await rtc.current.login({ creds: { login_token: token.token } });
        updateSession(token);
      })().catch(() => { setError('Phone authentication could not be refreshed. Finish this call and reconnect.'); });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [session?.id, session?.expires_at, session?.device_id, updateSession]);

  useEffect(() => {
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
  }, [refreshDevices]);

  const actions = useBrowserPhoneActions({ rtc, sdkCall, sessionRef, activeRef, status, eligible, run, sync, updateActive, invalidate, playAudio, inputId, outputId, setInputId, setOutputId });
  const value: BrowserPhoneContextValue = {
    status, eligible, config: config.isError ? undefined : config.data, configLoading: config.isLoading, session, active, busy,
    error: error || (config.isError ? 'Could not check browser calling readiness.' : null), playbackBlocked, inputs, outputs, inputId, outputId,
    connect, disconnect: () => run(async () => { if (activeRef.current) throw new Error('End or leave the active call before disconnecting.'); await closeConnection(); }),
    playAudio, refreshConfig: () => { void config.refetch(); }, ...actions,
  };
  return <BrowserPhoneContext.Provider value={value}>{children}<audio ref={audio} autoPlay playsInline onPlay={() => setPlaybackBlocked(false)} />{eligible && (session || error || status === 'connecting') && <Suspense fallback={null}><BrowserPhoneBar /></Suspense>}</BrowserPhoneContext.Provider>;
}
