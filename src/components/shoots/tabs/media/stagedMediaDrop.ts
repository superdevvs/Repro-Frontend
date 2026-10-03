import { useEffect, useRef } from 'react';

export interface StagedMediaDrop { files: File[]; type: 'raw' | 'edited'; }

export function readDroppedMedia(transfer: DataTransfer): File[] {
  const files = Array.from(transfer.files || []);
  if (files.length) return files;
  return Array.from(transfer.items || []).filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile()).filter((file): file is File => file !== null);
}

/** Consume a parent-staged batch once, including under StrictMode effect replay. */
export function useStagedMediaDrop(batch: StagedMediaDrop | undefined, addFiles: (files: File[]) => void, onConsumed?: () => void) {
  const consumed = useRef<StagedMediaDrop>();
  useEffect(() => {
    if (!batch || consumed.current === batch) return;
    consumed.current = batch;
    addFiles(batch.files);
    onConsumed?.();
  }, [batch, addFiles, onConsumed]);
}
