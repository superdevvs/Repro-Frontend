import type { useMediaViewerController } from './useMediaViewerController';
import { DecodedViewerImage } from './DecodedViewerImage';
import { MediaViewerImageStatus } from './MediaViewerImageStatus';
export function MediaViewerPhoto({ model }: { model: NonNullable<ReturnType<typeof useMediaViewerController>> }) {
  const { imageElement, imageStatus, imageLoading, displayFilename, fitMediaClassName, zoom, zoomedImageViewportStyle } = model;
  const photo = <DecodedViewerImage image={imageElement} filename={displayFilename} className={fitMediaClassName} />;
  return <>
    <MediaViewerImageStatus message={imageStatus} loading={imageLoading} />
    {zoom > 1 ? <div className="relative flex shrink-0 items-center justify-center" style={zoomedImageViewportStyle}>{photo}</div> : photo}
  </>;
}
