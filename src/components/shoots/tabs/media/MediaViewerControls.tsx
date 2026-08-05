import { Button } from '@/components/ui/button';
import { MAX_MEDIA_VIEWER_ZOOM } from './mediaViewerTypes';
import type { useMediaViewerController } from './useMediaViewerController';

type MediaViewerModel = NonNullable<ReturnType<typeof useMediaViewerController>>;

export function MediaViewerPreviewSizeControls({ model }: { model: MediaViewerModel }) {
  const { isImg, previewMode, setPreviewMode, canViewFullSize, fullSizeAvailable } = model;
  const renderPreviewSizeControls = (
    wrapperClassName = '',
    groupClassName = '',
  ) => isImg ? (
    <div className={`flex min-w-0 max-w-full overflow-x-auto rounded-xl ${wrapperClassName}`}>
      <div className={`ml-auto flex w-max items-center gap-1 rounded-xl border border-white/10 bg-black/55 p-1 text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-md ${groupClassName}`}>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 shrink-0 whitespace-nowrap rounded-lg px-2.5 text-[11px] text-white hover:bg-white/15 sm:h-8 sm:text-xs ${
            previewMode === 'web' ? 'bg-blue-600 text-white hover:bg-blue-600' : ''
          }`}
          onClick={() => setPreviewMode('web')}
          title="Use web-sized preview"
        >
          Web size
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 shrink-0 whitespace-nowrap rounded-lg px-2.5 text-[11px] text-white hover:bg-white/15 sm:h-8 sm:text-xs ${
            previewMode === 'full' ? 'bg-blue-600 text-white hover:bg-blue-600' : ''
          }`}
          onClick={() => setPreviewMode('full')}
          disabled={!canViewFullSize || !fullSizeAvailable}
          title={
            canViewFullSize && fullSizeAvailable
              ? 'Use full-size preview'
              : 'Full-size preview unavailable'
          }
        >
          Full size
        </Button>
      </div>
    </div>
  ) : null;

  return renderPreviewSizeControls('hidden md:flex md:justify-self-end');
}

export function MediaViewerZoomControls({ model }: { model: MediaViewerModel }) {
  const { isImg, previewMode, setPreviewMode, canViewFullSize, fullSizeAvailable, handleZoomOut, zoom, handleZoomIn, handleResetZoom } = model;
  const zoomControls = isImg ? (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-40 flex justify-center sm:bottom-4">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/60 p-1 text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <div className="flex shrink-0 items-center gap-1 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 shrink-0 whitespace-nowrap rounded-lg px-2 text-xs text-white hover:bg-white/15 ${
              previewMode === 'web' ? 'bg-blue-600 text-white hover:bg-blue-600' : ''
            }`}
            onClick={() => setPreviewMode('web')}
            title="Use web-sized preview"
          >
            Web
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 shrink-0 whitespace-nowrap rounded-lg px-2 text-xs text-white hover:bg-white/15 disabled:opacity-45 ${
              previewMode === 'full' ? 'bg-blue-600 text-white hover:bg-blue-600' : ''
            }`}
            onClick={() => setPreviewMode('full')}
            disabled={!canViewFullSize || !fullSizeAvailable}
            title={
              canViewFullSize && fullSizeAvailable
                ? 'Use full-size preview'
                : 'Full-size preview unavailable'
            }
          >
            Full
          </Button>
        </div>
        <span className="h-5 w-px shrink-0 bg-white/10 md:hidden" aria-hidden />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg text-white hover:bg-white/15"
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          title="Zoom out (-)"
        >
          <span className="text-sm">−</span>
        </Button>
        <span className="min-w-[3rem] shrink-0 rounded-md bg-white/5 px-2 py-1 text-center text-xs font-medium text-white">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg text-white hover:bg-white/15"
          onClick={handleZoomIn}
          disabled={zoom >= MAX_MEDIA_VIEWER_ZOOM}
          title="Zoom in (+)"
        >
          <span className="text-sm">+</span>
        </Button>
        <span className="mx-1 h-5 w-px shrink-0 bg-white/10" aria-hidden />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 whitespace-nowrap rounded-lg px-2.5 text-xs text-white hover:bg-white/15"
          onClick={handleResetZoom}
          title="Reset zoom (0)"
        >
          Reset
        </Button>
      </div>
    </div>
  ) : null;
  return zoomControls;
}

