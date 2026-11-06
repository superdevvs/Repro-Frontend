import type { ReactNode } from 'react';
import { CheckCircle2, Circle, Image as ImageIcon, Play } from 'lucide-react';
import type { MediaFile } from '@/hooks/useShootFiles';
import VideoThumbnail from '../../VideoThumbnail';
import { HiddenMediaOverlay } from './HiddenMediaOverlay';
import { MediaTileBadges } from './MediaTileBadges';
import { formatMediaDateTime, formatMediaFileSize, getHiddenMediaClassName, getMediaResolution } from './mediaGridPresentation';
import { getDisplayMediaFilename } from './mediaPreviewUtils';

interface MediaListRowProps {
  file: MediaFile;
  shootAddress?: string;
  selected: boolean;
  canSelect: boolean;
  onSelect: () => void;
  onOpen: () => void;
  previewUrl: string;
  srcSet?: string;
  hasStillPreview: boolean;
  isVideo: boolean;
  videoUrl: string;
  isClient: boolean;
  latestComment?: string;
  scanStatus?: ReactNode;
  actions: ReactNode;
  dragHandle?: ReactNode;
  isDragging?: boolean;
  isExtra?: boolean;
}

/** The same compact card is used for ordinary, extra, and manually sorted files. */
export function MediaListRow({ file, shootAddress, selected, canSelect, onSelect, onOpen, previewUrl, srcSet,
  hasStillPreview, isVideo, videoUrl, isClient, latestComment, scanStatus, actions, dragHandle,
  isDragging = false, isExtra = false }: MediaListRowProps) {
  const filename = getDisplayMediaFilename(file) || file.filename;
  const address = shootAddress?.trim();
  const extension = filename.split('.').pop()?.toUpperCase() || 'FILE';
  const capturedAt = file.captured_at || file.created_at;
  const resolution = getMediaResolution(file);

  return (
    <div
      className={`shoot-media-list-row group rounded-xl border transition-colors hover:bg-muted/40 ${
        file.has_open_request ? 'border-orange-500' : selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card'
      } ${isExtra ? 'opacity-90' : ''} ${isDragging ? 'opacity-60 shadow-lg' : ''}`}
      onClick={onOpen}
    >
      <div className="shoot-media-list-preview relative overflow-hidden rounded-lg bg-muted">
        {hasStillPreview ? (
          <img src={previewUrl} srcSet={srcSet || undefined} sizes="(max-width: 639px) 30vw, 180px" alt={filename}
            className={`absolute inset-0 h-full w-full object-cover ${getHiddenMediaClassName(file)}`}
            loading="lazy" draggable={false}
            onError={event => {
              event.currentTarget.style.display = 'none';
              const fallback = event.currentTarget.parentElement?.querySelector<HTMLElement>('.file-fallback');
              if (fallback) fallback.style.display = 'flex';
            }} />
        ) : isVideo ? (
          <VideoThumbnail src={videoUrl} alt={filename}
            className={`absolute inset-0 z-[1] h-full w-full object-cover ${getHiddenMediaClassName(file)}`} />
        ) : null}
        <div className="file-fallback absolute inset-0 items-center justify-center bg-muted text-muted-foreground"
          style={{ display: !hasStillPreview ? 'flex' : 'none' }}>
          <div className="flex flex-col items-center gap-1">
            {isVideo ? <Play className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
            <span className="text-[9px] font-semibold uppercase tracking-wide">{extension}</span>
          </div>
        </div>
        {isVideo && <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center">
          <span className="rounded-full bg-black/55 p-1.5"><Play className="h-3.5 w-3.5 fill-white text-white" /></span>
        </div>}
        {file.is_hidden && <HiddenMediaOverlay />}
        {canSelect && <button type="button" role="checkbox" aria-label={`Select ${filename}`} aria-checked={selected}
          className="absolute left-0 top-0 z-10 flex h-11 w-11 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          onPointerDown={event => event.stopPropagation()}
          onKeyDown={event => {
            if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); onSelect(); }
          }}
          onClick={event => { event.stopPropagation(); onSelect(); }}>
          <span className={`flex h-7 w-7 items-center justify-center rounded-full shadow-sm ${selected ? 'bg-primary text-primary-foreground' : 'bg-black/45 text-white backdrop-blur-sm'}`}>
            {selected ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
          </span>
        </button>}
        {dragHandle && <div className="absolute bottom-1 left-1 z-10">{dragHandle}</div>}
      </div>

      <div className="shoot-media-list-details min-w-0 self-center">
        <button type="button" className="shoot-media-list-title block w-full text-left text-xs font-semibold leading-snug text-foreground outline-none focus-visible:underline sm:text-[13px]"
          title={address || filename} onClick={event => { event.stopPropagation(); onOpen(); }}>
          <span className="line-clamp-2 break-words">{address || filename}</span>
        </button>
        {address && <p className="mt-1 truncate text-[11px] text-muted-foreground" title={filename}>{filename}</p>}
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-4 text-muted-foreground">
          <span>{extension}</span>
          {!isClient && Boolean(file.fileSize) && <span>· {formatMediaFileSize(file.fileSize)}</span>}
          {!isClient && resolution !== '-' && <span>· {resolution}</span>}
        </div>
        {!isClient && capturedAt && <p className="truncate text-[10px] leading-4 text-muted-foreground" title={`Captured ${formatMediaDateTime(capturedAt)}`}>
          {formatMediaDateTime(capturedAt)}
        </p>}
        <div className="shoot-media-list-badges mt-1 flex flex-wrap items-center gap-1 empty:hidden"><MediaTileBadges file={file} variant="list" /></div>
        {scanStatus && <div className="mt-1">{scanStatus}</div>}
        {latestComment && <p className="mt-1 line-clamp-1 text-[10px] leading-4 text-muted-foreground" title={latestComment}>{latestComment}</p>}
      </div>

      <div className="shoot-media-list-actions self-start" onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
        {actions}
      </div>
    </div>
  );
}
