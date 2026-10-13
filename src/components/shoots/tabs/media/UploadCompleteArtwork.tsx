import { useId, useMemo } from 'react';
import photos from './uploadCompletePhotos.svg?raw';
import './uploadCompleteArtwork.css';

/** The three photo layers from the approved artwork; no illustration during transfer. */
export function UploadCompleteArtwork({ animate }: { animate: boolean }) {
  const instance = useId().replace(/:/g, '');
  const artwork = useMemo(() => photos
    .replace(/id="([^"]+)"/g, (_, id: string) => `id="upload-${instance}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#upload-${instance}-${id})`), [instance]);
  return <div className={`upload-complete-art ${animate ? 'upload-complete-art-playing' : ''}`} aria-hidden="true">
    <div className="upload-complete-window"><div className="upload-complete-photos" dangerouslySetInnerHTML={{ __html: artwork }} /></div>
    <span className="upload-complete-flash" />
    <svg className="upload-complete-tick" viewBox="0 0 22 22"><circle cx="11" cy="11" r="9" /><path d="m6.5 11 3 3 6-6" /></svg>
  </div>;
}
