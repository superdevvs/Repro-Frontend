import type { VoiceBrowserSession } from '@/types/voiceBrowser';

export const PHONE_PRESENCE_TIMEOUT_MS = 5000;

function bounded<T>(operation: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), PHONE_PRESENCE_TIMEOUT_MS);
    operation.then(resolve, reject).finally(() => window.clearTimeout(timer));
  });
}

interface PresenceOptions {
  isCurrent: () => boolean;
  getTransportConnected: () => boolean;
  heartbeat: (transportConnected: boolean) => Promise<VoiceBrowserSession>;
  onSession: (session: VoiceBrowserSession) => void;
  onReady: () => void;
  onUnavailable: (message: string) => void;
}

/** Presence is confirmed by the server's carrier lookup. The browser supplies
 * only current authenticated transport state; serialize all checks and losses. */
export function createBrowserPhonePresence(options: PresenceOptions) {
  let inFlight: Promise<void> | null = null;
  let revision = 0;
  let pendingLoss: string | null = null;
  const report = (registered: boolean) => bounded(options.heartbeat(registered), 'The availability update timed out.');
  const apply = (session: VoiceBrowserSession) => { if (options.isCurrent()) options.onSession(session); };

  const check = (): Promise<void> => {
    if (inFlight) return inFlight;
    if (!options.isCurrent()) return Promise.resolve();
    inFlight = (async () => {
      const checkedRevision = revision;
      const failure = pendingLoss;
      pendingLoss = null;
      const connected = !failure && options.getTransportConnected();
      if (!connected) options.onUnavailable(failure || 'Phone connection is not ready. Retrying…');
      try {
        const session = await report(connected);
        if (!options.isCurrent()) return;
        if (checkedRevision !== revision) return; // A loss during HTTP must be reported next.
        if (connected && !options.getTransportConnected()) {
          pendingLoss = 'Phone connection was lost. Retrying…';
          options.onUnavailable(pendingLoss);
          return;
        }
        const ready = connected && session.registered && session.status === 'ready';
        apply({ ...session, registered: ready });
        if (ready) options.onReady();
        else options.onUnavailable(failure || 'Carrier registration is not confirmed. Retrying…');
      } catch {
        if (!options.isCurrent()) return;
        options.onUnavailable('Could not confirm phone availability with the server. Retrying…');
        // The transport may be open while the server cannot confirm presence.
        // Mark it unavailable if possible; neither request can block polling forever.
        if (connected) {
          try { const session = await report(false); if (checkedRevision === revision) apply({ ...session, registered: false }); }
          catch { /* The next bounded check retries; the UI remains unavailable. */ }
        }
      }
    })().finally(() => {
      inFlight = null;
      if (pendingLoss && options.isCurrent()) void check();
    });
    return inFlight;
  };

  return {
    check,
    lost(message: string) {
      if (!options.isCurrent()) return Promise.resolve();
      revision += 1; pendingLoss = message;
      options.onUnavailable(message);
      return check();
    },
  };
}
