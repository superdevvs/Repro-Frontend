// Uploads hold File objects and requests in memory. Automatic full-page
// navigation destroys both, even when the browser suppresses beforeunload.
// Register synchronously when a job is queued, before React's next render.
const activeUploads = new Set<string>();
const authChangeAbortCallbacks = new Map<string, () => void>();
const listeners = new Set<() => void>();

const notify = () => { listeners.forEach((listener) => listener()); };

export const protectUploadFromNavigation = (uploadId: string, onAuthChangeAbort?: () => void) => {
  activeUploads.add(uploadId);
  if (onAuthChangeAbort) authChangeAbortCallbacks.set(uploadId, onAuthChangeAbort);
  notify();
};

export const releaseUploadNavigationProtection = (uploadId: string) => {
  activeUploads.delete(uploadId);
  authChangeAbortCallbacks.delete(uploadId);
  notify();
};

export const hasUploadsProtectedFromNavigation = () => activeUploads.size > 0;

export const stopUploadsForAuthChange = () => {
  // Aborting may synchronously remove a job. Snapshot first so every job that
  // used the previous identity is stopped, even if callbacks mutate the map.
  [...authChangeAbortCallbacks.values()].forEach((abort) => {
    try { abort(); } catch { /* Still stop the other jobs. */ }
  });
};

export const subscribeUploadNavigationProtection = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
