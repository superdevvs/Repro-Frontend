import { useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'repro.home-screen-prompt.login-deadline';
const SUPPRESSED_KEY = 'repro.home-screen-prompt.suppressed';
const CHANGE_EVENT = 'repro:home-screen-prompt-changed';
let memoryDeadline = 0;
let memoryOnly = false;
let memorySuppressed: boolean | null = null;

function isSuppressed() {
  if (typeof window === 'undefined') return false;
  if (memorySuppressed !== null) return memorySuppressed;
  try { return localStorage.getItem(SUPPRESSED_KEY) === '1'; }
  catch { return false; }
}

function savedDeadline() {
  if (typeof window === 'undefined') return 0;
  if (memoryOnly) return memoryDeadline;
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch { return memoryDeadline; }
}

function persistDeadline(deadline: number) {
  if (typeof window === 'undefined') return;
  memoryDeadline = deadline;
  try {
    if (deadline) localStorage.setItem(STORAGE_KEY, String(deadline));
    else localStorage.removeItem(STORAGE_KEY);
    memoryOnly = false;
  } catch { memoryOnly = true; }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Called only by successful sign-in, never by restored auth or page navigation. */
export function startDashboardInstallSuggestion() {
  persistDeadline(isSuppressed() ? 0 : Date.now() + 30_000);
}

/** A deliberate click or close opts this browser out across future logins. */
export function suppressDashboardInstallSuggestion() {
  try { localStorage.setItem(SUPPRESSED_KEY, '1'); memorySuppressed = null; }
  catch { memorySuppressed = true; }
  persistDeadline(0);
}

export function dismissDashboardInstallSuggestion(expectedDeadline?: number) {
  // A timer from a previous login must not dismiss a newer login's suggestion.
  if (expectedDeadline !== undefined && savedDeadline() !== expectedDeadline) return;
  persistDeadline(0);
}

function subscribe(listener: () => void) {
  const storageChanged = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === SUPPRESSED_KEY || event.key === null) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', storageChanged);
  window.addEventListener('pageshow', listener);
  document.addEventListener('visibilitychange', listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', storageChanged);
    window.removeEventListener('pageshow', listener);
    document.removeEventListener('visibilitychange', listener);
  };
}

function activeDeadline() {
  if (isSuppressed()) return 0;
  const deadline = savedDeadline();
  return deadline > Date.now() ? deadline : 0;
}

export function useDashboardInstallSuggestion() {
  const deadline = useSyncExternalStore(subscribe, activeDeadline, () => 0);
  useEffect(() => {
    if (!deadline) return;
    const timer = window.setTimeout(() => dismissDashboardInstallSuggestion(deadline), Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(timer);
  }, [deadline]);
  return { visible: deadline > 0, dismiss: suppressDashboardInstallSuggestion };
}
