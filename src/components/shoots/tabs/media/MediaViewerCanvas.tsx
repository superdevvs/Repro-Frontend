import { ChevronLeft, ChevronRight, FileIcon, Play } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { isRawFile } from '@/services/rawPreviewService';
import VideoThumbnail from '../../VideoThumbnail';
import { getMediaVideoPreviewUrl, getMediaVideoUrl } from './mediaPreviewUtils';
import { MediaViewerPhoto } from './MediaViewerPhoto';
import { MediaViewerZoomControls } from './MediaViewerControls';
import { useViewerSwipe } from './useViewerSwipe';
import type { MediaViewerModel } from './MediaViewerActions';

export function MediaViewerCanvas({ model, controlsInHeader = false }: { model: MediaViewerModel; controlsInHeader?: boolean }) {
  const { zoom, zoomStageRef, isPanningZoomStage, handlePrevious, handleNext, currentIndex, files, currentFile,
    isImg, isVid, videoUrl, videoUrlCandidates, setVideoSourceIndex, fitMediaClassName, displayFilename } = model;
  const swipe = useViewerSwipe(zoom <= 1 && isImg, handlePrevious, handleNext);
  const activeThumbnail = useRef<HTMLButtonElement>(null);
  useEffect(() => { activeThumbnail.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }, [currentIndex]);
  return <section className="media-viewer-canvas" data-controls-in-header={controlsInHeader} aria-label="Media preview">
    <div className="media-viewer-stage-wrap">
      {currentFile.is_hidden && <span className="media-viewer-media-label" data-hidden="true">Hidden image</span>}
      <div ref={zoomStageRef} {...swipe} className={`media-viewer-stage ${zoom > 1 ? `${isPanningZoomStage ? 'cursor-grabbing' : 'cursor-grab'} touch-none overflow-auto` : 'overflow-hidden touch-pan-y'}`}
        onPointerDown={model.handleZoomStagePointerDown} onPointerMove={model.handleZoomStagePointerMove} onPointerUp={model.handleZoomStagePointerUp} onPointerCancel={model.handleZoomStagePointerUp} onLostPointerCapture={() => model.stopZoomPan()}>
        {isImg ? <MediaViewerPhoto model={model} /> : isVid ? videoUrl ? <video key={`${currentFile.id}-${videoUrl}`} src={videoUrl} controls playsInline preload="metadata" className={`${fitMediaClassName} bg-black`} onError={() => setVideoSourceIndex(current => Math.min(current + 1, videoUrlCandidates.length - 1))} /> : <div className="media-viewer-unavailable"><FileIcon /><p>Video preview is not available.</p></div> : <div className="media-viewer-unavailable"><FileIcon /><p>{displayFilename}</p></div>}
      </div>
      {currentIndex > 0 && <Button variant="ghost" size="icon" className="media-viewer-arrow media-viewer-previous" aria-label="Previous photo" onClick={handlePrevious}><ChevronLeft /></Button>}
      {currentIndex < files.length - 1 && <Button variant="ghost" size="icon" className="media-viewer-arrow media-viewer-next" aria-label="Next photo" onClick={handleNext}><ChevronRight /></Button>}
    </div>
    {!controlsInHeader && <div className="media-viewer-controls"><MediaViewerZoomControls model={model} inline /></div>}
    <div className="media-viewer-filmstrip">
      <div className="media-viewer-filmstrip-title"><span>All media</span><span>{currentIndex + 1} / {files.length}</span></div>
      <div className="media-viewer-thumbnails" aria-label="Choose media">
        {files.map((file, index) => {
          const imageUrl = model.getImageUrl(file, 'thumb');
          const isVideo = model.isVideoFile(file);
          const videoThumbUrl = isVideo ? getMediaVideoUrl(file) || getMediaVideoPreviewUrl(file) : '';
          const hasThumb = isRawFile(file.filename) ? Boolean(file.thumbnail_path || file.web_path) : Boolean(imageUrl && (model.isImageFile(file) || isVideo));
          return <button type="button" key={file.id} aria-label={`View ${file.filename}`} aria-current={index === currentIndex ? 'true' : undefined} onClick={() => { model.onIndexChange(index); model.setZoom(1); }} ref={index === currentIndex ? activeThumbnail : undefined}>
            {hasThumb && imageUrl ? <img src={imageUrl} loading="lazy" decoding="async" alt="" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} /> : isVideo && videoThumbUrl ? <VideoThumbnail src={videoThumbUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <FileIcon className="h-5 w-5 text-white/45" />}
            {isVideo && <Play className="absolute h-4 w-4 fill-white text-white drop-shadow-lg" />}
            <span>{String(index + 1).padStart(2, '0')}</span>
          </button>;
        })}
      </div>
    </div>
  </section>;
}
