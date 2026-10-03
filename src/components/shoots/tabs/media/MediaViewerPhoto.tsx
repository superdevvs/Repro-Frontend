import type { useMediaViewerController } from './useMediaViewerController';
export function MediaViewerPhoto({ model }: { model: NonNullable<ReturnType<typeof useMediaViewerController>> }) {
  const { currentFile, imageUrl, imageStatus, displayFilename, fitMediaClassName, handleStageImageError, zoom, zoomedImageViewportStyle } = model;
  const photo = <img key={`${currentFile.id}:${imageUrl}`} src={imageUrl || undefined} alt={displayFilename}
    className={fitMediaClassName} loading="eager" decoding="async" draggable={false} onError={handleStageImageError} />;
  return <>
    {imageStatus && <div role="status" className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-full bg-black/75 px-3 py-1.5 text-xs text-white">{imageStatus}</div>}
    {zoom > 1 ? <div className="relative flex shrink-0 items-center justify-center" style={zoomedImageViewportStyle}>{photo}</div> : photo}
  </>;
}
