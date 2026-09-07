import { useEffect, useRef, useState } from 'react';
import { DOWNLOAD_URL_REVOKE_DELAY_MS } from '@/utils/shootDownloadTransfer';

const releaseDownloadedUrl = (url: string) => {
  // The anchor may just have been clicked when the popup closes or unmounts.
  // Give the browser time to consume the local Blob before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_REVOKE_DELAY_MS);
};

/** Own download locks and the selected ZIP URL across rerenders and unmounts. */
export function useShootMediaDownloadState() {
  const mounted = useRef(true);
  const batchActive = useRef(false);
  const activeFiles = useRef(new Set<string>());
  const popupUrl = useRef<string | null>(null);
  const [downloadingFileIds, setDownloadingFileIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (popupUrl.current) releaseDownloadedUrl(popupUrl.current);
      popupUrl.current = null;
    };
  }, []);

  const beginFileDownload = (fileId: string) => {
    if (activeFiles.current.has(fileId)) return false;
    activeFiles.current.add(fileId);
    if (mounted.current) setDownloadingFileIds(new Set(activeFiles.current));
    return true;
  };

  const finishFileDownload = (fileId: string) => {
    activeFiles.current.delete(fileId);
    if (mounted.current) setDownloadingFileIds(new Set(activeFiles.current));
  };

  const beginBatchDownload = () => {
    if (batchActive.current) return false;
    batchActive.current = true;
    return true;
  };

  const finishBatchDownload = () => { batchActive.current = false; };

  const clearPopupUrl = (expectedUrl?: string | null) => {
    if (expectedUrl !== undefined && expectedUrl !== popupUrl.current) return;
    if (popupUrl.current) releaseDownloadedUrl(popupUrl.current);
    popupUrl.current = null;
  };

  const keepPopupUrl = (url: string) => {
    clearPopupUrl();
    if (!mounted.current) {
      URL.revokeObjectURL(url);
      return false;
    }
    popupUrl.current = url;
    return true;
  };

  return {
    downloadingFileIds, beginFileDownload, finishFileDownload,
    beginBatchDownload, finishBatchDownload, clearPopupUrl, keepPopupUrl,
  };
}
