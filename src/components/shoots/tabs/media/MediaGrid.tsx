import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, Circle, Eye, EyeOff, GripVertical, Image as ImageIcon, MinusCircle, Play } from 'lucide-react';
import { type MediaFile } from '@/hooks/useShootFiles';
import { isRawFile } from '@/services/rawPreviewService';
import VideoThumbnail from '../../VideoThumbnail';
import { normalizeManualOrder, sortMediaFiles, type MediaSortOrder } from './mediaSort';
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemWrapperProps {
  id: string;
  children: (args: {
    attributes: ReturnType<typeof useSortable>['attributes'];
    listeners: ReturnType<typeof useSortable>['listeners'];
    isDragging: boolean;
  }) => React.ReactNode;
}

function SortableItemWrapper({ id, children }: SortableItemWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 'auto',
      }}
    >
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}
// Media Grid Component
interface MediaGridProps {
  files: MediaFile[];
  onFileClick: (index: number, sortedFiles: MediaFile[]) => void;
  selectedFiles: Set<string>;
  onSelectionChange: (fileId: string) => void;
  onSelectAll?: () => void;
  canSelect: boolean;
  sortOrder?: MediaSortOrder;
  manualSortActive?: boolean;
  manualOrder?: string[];
  onManualOrderChange?: (newOrder: string[]) => void;
  getImageUrl: (file: MediaFile, size?: 'thumb' | 'medium' | 'large' | 'original') => string;
  getSrcSet: (file: MediaFile) => string;
  isImage: (file: MediaFile) => boolean;
  isVideo?: (file: MediaFile) => boolean;
  viewMode?: 'list' | 'grid';
  showHidden?: boolean;
  isClient?: boolean;
  toggleFileHidden?: (fileId: string, hidden: boolean) => void;
  separateExtras?: boolean;
}

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
  showHidden = false,
  isClient = false,
  toggleFileHidden,
  separateExtras = true,
}: MediaGridProps) {
  const isManualSortEnabled = sortOrder === 'manual' && manualSortActive;
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Sort files based on sortOrder, then separate regular and extra files
  const sortedFiles = useMemo(
    () => sortMediaFiles(files, sortOrder, manualOrder),
    [files, manualOrder, sortOrder],
  );

  const draggableIds = useMemo(
    () => (separateExtras ? sortedFiles.filter((file) => !file.isExtra) : sortedFiles).map((file) => file.id),
    [separateExtras, sortedFiles],
  );
  const visibleSorted = showHidden ? sortedFiles : sortedFiles.filter(f => !f.is_hidden);
  const regularFiles = separateExtras ? visibleSorted.filter(f => !f.isExtra) : visibleSorted;
  const extraFiles = separateExtras ? visibleSorted.filter(f => f.isExtra) : [];
  const visibleRegularIds = regularFiles.map((file) => file.id);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    }),
  );

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, fileId: string) => {
    if (!isManualSortEnabled) return;
    setDraggedId(fileId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', fileId);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, fileId: string) => {
    if (!isManualSortEnabled || !draggedId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (fileId !== draggedId) {
      setDragOverId(fileId);
    }
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverId(null);
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!isManualSortEnabled || !draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const currentOrder = normalizeManualOrder(visibleRegularIds, regularFiles);
    const selectedBlock = currentOrder.filter((id) => selectedFiles.has(id));
    const draggedBlock = selectedFiles.has(draggedId) && selectedBlock.length > 1 ? selectedBlock : [draggedId];
    const sourceStartIndex = Math.min(...draggedBlock.map((id) => currentOrder.indexOf(id)).filter((index) => index >= 0));
    const targetIndex = currentOrder.indexOf(targetId);

    if (draggedBlock.includes(targetId)) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    if (targetIndex !== -1 && sourceStartIndex !== Number.POSITIVE_INFINITY) {
      const remainingOrder = currentOrder.filter((id) => !draggedBlock.includes(id));
      const remainingTargetIndex = remainingOrder.indexOf(targetId);
      const insertIndex = sourceStartIndex < targetIndex ? remainingTargetIndex + 1 : remainingTargetIndex;
      remainingOrder.splice(insertIndex, 0, ...draggedBlock);
      onManualOrderChange?.(remainingOrder);
    }

    setDraggedId(null);
    setDragOverId(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleManualSortEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!isManualSortEnabled || !over || active.id === over.id) {
      return;
    }

    const currentOrder = normalizeManualOrder(visibleRegularIds, regularFiles);
    const activeId = String(active.id);
    const overId = String(over.id);
    const selectedBlock = currentOrder.filter((id) => selectedFiles.has(id));
    const draggedBlock = selectedFiles.has(activeId) && selectedBlock.length > 1 ? selectedBlock : [activeId];

    if (draggedBlock.includes(overId)) {
      return;
    }

    const sourceStartIndex = Math.min(...draggedBlock.map((id) => currentOrder.indexOf(id)).filter((index) => index >= 0));
    const targetIndex = currentOrder.indexOf(overId);
    if (sourceStartIndex === Number.POSITIVE_INFINITY || targetIndex === -1) {
      return;
    }

    if (draggedBlock.length === 1) {
      const oldIndex = currentOrder.indexOf(activeId);
      const newIndex = currentOrder.indexOf(overId);
      onManualOrderChange?.(arrayMove(currentOrder, oldIndex, newIndex));
      return;
    }

    const remainingOrder = currentOrder.filter((id) => !draggedBlock.includes(id));
    const remainingTargetIndex = remainingOrder.indexOf(overId);
    const insertIndex = sourceStartIndex < targetIndex ? remainingTargetIndex + 1 : remainingTargetIndex;
    remainingOrder.splice(insertIndex, 0, ...draggedBlock);
    onManualOrderChange?.(remainingOrder);
  };
  const showMultiSortHint = isManualSortEnabled && selectedFiles.size > 1;

  // Helper function to format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Helper function to format date/time
  const formatDateTime = (dateStr?: string): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '-';
    }
  };

  // Helper function to get resolution string
  const getResolution = (file: MediaFile): string => {
    if (file.width && file.height) {
      return `${file.width} × ${file.height}`;
    }
    return '-';
  };
  
  const renderFileCard = (file: MediaFile, index: number, isExtraSection: boolean = false) => {
    const isSelected = selectedFiles.has(file.id);
    const isImg = isImage(file);
    const isVid = isVideo?.(file) ?? false;
    const isRaw = isRawFile(file.filename);
    const thumbUrl = getImageUrl(file, 'thumb');
    const ext = file.filename.split('.').pop()?.toUpperCase();
    
    // Find the actual index in the full sorted array for viewer
    const actualIndex = sortedFiles.findIndex(f => f.id === file.id);
    
    const isDragging = draggedId === file.id;
    const isDragOver = dragOverId === file.id;
    
    return (
      <div
        key={file.id}
        draggable={isManualSortEnabled && !isExtraSection}
        onDragStart={(e) => handleDragStart(e, file.id)}
        onDragOver={(e) => handleDragOver(e, file.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, file.id)}
        onDragEnd={handleDragEnd}
        className={`relative aspect-square rounded overflow-hidden border cursor-pointer transition-all group ${
          isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'
        } ${isExtraSection ? 'opacity-90' : ''} ${isDragging ? 'opacity-50 scale-95' : ''} ${isDragOver ? 'ring-2 ring-blue-500 border-blue-500' : ''} ${isManualSortEnabled && !isExtraSection ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onClick={() => {
          onFileClick(actualIndex, sortedFiles);
        }}
      >
        {/* Grid thumbnails use the smallest available size (thumb/placeholder) */}
        {/* No srcSet — avoids browser loading medium/web images for small grid cells */}
        {(() => {
          const hasProcessedThumb = isRaw 
            ? !!(file.thumbnail_path || file.web_path)
            : true;
          const hasDisplayableImage = hasProcessedThumb && (file.thumb || thumbUrl);
          const thumbSrc = file.thumb || thumbUrl;
          
          // For videos without a backend thumbnail, generate one client-side
          if (isVid && !hasDisplayableImage) {
            const videoSrc = file.original || file.large || file.medium || file.url || getImageUrl(file, 'original');
            return videoSrc ? (
              <VideoThumbnail
                src={videoSrc}
                alt={file.filename}
                className="w-full h-full object-cover"
              />
            ) : null;
          }
          
          return hasDisplayableImage ? (
            <img
              src={thumbSrc}
              alt={file.filename}
              className="w-full h-full object-cover"
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
            const hasDisplayableImage = hasProcessedThumb && (file.thumb || thumbUrl);
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
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 rounded-full p-1.5">
              <Play className="h-5 w-5 text-white fill-white" />
            </div>
          </div>
        )}
        
        {/* Hidden overlay */}
        {file.is_hidden && (
          <div className="absolute inset-0 bg-black/50 z-[2] flex items-center justify-center pointer-events-none">
            <EyeOff className="h-5 w-5 text-white/70" />
          </div>
        )}

        {/* Hide/Unhide toggle button (top-right, hover reveal) */}
        {!isClient && (
          <button
            className={`absolute top-1 right-1 z-[3] h-6 w-6 rounded-full flex items-center justify-center transition-all ${
              file.is_hidden
                ? 'bg-yellow-500/90 text-white opacity-100'
                : 'bg-black/50 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100'
            }`}
            onClick={(e) => { e.stopPropagation(); toggleFileHidden(file.id, !file.is_hidden); }}
            title={file.is_hidden ? 'Unhide image' : 'Hide from tours & portfolio'}
          >
            {file.is_hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </button>
        )}

        {/* Extra badge */}
        {file.isExtra && (
          <div className="absolute top-1 left-1 bg-orange-500 text-white text-[8px] px-1 py-0.5 rounded font-medium">
            EXTRA
          </div>
        )}
        
        {/* Hero badge */}
        {file.is_cover && !file.isExtra && (
          <div className="absolute top-1 left-1 bg-blue-600 text-white text-[8px] px-1 py-0.5 rounded font-medium">
            HERO
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
        
        <div
          className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 opacity-0 group-hover:opacity-100 transition-opacity overflow-hidden whitespace-nowrap"
          ref={(el) => {
            if (!el) return;
            const span = el.firstElementChild as HTMLElement;
            if (!span) return;
            requestAnimationFrame(() => {
              const overflow = span.scrollWidth - el.clientWidth;
              span.style.setProperty('--scroll-dist', `${overflow > 0 ? -overflow : 0}px`);
            });
          }}
        >
          <span
            className="inline-block group-hover:animate-marquee"
            style={{ animationDuration: `${Math.max(2, file.filename.length * 0.12)}s`, '--scroll-dist': '0px' } as React.CSSProperties}
          >
            {file.filename}
          </span>
        </div>
      </div>
    );
  };

  const renderSortableFileCard = (file: MediaFile, index: number) => {
    const isSelected = selectedFiles.has(file.id);
    const isImg = isImage(file);
    const isVid = isVideo?.(file) ?? false;
    const isRaw = isRawFile(file.filename);
    const thumbUrl = getImageUrl(file, 'thumb');
    const ext = file.filename.split('.').pop()?.toUpperCase();
    const actualIndex = sortedFiles.findIndex(f => f.id === file.id);

    return (
      <SortableItemWrapper key={file.id} id={file.id}>
        {({ attributes, listeners, isDragging }) => (
          <div
            className={`relative aspect-square rounded overflow-hidden border transition-all group select-none ${
              isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'
            } ${isDragging ? 'opacity-60 scale-95 shadow-xl' : ''}`}
            onClick={() => onFileClick(actualIndex, sortedFiles)}
          >
            {(() => {
              const hasProcessedThumb = isRaw ? !!(file.thumbnail_path || file.web_path) : true;
              const hasDisplayableImage = hasProcessedThumb && (file.thumb || thumbUrl);
              const thumbSrc = file.thumb || thumbUrl;

              if (isVid && !hasDisplayableImage) {
                const videoSrc = file.original || file.large || file.medium || file.url || getImageUrl(file, 'original');
                return videoSrc ? (
                  <VideoThumbnail
                    src={videoSrc}
                    alt={file.filename}
                    className="w-full h-full object-cover"
                  />
                ) : null;
              }

              return hasDisplayableImage ? (
                <img
                  src={thumbSrc}
                  alt={file.filename}
                  className="w-full h-full object-cover"
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
                const hasDisplayableImage = hasProcessedThumb && (file.thumb || thumbUrl);
                return !hasDisplayableImage ? 'flex' : 'none';
              })() }}
            >
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                {isVid ? <Play className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
                <span className="text-[10px] font-semibold uppercase">{ext || 'FILE'}</span>
              </div>
            </div>

            {isVid && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/50 rounded-full p-1.5">
                  <Play className="h-5 w-5 text-white fill-white" />
                </div>
              </div>
            )}

            {!isClient && toggleFileHidden && (
              <button
                className={`absolute top-1 right-1 z-[3] h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                  file.is_hidden
                    ? 'bg-yellow-500/90 text-white opacity-0 group-hover:opacity-100'
                    : 'bg-black/50 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100'
                }`}
                onClick={(e) => { e.stopPropagation(); toggleFileHidden(file.id, !file.is_hidden); }}
                title={file.is_hidden ? 'Unhide image' : 'Hide from tours & portfolio'}
              >
                {file.is_hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
            )}

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

            <div
              className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity overflow-hidden whitespace-nowrap"
              ref={(el) => {
                if (!el) return;
                const span = el.firstElementChild as HTMLElement;
                if (!span) return;
                requestAnimationFrame(() => {
                  const overflow = span.scrollWidth - el.clientWidth;
                  span.style.setProperty('--scroll-dist', `${overflow > 0 ? -overflow : 0}px`);
                });
              }}
            >
              <span
                className="inline-block group-hover:animate-marquee"
                style={{ animationDuration: `${Math.max(2, file.filename.length * 0.12)}s`, '--scroll-dist': '0px' } as React.CSSProperties}
              >
                {file.filename}
              </span>
            </div>
          </div>
        )}
      </SortableItemWrapper>
    );
  };

  // List view row renderer
  const renderFileRow = (file: MediaFile, index: number, isExtraSection: boolean = false) => {
    const isSelected = selectedFiles.has(file.id);
    const isVid = isVideo?.(file) ?? false;
    const isRaw = isRawFile(file.filename);
    const imageUrl = getImageUrl(file, 'thumb');
    const ext = file.filename.split('.').pop()?.toUpperCase();
    const actualIndex = sortedFiles.findIndex(f => f.id === file.id);
    const isDragging = draggedId === file.id;
    const isDragOver = dragOverId === file.id;

    const hasProcessedThumb = isRaw 
      ? !!(file.thumbnail_path || file.web_path)
      : true;
    const hasDisplayableImage = hasProcessedThumb && (file.thumb || imageUrl);

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
        <div className="relative w-20 h-12 sm:w-28 sm:h-16 flex-shrink-0 rounded overflow-hidden border bg-muted">
          {hasDisplayableImage ? (
            <img
              src={file.thumb || imageUrl}
              alt={file.filename}
              className="w-full h-full object-cover"
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
              src={file.original || file.large || file.medium || file.url || getImageUrl(file, 'original')}
              alt={file.filename}
              className="w-full h-full object-cover"
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
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/50 rounded-full p-0.5">
                <Play className="h-3 w-3 text-white fill-white" />
              </div>
            </div>
          )}
          {file.isExtra && (
            <div className="absolute top-0.5 left-0.5 bg-orange-500 text-white text-[6px] px-0.5 py-0 rounded font-medium">
              EXTRA
            </div>
          )}
        </div>

        {/* Filename - takes remaining space */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" title={file.filename}>
            {file.filename}
          </p>
          {!isClient && (
            <p className="text-[10px] text-muted-foreground sm:hidden">
              {formatDateTime(file.captured_at || file.created_at)}
            </p>
          )}
        </div>

        {!isClient && (
          <>
            {/* Shot Time - fixed width on right */}
            <div className="hidden sm:block w-36 flex-shrink-0 text-right">
              <p className="text-[10px] text-muted-foreground">Shot Time</p>
              <p className="text-xs">{formatDateTime(file.captured_at || file.created_at)}</p>
            </div>

            {/* Size - fixed width on right */}
            <div className="hidden sm:block w-20 flex-shrink-0 text-right">
              <p className="text-[10px] text-muted-foreground">Size</p>
              <p className="text-xs">{formatFileSize(file.fileSize)}</p>
            </div>
          </>
        )}

        {/* Hide/Unhide toggle */}
        {!isClient && toggleFileHidden && (
          <button
            className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition-all ${
              file.is_hidden
                ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted'
            }`}
            onClick={(e) => { e.stopPropagation(); toggleFileHidden(file.id, !file.is_hidden); }}
            title={file.is_hidden ? 'Unhide image' : 'Hide from tours & portfolio'}
          >
            {file.is_hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        )}

        {/* Hidden indicator overlay on thumbnail */}
        {file.is_hidden && (
          <div className="absolute left-0 top-0 bottom-0 w-20 sm:w-28 bg-black/40 rounded-l flex items-center justify-center pointer-events-none">
            <EyeOff className="h-4 w-4 text-white/60" />
          </div>
        )}

      </div>
    );
  };

  const renderSortableFileRow = (file: MediaFile, index: number) => {
    const isSelected = selectedFiles.has(file.id);
    const isVid = isVideo?.(file) ?? false;
    const isRaw = isRawFile(file.filename);
    const imageUrl = getImageUrl(file, 'thumb');
    const ext = file.filename.split('.').pop()?.toUpperCase();
    const actualIndex = sortedFiles.findIndex(f => f.id === file.id);
    const hasProcessedThumb = isRaw ? !!(file.thumbnail_path || file.web_path) : true;
    const hasDisplayableImage = hasProcessedThumb && (file.thumb || imageUrl);

    return (
      <SortableItemWrapper key={file.id} id={file.id}>
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

            <div className="relative w-20 h-12 sm:w-28 sm:h-16 flex-shrink-0 rounded overflow-hidden border bg-muted">
              {hasDisplayableImage ? (
                <img
                  src={file.thumb || imageUrl}
                  alt={file.filename}
                  className="w-full h-full object-cover"
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
                  src={file.original || file.large || file.medium || file.url || getImageUrl(file, 'original')}
                  alt={file.filename}
                  className="w-full h-full object-cover"
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
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" title={file.filename}>
                {file.filename}
              </p>
              {!isClient && (
                <p className="text-[10px] text-muted-foreground sm:hidden">
                  {formatDateTime(file.captured_at || file.created_at)}
                </p>
              )}
            </div>

            {!isClient && (
              <>
                <div className="hidden sm:block w-36 flex-shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground">Shot Time</p>
                  <p className="text-xs">{formatDateTime(file.captured_at || file.created_at)}</p>
                </div>
                <div className="hidden sm:block w-20 flex-shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground">Size</p>
                  <p className="text-xs">{formatFileSize(file.fileSize)}</p>
                </div>
              </>
            )}

            {!isClient && toggleFileHidden && (
              <button
                className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                  file.is_hidden
                    ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                onClick={(e) => { e.stopPropagation(); toggleFileHidden(file.id, !file.is_hidden); }}
                title={file.is_hidden ? 'Unhide image' : 'Hide from tours & portfolio'}
              >
                {file.is_hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        )}
      </SortableItemWrapper>
    );
  };

  if (viewMode === 'grid') {
    return (
      <div className="space-y-2">
        {/* Select all for grid view */}
        {canSelect && files.length > 0 && (
          <div className="flex items-center gap-2 px-1 py-1">
            <div 
              className="cursor-pointer hover:text-foreground transition-colors text-muted-foreground"
              onClick={onSelectAll}
              title={selectedFiles.size === files.length ? 'Deselect All' : 'Select All'}
            >
              {selectedFiles.size === files.length ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : selectedFiles.size > 0 ? (
                <MinusCircle className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {selectedFiles.size > 0 ? `${selectedFiles.size} selected` : 'Select all'}
            </span>
          </div>
        )}
        {showMultiSortHint && (
          <div className="px-1 text-[11px] text-muted-foreground">
            Select multiple images, then drag one to move the group.
          </div>
        )}

        {/* Regular files - grid */}
        {isManualSortEnabled ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleManualSortEnd}>
            <SortableContext items={visibleRegularIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
                {regularFiles.map((file, index) => renderSortableFileCard(file, index))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
            {regularFiles.map((file, index) => renderFileCard(file, index, false))}
          </div>
        )}

        {/* Extra files section with separator */}
        {extraFiles.length > 0 && (
          <>
            <div className="flex items-center gap-2 py-2">
              <div className="flex-1 h-px bg-orange-500/30" />
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400 px-2">
                Extras ({extraFiles.length})
              </span>
              <div className="flex-1 h-px bg-orange-500/30" />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
              {extraFiles.map((file, index) => renderFileCard(file, index, true))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header row - visible on larger screens */}
      <div className="hidden sm:flex items-center gap-3 px-2 py-1 text-[10px] text-muted-foreground font-medium border-b">
        {canSelect && (
          <div 
            className="w-4 flex-shrink-0 cursor-pointer hover:text-foreground transition-colors"
            onClick={onSelectAll}
            title={selectedFiles.size === files.length ? 'Deselect All' : 'Select All'}
          >
            {selectedFiles.size === files.length ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : selectedFiles.size > 0 ? (
              <MinusCircle className="h-4 w-4" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
          </div>
        )}
        <div className="w-28 flex-shrink-0">Preview</div>
        <div className="flex-1">Filename</div>
        {!isClient && (
          <>
            <div className="w-36 flex-shrink-0 text-right">Shot Time</div>
            <div className="w-20 flex-shrink-0 text-right">Size</div>
          </>
        )}
        <div className="w-6 flex-shrink-0"></div>
      </div>
      {showMultiSortHint && (
        <div className="px-2 text-[11px] text-muted-foreground">
          Select multiple images, then drag one to move the group.
        </div>
      )}

      {/* Regular files */}
      {isManualSortEnabled ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleManualSortEnd}>
          <SortableContext items={visibleRegularIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {regularFiles.map((file, index) => renderSortableFileRow(file, index))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-1">
          {regularFiles.map((file, index) => renderFileRow(file, index, false))}
        </div>
      )}
      
      {/* Extra files section with separator */}
      {extraFiles.length > 0 && (
        <>
          <div className="flex items-center gap-2 py-2">
            <div className="flex-1 h-px bg-orange-500/30" />
            <span className="text-xs font-medium text-orange-600 dark:text-orange-400 px-2">
              Extras ({extraFiles.length})
            </span>
            <div className="flex-1 h-px bg-orange-500/30" />
          </div>
          <div className="space-y-1">
            {extraFiles.map((file, index) => renderFileRow(file, index, true))}
          </div>
        </>
      )}
    </div>
  );
}


