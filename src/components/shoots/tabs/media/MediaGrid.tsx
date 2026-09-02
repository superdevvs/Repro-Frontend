import React, { useEffect, useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Download, Eye, EyeOff, GripVertical, Heart, Image as ImageIcon, MessageSquare, Play } from 'lucide-react';
import { type MediaFile } from '@/hooks/useShootFiles';
import { isRawFile } from '@/services/rawPreviewService';
import VideoThumbnail from '../../VideoThumbnail';
import { sortMediaFiles } from './mediaSort';
import { MediaTileBadges } from './MediaTileBadges';
import {
  MEDIA_GRID_SIZES_ATTR,
  getDisplayMediaFilename,
  getMediaVideoUrl,
} from './mediaPreviewUtils';
import { buildMediaStacks, type MediaStack } from './mediaGridStacks';
import type { MediaGridProps } from './mediaGridTypes';
import { SortableMediaItem } from './SortableMediaItem';
import { useMediaGridDragAndDrop } from './useMediaGridDragAndDrop';
import { useMediaGridActions } from './useMediaGridActions';
import {
  formatMediaDateTime,
  formatMediaFileSize,
  getGridPreviewMediaClassName,
  getHiddenMediaClassName,
  getMediaResolution,
  hasDisplayableStillThumbnail,
} from './mediaGridPresentation';
import { HiddenMediaOverlay } from './HiddenMediaOverlay';
import { MediaGridLayout } from './MediaGridLayout';

export function MediaGrid({ 
  files, 
  onFileClick, 
  selectedFiles, 
  onSelectionChange,
  onSelectAll,
  canSelect,
  sortOrder = 'time',
  manualSortActive = false,
  manualOrder = [],
  onManualOrderChange,
  getImageUrl,
  getSrcSet,
  isImage,
  isVideo,
  viewMode = 'list',
  isClient = false,
  toggleFileHidden,
  separateExtras = true,
  canInteractSingleMedia = false,
  canDownloadSingleMedia = false,
  onToggleFavorite,
  onAddComment,
  onDownloadSingle,
  enableRawStacks = false,
  rawStackSize = null,
  renderScanStatus,
}: MediaGridProps) {
  // Choosing Manual in the sort menu arms this in one action - there is no second
  // toggle to find. It can then be switched off while the grid stays in manual
  // order, so stopping a drag session does not discard the arrangement.
  const isManualSortEnabled = sortOrder === 'manual' && manualSortActive;
  const [stackPreviewIndexes, setStackPreviewIndexes] = useState<Record<string, number>>({});
  const [hoveredStackId, setHoveredStackId] = useState<string | null>(null);

  // Sort files based on sortOrder, then separate regular and extra files
  const sortedFiles = useMemo(
    () => sortMediaFiles(files, sortOrder, manualOrder),
    [files, manualOrder, sortOrder],
  );

  const draggableIds = useMemo(
    () => (separateExtras ? sortedFiles.filter((file) => !file.isExtra) : sortedFiles).map((file) => file.id),
    [separateExtras, sortedFiles],
  );
  const visibleSorted = sortedFiles;
  const regularFiles = separateExtras ? visibleSorted.filter(f => !f.isExtra) : visibleSorted;
  const extraFiles = separateExtras ? visibleSorted.filter(f => f.isExtra) : [];
  const visibleRegularIds = regularFiles.map((file) => file.id);
  const normalizedRawStackSize =
    typeof rawStackSize === 'number' && Number.isFinite(rawStackSize) && rawStackSize > 1
      ? Math.round(rawStackSize)
      : null;
  const shouldStackRawFiles = enableRawStacks && viewMode === 'grid' && !isManualSortEnabled;

  const regularStacks = useMemo(
    () =>
      buildMediaStacks(regularFiles, {
        shouldStackRawFiles,
        normalizedRawStackSize,
        isVideo,
      }),
    [isVideo, normalizedRawStackSize, regularFiles, shouldStackRawFiles],
  );
  useEffect(() => {
    if (!hoveredStackId) {
      return undefined;
    }

    const hoveredStack = regularStacks.find((stack) => stack.id === hoveredStackId);
    if (!hoveredStack || hoveredStack.files.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setStackPreviewIndexes((current) => {
        const currentIndex = current[hoveredStackId] ?? 0;

        return {
          ...current,
          [hoveredStackId]: (currentIndex + 1) % hoveredStack.files.length,
        };
      });
    }, 850);

    return () => window.clearInterval(intervalId);
  }, [hoveredStackId, regularStacks]);

  const {
    draggedId,
    dragOverId,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleManualSortEnd,
  } = useMediaGridDragAndDrop({
    enabled: isManualSortEnabled,
    visibleRegularIds,
    regularFiles,
    selectedFiles,
    onManualOrderChange,
  });
  const showMultiSortHint = isManualSortEnabled && selectedFiles.size > 1;
  const canDownloadFile = (file: MediaFile) => typeof canDownloadSingleMedia === 'function'
    ? canDownloadSingleMedia(file)
    : canDownloadSingleMedia;
  const {
    getLatestCommentText,
    renderCommentAction,
    renderSingleMediaActions,
  } = useMediaGridActions({
    canInteractSingleMedia,
    canDownloadSingleMedia,
    isClient,
    toggleFileHidden,
    onToggleFavorite,
    onAddComment,
    onDownloadSingle,
  });

  const renderFileCard = (file: MediaFile, index: number, isExtraSection: boolean = false, stack?: MediaStack) => {
    const isSelected = selectedFiles.has(file.id);
    const isImg = isImage(file);
    const isVid = isVideo?.(file) ?? false;
    const isRaw = isRawFile(file.filename);
    // Tiles are 4:3 and render well above 300px, so they take the tuned 600px
    // grid rendition. `srcSet` still offers the 300px file to low-density
    // screens; this is the src a browser without srcSet support falls back to.
    const thumbUrl = getImageUrl(file, 'grid');
    const ext = file.filename.split('.').pop()?.toUpperCase();
    const displayFilename = getDisplayMediaFilename(file) || file.filename;
    const videoThumbSrc = isVid ? (getMediaVideoUrl(file) || getImageUrl(file, 'original')) : '';
    
    // Find the actual index in the full sorted array for viewer
    const actualIndex = sortedFiles.findIndex(f => f.id === file.id);
    
    const isDragging = draggedId === file.id;
    const isDragOver = dragOverId === file.id;
    const latestCommentText = getLatestCommentText(file);
    const stackFiles = stack?.files ?? [file];
    const stackFileIndex = stack ? Math.max(0, stackFiles.findIndex((stackFile) => stackFile.id === file.id)) : 0;
    const hasStack = Boolean(stack && stackFiles.length > 1);
    const stackTotal = stack ? Math.max(stack.expectedSize, stackFiles.length) : 1;
    const sequenceNumber = Number(file.sequence);
    const stackPosition =
      Number.isFinite(sequenceNumber) && sequenceNumber > 0 && sequenceNumber <= stackTotal
        ? sequenceNumber
        : stackFileIndex + 1;
    const changeStackPreview = (direction: 1 | -1, event: React.MouseEvent<HTMLButtonElement>) => {
      if (!stack || stackFiles.length <= 1) {
        return;
      }

      event.stopPropagation();
      setStackPreviewIndexes((current) => {
        const currentIndex = current[stack.id] ?? 0;
        const nextIndex = (currentIndex + direction + stackFiles.length) % stackFiles.length;

        return {
          ...current,
          [stack.id]: nextIndex,
        };
      });
    };
    
    return (
      <div
        key={stack?.id ?? file.id}
        draggable={isManualSortEnabled && !isExtraSection}
        onDragStart={(e) => handleDragStart(e, file.id)}
        onDragOver={(e) => handleDragOver(e, file.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, file.id)}
        onDragEnd={handleDragEnd}
        onMouseEnter={() => {
          if (hasStack && stack) {
            setHoveredStackId(stack.id);
          }
        }}
        onMouseLeave={() => {
          if (stack) {
            setHoveredStackId((current) => (current === stack.id ? null : current));
          }
        }}
        className={`relative rounded-xl overflow-hidden border cursor-pointer transition-all group bg-card flex flex-col ${
          isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'
        } ${isExtraSection ? 'opacity-90' : ''} ${isDragging ? 'opacity-50 scale-95' : ''} ${isDragOver ? 'ring-2 ring-blue-500 border-blue-500' : ''} ${isManualSortEnabled && !isExtraSection ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onClick={() => {
          onFileClick(actualIndex, sortedFiles);
        }}
      >
        <div className="relative aspect-[4/3] bg-muted/40">
        {/* Grid thumbnails use the smallest available size (thumb/placeholder) */}
        {/* No srcSet — avoids browser loading medium/web images for small grid cells */}
        {(() => {
          if (hasStack) {
            return (
              <div
                className="absolute inset-0 z-[1] flex h-full will-change-transform transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${stackFileIndex * 100}%)` }}
              >
                {stackFiles.map((stackFile) => {
                  const stackIsRaw = isRawFile(stackFile.filename);
                  const stackIsVid = isVideo?.(stackFile) ?? false;
                  const stackThumbUrl = getImageUrl(stackFile, 'thumb');
                  const stackDisplayFilename = getDisplayMediaFilename(stackFile) || stackFile.filename;
                  const stackVideoSrc = stackIsVid ? (getMediaVideoUrl(stackFile) || getImageUrl(stackFile, 'original')) : '';
                  const stackThumbSrc = stackThumbUrl || stackFile.thumb || '';
                  const hasProcessedStackThumb = stackIsRaw
                    ? !!(stackFile.thumbnail_path || stackFile.web_path)
                    : true;
                  const hasDisplayableStackImage = hasDisplayableStillThumbnail(
                    stackThumbSrc,
                    stackVideoSrc,
                    stackIsVid,
                    hasProcessedStackThumb,
                  );

                  return (
                    <div key={stackFile.id} className="relative h-full min-w-full bg-muted/40">
                      {stackIsVid && !hasDisplayableStackImage && stackVideoSrc ? (
                        <VideoThumbnail
                          src={stackVideoSrc}
                          alt={stackDisplayFilename}
                          className={`h-full w-full object-cover transition-all duration-200 ${getHiddenMediaClassName(stackFile)}`}
                        />
                      ) : hasDisplayableStackImage ? (
                        <img
                          src={stackThumbSrc}
                          alt={stackDisplayFilename}
                          className={`h-full w-full object-cover transition-all duration-200 ${getHiddenMediaClassName(stackFile)}`}
                          loading="lazy"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }

          const hasProcessedThumb = isRaw 
            ? !!(file.thumbnail_path || file.web_path)
            : true;
          const thumbSrc = thumbUrl || file.thumb || '';
          const hasDisplayableImage = hasDisplayableStillThumbnail(
            thumbSrc,
            videoThumbSrc,
            isVid,
            hasProcessedThumb,
          );
          
          // For videos without a backend thumbnail, generate one client-side
          if (isVid && !hasDisplayableImage) {
            return videoThumbSrc ? (
              <VideoThumbnail
                src={videoThumbSrc}
                alt={file.filename}
                className={`${getGridPreviewMediaClassName(file)} z-[1]`}
              />
            ) : null;
          }
          
            return hasDisplayableImage ? (
              <img
                src={thumbSrc}
                srcSet={getSrcSet?.(file) || undefined}
                sizes={MEDIA_GRID_SIZES_ATTR}
                alt={displayFilename}
                className={getGridPreviewMediaClassName(file)}
                loading="lazy"
                draggable={false}
              onError={(e) => {
                // On error, hide image and show fallback
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.parentElement?.querySelector('.file-fallback') as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null;
        })()}
        
        {/* Fallback placeholder - shown if no thumbnail or on load error */}
        <div 
          className="file-fallback w-full h-full items-center justify-center bg-muted absolute inset-0"
          style={{ display: (() => {
            const hasProcessedThumb = isRaw 
              ? !!(file.thumbnail_path || file.web_path)
              : true;
            const thumbSrc = thumbUrl || file.thumb || '';
            const hasDisplayableImage = hasDisplayableStillThumbnail(
              thumbSrc,
              videoThumbSrc,
              isVid,
              hasProcessedThumb,
            );
            return !hasDisplayableImage ? 'flex' : 'none';
          })() }}
        >
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            {isVid ? <Play className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
            <span className="text-[10px] font-semibold uppercase">{ext || 'FILE'}</span>
          </div>
        </div>

        {/* Video play overlay */}
        {isVid && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 rounded-full p-1.5">
              <Play className="h-5 w-5 text-white fill-white" />
            </div>
          </div>
        )}

        {/* Hidden overlay */}
        {file.is_hidden && <HiddenMediaOverlay />}

        {hasStack && (
          <>
            <div className="absolute bottom-1.5 right-1.5 z-[4] rounded-md border border-white/10 bg-slate-950/85 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm backdrop-blur">
              {stackPosition}/{stackTotal}
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-1.5 right-1.5 z-[4] flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <button
                type="button"
                className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-md transition-transform hover:scale-105"
                onClick={(event) => changeStackPreview(-1, event)}
                aria-label="Previous image in stack"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-md transition-transform hover:scale-105"
                onClick={(event) => changeStackPreview(1, event)}
                aria-label="Next image in stack"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {renderSingleMediaActions(file)}

        <MediaTileBadges file={file} />
        {Number(file.comment_count ?? 0) > 0 && (
          <div className="absolute bottom-2 left-2 bg-white/90 text-slate-900 text-[10px] px-1.5 py-0.5 rounded-full font-medium z-[3] flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {file.comment_count}
          </div>
        )}

        {canSelect && (
          <div 
            className={`absolute z-[3] ${file.isExtra ? 'top-5' : 'top-1'} left-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity`}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelectionChange(file.id)}
              className="bg-background/80"
            />
          </div>
        )}
        </div>
        <div className="px-2 py-2 bg-card">
          <p className="text-[11px] font-medium truncate" title={displayFilename}>
            {displayFilename}
          </p>
          {renderScanStatus && (() => {
            const node = renderScanStatus(file);
            return node ? <div className="mt-1">{node}</div> : null;
          })()}
          {latestCommentText && (
            <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2 max-h-0 opacity-0 group-hover:max-h-10 group-hover:opacity-100 transition-all">
              {latestCommentText}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderStackCard = (stack: MediaStack, index: number) => {
    const previewIndex = stackPreviewIndexes[stack.id];
    const activeFile =
      previewIndex !== undefined && stack.files.length > 0
        ? stack.files[Math.min(Math.max(0, previewIndex), stack.files.length - 1)]
        : stack.coverFile;

    return renderFileCard(activeFile, index, false, stack);
  };

  const renderSortableFileCard = (file: MediaFile, index: number) => {
    const isSelected = selectedFiles.has(file.id);
    const isImg = isImage(file);
    const isVid = isVideo?.(file) ?? false;
    const isRaw = isRawFile(file.filename);
    // Same tile geometry as renderFileCard: 600px rendition, 300px via srcSet.
    const thumbUrl = getImageUrl(file, 'grid');
    const ext = file.filename.split('.').pop()?.toUpperCase();
    const displayFilename = getDisplayMediaFilename(file) || file.filename;
    const videoThumbSrc = isVid ? (getMediaVideoUrl(file) || getImageUrl(file, 'original')) : '';
    const actualIndex = sortedFiles.findIndex(f => f.id === file.id);
    const latestCommentText = getLatestCommentText(file);

    return (
      <SortableMediaItem key={file.id} id={file.id}>
        {({ attributes, listeners, isDragging }) => (
          <div
            className={`relative rounded-xl overflow-hidden border transition-all group select-none bg-card flex flex-col ${
              isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'
            } ${isDragging ? 'opacity-60 scale-95 shadow-xl' : ''}`}
            onClick={() => onFileClick(actualIndex, sortedFiles)}
          >
            <div className="relative aspect-[4/3] bg-muted/40">
            {(() => {
              const hasProcessedThumb = isRaw ? !!(file.thumbnail_path || file.web_path) : true;
              const thumbSrc = thumbUrl || file.thumb || '';
              const hasDisplayableImage = hasDisplayableStillThumbnail(
                thumbSrc,
                videoThumbSrc,
                isVid,
                hasProcessedThumb,
              );

              if (isVid && !hasDisplayableImage) {
                return videoThumbSrc ? (
                  <VideoThumbnail
                    src={videoThumbSrc}
                    alt={file.filename}
                    className={`${getGridPreviewMediaClassName(file)} z-[1]`}
                  />
                ) : null;
              }

              return hasDisplayableImage ? (
                <img
                  src={thumbSrc}
                  srcSet={getSrcSet?.(file) || undefined}
                  sizes={MEDIA_GRID_SIZES_ATTR}
                  alt={displayFilename}
                  className={getGridPreviewMediaClassName(file)}
                  loading="lazy"
                  draggable={false}
                  onDoubleClick={() => onFileClick(actualIndex, sortedFiles)}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.file-fallback') as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null;
            })()}

            <div
              className="file-fallback w-full h-full items-center justify-center bg-muted absolute inset-0"
              style={{ display: (() => {
                const hasProcessedThumb = isRaw ? !!(file.thumbnail_path || file.web_path) : true;
                const thumbSrc = thumbUrl || file.thumb || '';
                const hasDisplayableImage = hasDisplayableStillThumbnail(
                  thumbSrc,
                  videoThumbSrc,
                  isVid,
                  hasProcessedThumb,
                );
                return !hasDisplayableImage ? 'flex' : 'none';
              })() }}
            >
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                {isVid ? <Play className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
                <span className="text-[10px] font-semibold uppercase">{ext || 'FILE'}</span>
              </div>
            </div>

            {isVid && (
              <div className="absolute inset-0 z-[2] flex items-center justify-center pointer-events-none">
                <div className="bg-black/50 rounded-full p-1.5">
                  <Play className="h-5 w-5 text-white fill-white" />
                </div>
              </div>
            )}

            {file.is_hidden && <HiddenMediaOverlay />}

            <MediaTileBadges file={file} />
            {renderSingleMediaActions(file)}

            <div className="absolute inset-0 z-[3] flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              <div
                {...attributes}
                {...listeners}
                className="pointer-events-auto h-10 w-10 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg"
                onClick={(e) => e.stopPropagation()}
                title="Drag to reorder"
              >
                <GripVertical className="h-5 w-5" />
              </div>
            </div>

            {canSelect && (
              <div
                className={`absolute z-[3] ${file.isExtra ? 'top-5' : 'top-1'} left-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity`}
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelectionChange(file.id)}
                  className="bg-background/80"
                />
              </div>
            )}
            {Number(file.comment_count ?? 0) > 0 && (
              <div className="absolute bottom-2 left-2 bg-white/90 text-slate-900 text-[10px] px-1.5 py-0.5 rounded-full font-medium z-[3] flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {file.comment_count}
              </div>
            )}
            </div>
            <div className="px-2 py-2 bg-card">
              <p className="text-[11px] font-medium truncate" title={displayFilename}>
                {displayFilename}
              </p>
              {renderScanStatus && (() => {
                const node = renderScanStatus(file);
                return node ? <div className="mt-1">{node}</div> : null;
              })()}
              {latestCommentText && (
                <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2 max-h-0 opacity-0 group-hover:max-h-10 group-hover:opacity-100 transition-all">
                  {latestCommentText}
                </p>
              )}
            </div>
          </div>
        )}
      </SortableMediaItem>
    );
  };

  // List view row renderer
  const renderFileRow = (file: MediaFile, index: number, isExtraSection: boolean = false) => {
    const isSelected = selectedFiles.has(file.id);
    const isVid = isVideo?.(file) ?? false;
    const isRaw = isRawFile(file.filename);
    const imageUrl = getImageUrl(file, 'thumb');
    const ext = file.filename.split('.').pop()?.toUpperCase();
    const displayFilename = getDisplayMediaFilename(file) || file.filename;
    const videoThumbSrc = isVid ? (getMediaVideoUrl(file) || getImageUrl(file, 'original')) : '';
    const actualIndex = sortedFiles.findIndex(f => f.id === file.id);
    const isDragging = draggedId === file.id;
    const isDragOver = dragOverId === file.id;
    const latestCommentText = getLatestCommentText(file);

    const hasProcessedThumb = isRaw 
      ? !!(file.thumbnail_path || file.web_path)
      : true;
    const thumbSrc = imageUrl || file.thumb || '';
    const hasDisplayableImage = hasDisplayableStillThumbnail(
      thumbSrc,
      videoThumbSrc,
      isVid,
      hasProcessedThumb,
    );

    return (
      <div
        key={file.id}
        draggable={isManualSortEnabled && !isExtraSection}
        onDragStart={(e) => handleDragStart(e, file.id)}
        onDragOver={(e) => handleDragOver(e, file.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, file.id)}
        onDragEnd={handleDragEnd}
        className={`flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg border cursor-pointer transition-all group hover:bg-muted/50 ${
          isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
        } ${isExtraSection ? 'opacity-90' : ''} ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'ring-2 ring-blue-500 border-blue-500' : ''} ${isManualSortEnabled && !isExtraSection ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onClick={() => {
          onFileClick(actualIndex, sortedFiles);
        }}
      >
        {/* Selection indicator - moved to left */}
        {canSelect && (
          <div 
            className="flex-shrink-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onSelectionChange(file.id);
            }}
          >
            {isSelected ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            )}
          </div>
        )}

        {/* Thumbnail - wide aspect ratio */}
        <div className="relative w-24 h-16 sm:w-32 sm:h-20 flex-shrink-0 rounded overflow-hidden border bg-muted/40">
          {hasDisplayableImage ? (
            <img
              src={thumbSrc}
              alt={displayFilename}
              className={`w-full h-full object-cover transition-all duration-200 ${getHiddenMediaClassName(file)}`}
              loading="lazy"
              draggable={false}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.parentElement?.querySelector('.file-fallback') as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : isVid ? (
            <VideoThumbnail
              src={videoThumbSrc}
              alt={file.filename}
              className={`relative z-[1] w-full h-full object-cover transition-all duration-200 ${getHiddenMediaClassName(file)}`}
            />
          ) : null}
          <div 
            className="file-fallback w-full h-full items-center justify-center bg-muted absolute inset-0"
            style={{ display: !hasDisplayableImage ? 'flex' : 'none' }}
          >
            <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
              {isVid ? <Play className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
              <span className="text-[8px] font-semibold uppercase">{ext || 'FILE'}</span>
            </div>
          </div>
          {isVid && (
            <div className="absolute inset-0 z-[2] flex items-center justify-center pointer-events-none">
              <div className="bg-black/50 rounded-full p-0.5">
                <Play className="h-3 w-3 text-white fill-white" />
              </div>
            </div>
          )}
          <MediaTileBadges file={file} variant="list" />
          {Number(file.comment_count ?? 0) > 0 && (
            <div className="absolute bottom-1 left-1 bg-white/90 text-slate-900 text-[9px] px-1 py-0.5 rounded-full font-medium flex items-center gap-1">
              <MessageSquare className="h-2.5 w-2.5" />
              {file.comment_count}
            </div>
          )}
          {file.is_hidden && <HiddenMediaOverlay />}
        </div>

        {/* Filename - takes remaining space */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" title={displayFilename}>
            {displayFilename}
          </p>
          {renderScanStatus && (() => {
            const node = renderScanStatus(file);
            return node ? <div className="mt-1">{node}</div> : null;
          })()}
          {latestCommentText && (
            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
              {latestCommentText}
            </p>
          )}
          {!isClient && (
            <p className="text-[10px] text-muted-foreground sm:hidden">
              {formatMediaDateTime(file.captured_at || file.created_at)}
            </p>
          )}
        </div>

        {!isClient && (
          <>
            {/* Shot Time - fixed width on right */}
            <div className="hidden sm:block w-36 flex-shrink-0 text-right">
              <p className="text-[10px] text-muted-foreground">Shot Time</p>
              <p className="text-xs">{formatMediaDateTime(file.captured_at || file.created_at)}</p>
            </div>

            {/* Size - fixed width on right */}
            <div className="hidden sm:block w-20 flex-shrink-0 text-right">
              <p className="text-[10px] text-muted-foreground">Size</p>
              <p className="text-xs">{formatMediaFileSize(file.fileSize)}</p>
            </div>
          </>
        )}

        {/* Hide/Unhide toggle */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {canInteractSingleMedia && onToggleFavorite && (
            <button
              className={`h-7 w-7 rounded-full flex items-center justify-center ${file.is_favorite ? 'bg-red-500/15 text-red-500' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(file.id);
              }}
              title={file.is_favorite ? 'Unlike image' : 'Like image'}
            >
              <Heart className={`h-3.5 w-3.5 ${file.is_favorite ? 'fill-current' : ''}`} />
            </button>
          )}
          {renderCommentAction(file, 'h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted')}
          {canDownloadFile(file) && onDownloadSingle && (
            <button
              className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onDownloadSingle(file.id);
              }}
              title="Download image"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          {toggleFileHidden && !isClient && (
            <button
              className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                file.is_hidden
                  ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              onClick={(e) => { e.stopPropagation(); toggleFileHidden(file.id, !file.is_hidden); }}
              title={file.is_hidden ? 'Unhide image' : 'Hide image'}
            >
              {file.is_hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSortableFileRow = (file: MediaFile, index: number) => {
    const isSelected = selectedFiles.has(file.id);
    const isVid = isVideo?.(file) ?? false;
    const isRaw = isRawFile(file.filename);
    const imageUrl = getImageUrl(file, 'thumb');
    const ext = file.filename.split('.').pop()?.toUpperCase();
    const displayFilename = getDisplayMediaFilename(file) || file.filename;
    const videoThumbSrc = isVid ? (getMediaVideoUrl(file) || getImageUrl(file, 'original')) : '';
    const actualIndex = sortedFiles.findIndex(f => f.id === file.id);
    const hasProcessedThumb = isRaw ? !!(file.thumbnail_path || file.web_path) : true;
    const thumbSrc = imageUrl || file.thumb || '';
    const hasDisplayableImage = hasDisplayableStillThumbnail(
      thumbSrc,
      videoThumbSrc,
      isVid,
      hasProcessedThumb,
    );
    const latestCommentText = getLatestCommentText(file);

    return (
      <SortableMediaItem key={file.id} id={file.id}>
        {({ attributes, listeners, isDragging }) => (
          <div
            className={`flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg border transition-all group select-none ${
              isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
            } ${isDragging ? 'opacity-60 shadow-lg bg-muted/50' : ''}`}
            onClick={() => onFileClick(actualIndex, sortedFiles)}
          >
            {canSelect && (
              <div
                className="flex-shrink-0 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectionChange(file.id);
                }}
              >
                {isSelected ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                )}
              </div>
            )}

            <div
              {...attributes}
              {...listeners}
              className="flex-shrink-0 h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </div>

            <div className="relative w-24 h-16 sm:w-32 sm:h-20 flex-shrink-0 rounded overflow-hidden border bg-muted/40">
              {hasDisplayableImage ? (
                <img
                  src={thumbSrc}
                  alt={displayFilename}
                  className={`w-full h-full object-cover transition-all duration-200 ${getHiddenMediaClassName(file)}`}
                  loading="lazy"
                  draggable={false}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.file-fallback') as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : isVid ? (
                <VideoThumbnail
                  src={videoThumbSrc}
                  alt={displayFilename}
                  className={`relative z-[1] w-full h-full object-cover transition-all duration-200 ${getHiddenMediaClassName(file)}`}
                />
              ) : null}
              <div
                className="file-fallback w-full h-full items-center justify-center bg-muted absolute inset-0"
                style={{ display: !hasDisplayableImage ? 'flex' : 'none' }}
              >
                <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                  {isVid ? <Play className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  <span className="text-[8px] font-semibold uppercase">{ext || 'FILE'}</span>
                </div>
              </div>
              <MediaTileBadges file={file} variant="list" />
              {file.is_hidden && <HiddenMediaOverlay />}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" title={displayFilename}>
                {displayFilename}
              </p>
              {renderScanStatus && (() => {
                const node = renderScanStatus(file);
                return node ? <div className="mt-1">{node}</div> : null;
              })()}
              {latestCommentText && (
                <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                  {latestCommentText}
                </p>
              )}
              {!isClient && (
                <p className="text-[10px] text-muted-foreground sm:hidden">
                  {formatMediaDateTime(file.captured_at || file.created_at)}
                </p>
              )}
            </div>

            {!isClient && (
              <>
                <div className="hidden sm:block w-36 flex-shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground">Shot Time</p>
                  <p className="text-xs">{formatMediaDateTime(file.captured_at || file.created_at)}</p>
                </div>
                <div className="hidden sm:block w-20 flex-shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground">Size</p>
                  <p className="text-xs">{formatMediaFileSize(file.fileSize)}</p>
                </div>
              </>
            )}

            <div className="flex items-center gap-1 flex-shrink-0">
              {canInteractSingleMedia && onToggleFavorite && (
                <button
                  className={`h-7 w-7 rounded-full flex items-center justify-center ${file.is_favorite ? 'bg-red-500/15 text-red-500' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(file.id);
                  }}
                  title={file.is_favorite ? 'Unlike image' : 'Like image'}
                >
                  <Heart className={`h-3.5 w-3.5 ${file.is_favorite ? 'fill-current' : ''}`} />
                </button>
              )}
              {renderCommentAction(file, 'h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted')}
              {canDownloadFile(file) && onDownloadSingle && (
                <button
                  className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadSingle(file.id);
                  }}
                  title="Download image"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              )}
              {toggleFileHidden && !isClient && (
                <button
                  className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                    file.is_hidden
                      ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  onClick={(e) => { e.stopPropagation(); toggleFileHidden(file.id, !file.is_hidden); }}
                  title={file.is_hidden ? 'Unhide image' : 'Hide image'}
                >
                  {file.is_hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          </div>
        )}
      </SortableMediaItem>
    );
  };

  return (
    <MediaGridLayout
      viewMode={viewMode}
      canSelect={canSelect}
      isClient={isClient}
      files={files}
      selectedFiles={selectedFiles}
      onSelectAll={onSelectAll}
      showMultiSortHint={showMultiSortHint}
      isManualSortEnabled={isManualSortEnabled}
      sensors={sensors}
      onManualSortEnd={handleManualSortEnd}
      visibleRegularIds={visibleRegularIds}
      regularFiles={regularFiles}
      regularStacks={regularStacks}
      extraFiles={extraFiles}
      renderFileCard={renderFileCard}
      renderStackCard={renderStackCard}
      renderSortableFileCard={renderSortableFileCard}
      renderFileRow={renderFileRow}
      renderSortableFileRow={renderSortableFileRow}
    />
  );
}
