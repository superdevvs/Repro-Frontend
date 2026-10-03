import { useViewerSwipe } from './useViewerSwipe';
import { MediaViewerPreviewSizeControls, MediaViewerZoomControls } from './MediaViewerControls';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { getDisplayMediaFilename } from './mediaPreviewUtils';
import type { useMediaViewerController } from './useMediaViewerController';

export function MediaViewerSlideshow({ model }: { model: NonNullable<ReturnType<typeof useMediaViewerController>> }) {
  const {
    slideshowIndex,
    slideshowDirection,
    slideshowPaused,
    setSlideshowPaused,
    slideshowIntervalSeconds,
    showSlideshowHint,
    waitingForNextSlide,
    handleStageImageError,
    imageStatus,
    zoom,
    zoomStageRef,
    handleZoomStagePointerDown,
    handleZoomStagePointerMove,
    handleZoomStagePointerUp,
    eligibleSlideshowFiles,
    slideshowCurrentImageUrl,
    currentSlideReady,
    isLastSlideshowSlide,
    exitSlideshow,
    handleCycleSlideshowInterval,
    slideshowMotionVariants,
    slideshowCurrentFile,
    handlePrevious,
    handleNext,
  } = model;
  const swipe = useViewerSwipe(zoom <= 1 && model.isImg, handlePrevious, handleNext);
  if (!slideshowCurrentFile) return null;

  return (
    <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 z-20 h-8 w-8 rounded-full border border-white/10 bg-black/40 text-white/85 hover:bg-white/10 sm:right-5 sm:top-5"
        onClick={exitSlideshow}
        title="Exit slideshow"
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="absolute left-4 top-4 z-30"><MediaViewerPreviewSizeControls model={model} /></div>
      <MediaViewerZoomControls model={model} />
      <AnimatePresence>
        {showSlideshowHint && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24 }}
            className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] font-medium tracking-wide text-white/75 backdrop-blur-md sm:top-5"
          >
            ESC to exit slideshow
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(255,255,255,0.08),_transparent_30%)]" />

      <div ref={zoomStageRef} {...swipe} onPointerDown={handleZoomStagePointerDown} onPointerMove={handleZoomStagePointerMove} onPointerUp={handleZoomStagePointerUp} onPointerCancel={handleZoomStagePointerUp} className={`relative flex h-full w-full items-center justify-center bg-black ${zoom > 1 ? 'overflow-auto touch-none cursor-grab' : 'overflow-hidden touch-pan-y'}`}>
        <div className="relative shrink-0" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, margin: 'auto' }}>
        {!slideshowCurrentImageUrl && !currentSlideReady && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/45 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 text-white/70" />
            <p className="text-sm text-white/60">
              {waitingForNextSlide ? 'Loading next image…' : 'Preparing slideshow…'}
            </p>
          </div>
        )}

        {imageStatus && <div role="status" className="absolute top-16 z-30 rounded-full bg-black/70 px-3 py-1 text-xs text-white">{imageStatus}</div>}
        <AnimatePresence initial={false} custom={slideshowDirection}>
          <motion.img
            key={slideshowCurrentFile.id}
            custom={slideshowDirection}
            variants={slideshowMotionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            src={slideshowCurrentImageUrl || undefined}
            alt={getDisplayMediaFilename(slideshowCurrentFile) || slideshowCurrentFile.filename}
            className="absolute inset-0 h-full w-full select-none object-contain"
            draggable={false}
            loading="eager"
            onError={handleStageImageError}
          />
        </AnimatePresence>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-16 sm:pb-20">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-2 text-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-white hover:bg-white/10"
            aria-label="Previous photo" onClick={handlePrevious}
            disabled={slideshowIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-white hover:bg-white/10"
            onClick={() => setSlideshowPaused((current) => !current)}
            disabled={isLastSlideshowSlide}
          >
            {slideshowPaused || isLastSlideshowSlide ? (
              <Play className="h-4 w-4 fill-current" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-white hover:bg-white/10"
            aria-label="Next photo" onClick={handleNext}
            disabled={isLastSlideshowSlide}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="mx-2 min-w-[4.5rem] text-center text-xs font-medium text-white">
            {slideshowIndex + 1} / {eligibleSlideshowFiles.length}
          </div>
          {waitingForNextSlide ? (
            <span className="text-[11px] text-white/55">Loading next…</span>
          ) : isLastSlideshowSlide ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-white/55">End of slideshow</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-2.5 text-[11px] font-medium text-white/75 hover:bg-white/10 hover:text-white"
                onClick={exitSlideshow}
              >
                Close
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-2.5 text-[11px] font-medium text-white/75 hover:bg-white/10 hover:text-white"
              onClick={handleCycleSlideshowInterval}
              title="Change slideshow speed"
            >
              {slideshowIntervalSeconds} sec
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
