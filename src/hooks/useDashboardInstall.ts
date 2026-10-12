import { useSyncExternalStore } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let pendingPrompt: InstallPromptEvent | null = null;
let installed = false;
let revision = 0;
let initialized = false;
const listeners = new Set<() => void>();
const notify = () => { revision += 1; listeners.forEach((listener) => listener()); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function dashboardInstallEnvironment() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = Boolean(window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone);
  return { ios, mobile: ios || /Android/i.test(navigator.userAgent), installed: installed || standalone };
}

// Capture the browser's one-use prompt before React and lazy routes mount.
export function initializeDashboardInstall() {
  if (initialized) return () => undefined;
  initialized = true;
  const capturePrompt = (event: Event) => {
    event.preventDefault();
    pendingPrompt = event as InstallPromptEvent;
    notify();
  };
  const completeInstall = () => { installed = true; pendingPrompt = null; notify(); };
  const standalone = window.matchMedia?.('(display-mode: standalone)');
  window.addEventListener('beforeinstallprompt', capturePrompt);
  window.addEventListener('appinstalled', completeInstall);
  window.addEventListener('pageshow', notify);
  standalone?.addEventListener?.('change', notify);
  return () => {
    window.removeEventListener('beforeinstallprompt', capturePrompt);
    window.removeEventListener('appinstalled', completeInstall);
    window.removeEventListener('pageshow', notify);
    standalone?.removeEventListener?.('change', notify);
    initialized = false; installed = false; pendingPrompt = null; notify();
  };
}

export function useDashboardInstall() {
  useSyncExternalStore(subscribe, () => revision, () => 0);
  return {
    ...dashboardInstallEnvironment(),
    async prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
      const event = pendingPrompt;
      if (!event) return 'unavailable';
      pendingPrompt = null;
      notify();
      try {
        // Start in the click gesture, before awaiting anything else.
        await event.prompt();
        return (await event.userChoice).outcome;
      } catch { return 'unavailable'; }
    },
  };
}
