import type { useMediaViewerController } from './useMediaViewerController';
import { DecodedViewerImage } from './DecodedViewerImage';
import { MediaViewerImageStatus } from './MediaViewerImageStatus';
export function MediaViewerPhoto({ model }: { model: NonNullable<ReturnType<typeof useMediaViewerController>> }) {
  const { imageElement, imageStatus, imageLoading, displayFilename, fitMediaClassName, zoom, currentFile } = model;
  const aspect = (imageElement?.naturalWidth || currentFile.width || 3) / (imageElement?.naturalHeight || currentFile.height || 2);
  const photo = <DecodedViewerImage image={imageElement} filename={displayFilename} className={fitMediaClassName} />;
  return <>
    <MediaViewerImageStatus message={imageStatus} loading={imageLoading} />
    <div className="media-viewer-photo" style={{ width: `min(${zoom * 100}cqw, ${zoom * 100 * aspect}cqh)`, aspectRatio: aspect }}>{photo}</div>
  </>;
}
