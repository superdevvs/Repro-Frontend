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
  getIsRegistered: () => Promise<boolean>;
  heartbeat: (registered: boolean) => Promise<VoiceBrowserSession>;
  onSession: (session: VoiceBrowserSession) => void;
  onReady: () => void;
  onUnavailable: (message: string) => void;
}

/** Telnyx RegisterAgent has one pending request slot. Serialize all callers,
 * including ready events, polling, and visibility checks, with a deadline. */
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
      let checkedRevision = revision;
      let registered = false;
      let failure = pendingLoss;
      pendingLoss = null;
      if (!failure) {
        try { registered = await bounded(options.getIsRegistered(), 'Phone registration could not be confirmed. Retrying…'); }
        catch { failure = 'Phone registration could not be confirmed. Retrying…'; }
      }
      if (!options.isCurrent()) return;
      if (checkedRevision !== revision) {
        registered = false; failure = pendingLoss || 'Phone connection was lost. Retrying…';
        pendingLoss = null; checkedRevision = revision;
      }
      if (!registered) options.onUnavailable(failure || 'Phone is not registered. Retrying…');
      try {
        const session = await report(registered);
        if (!options.isCurrent()) return;
        if (checkedRevision !== revision) return; // A loss during HTTP must be reported next.
        apply(session);
        if (registered && session.registered && session.status === 'ready') options.onReady();
        else options.onUnavailable(failure || 'Phone is not registered. Retrying…');
      } catch {
        if (!options.isCurrent()) return;
        options.onUnavailable('Could not confirm phone availability with the server. Retrying…');
        // The SDK may be registered while the server cannot accept presence.
        // Mark it unavailable if possible; neither request can block polling forever.
        if (registered) {
          try { const session = await report(false); if (checkedRevision === revision) apply(session); }
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
