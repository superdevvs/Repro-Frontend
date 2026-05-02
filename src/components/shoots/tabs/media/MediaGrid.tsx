import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Download, Eye, EyeOff, GripVertical, Heart, Image as ImageIcon, MessageSquare, MinusCircle, Play } from 'lucide-react';
import { type MediaFile } from '@/hooks/useShootFiles';
import { isRawFile } from '@/services/rawPreviewService';
import VideoThumbnail from '../../VideoThumbnail';
import { normalizeManualOrder, sortMediaFiles, type MediaSortOrder } from './mediaSort';
import { getDisplayMediaFilename, getMediaVideoUrl } from './mediaPreviewUtils';
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
  isClient?: boolean;
  toggleFileHidden?: (fileId: string, hidden: boolean) => void;
  separateExtras?: boolean;
  canInteractSingleMedia?: boolean;
  canDownloadSingleMedia?: boolean;
  onToggleFavorite?: (fileId: string) => void;
  onAddComment?: (fileId: string, comment: string) => void;
  onDownloadSingle?: (fileId: string) => void;
  enableRawStacks?: boolean;
  rawStackSize?: number | null;
}

interface MediaStack {
  id: string;
  files: MediaFile[];
  expectedSize: number;
}

const MAX_CAPTURED_TIME_STACK_SIZE = 7;
const CAPTURED_BRACKET_GAP_SECONDS = 4;
const MAX_FILENAME_SEQUENCE_STACK_SIZE = 7;

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
}: MediaGridProps) {
  const isManualSortEnabled = sortOrder === 'manual' && manualSortActive;
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [commentPopoverFileId, setCommentPopoverFileId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
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

  const parseCapturedSecond = (value?: string) => {
    if (!value) {
      return null;
    }

    const normalizedValue = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    const timestamp = Date.parse(normalizedValue);

    return Number.isNaN(timestamp) ? null : Math.floor(timestamp / 1000);
  };

  const parseFilenameSequence = (filename: string) => {
    const nameWithoutExtension = filename.replace(/\.[^.]+$/, '');
    const matches = [...nameWithoutExtension.matchAll(/\d+/g)];
    const lastMatch = matches[matches.length - 1];
    const sequence = lastMatch ? Number(lastMatch[0]) : NaN;

    return Number.isFinite(sequence) ? sequence : null;
  };

  const isRawStackCandidate = (file: MediaFile) =>
    !file.isExtra &&
    !isVideo?.(file) &&
    ((file.media_type || '').toLowerCase() === 'raw' || isRawFile(file.filename));

  const buildMediaStacks = (stackFiles: MediaFile[]): MediaStack[] => {
    if (!shouldStackRawFiles) {
      return stackFiles.map((file) => ({ id: file.id, files: [file], expectedSize: 1 }));
    }

    const normalizeStack = (stack: MediaStack): MediaStack[] => {
      if (stack.files.length <= 1) {
        return [{ ...stack, expectedSize: 1 }];
      }

      return [{
        ...stack,
        expectedSize: stack.files.length > 1 ? Math.max(stack.expectedSize, stack.files.length) : 1,
      }];
    };

    const stacks: MediaStack[] = [];
    let currentStack: MediaStack | null = null;

    stackFiles.forEach((file) => {
      if (!isRawStackCandidate(file)) {
        currentStack = null;
        stacks.push({ id: file.id, files: [file], expectedSize: 1 });
        return;
      }

      const bracketGroup =
        file.bracket_group === null || file.bracket_group === undefined
          ? null
          : Number(file.bracket_group);
      const capturedSecond = parseCapturedSecond(file.captured_at);
      const filenameSequence = parseFilenameSequence(file.filename);
      const baseKey = typeof bracketGroup === 'number' && Number.isFinite(bracketGroup) && bracketGroup > 0
        ? `bracket-${bracketGroup}`
        : null;
      const bracketStackLimit = normalizedRawStackSize ?? Number.POSITIVE_INFINITY;
      if (
        currentStack &&
        baseKey &&
        currentStack.id.startsWith(`${baseKey}:`) &&
        currentStack.files.length < bracketStackLimit
      ) {
        currentStack.files.push(file);
        currentStack.expectedSize = normalizedRawStackSize ?? currentStack.files.length;
        return;
      }

      if (baseKey) {
        currentStack = {
          id: `${baseKey}:${stacks.length}`,
          files: [file],
          expectedSize: normalizedRawStackSize ?? 1,
        };
        stacks.push(currentStack);
        return;
      }

      if (capturedSecond !== null) {
        const capturedStackLimit = normalizedRawStackSize ?? MAX_CAPTURED_TIME_STACK_SIZE;
        const previousFile = currentStack?.files[currentStack.files.length - 1];
        const previousCapturedSecond = parseCapturedSecond(previousFile?.captured_at);
        const isSameCapturedRun =
          currentStack?.id.startsWith('captured-run:') &&
          previousCapturedSecond !== null &&
          Math.abs(capturedSecond - previousCapturedSecond) <= CAPTURED_BRACKET_GAP_SECONDS &&
          currentStack.files.length < capturedStackLimit;

        if (isSameCapturedRun && currentStack) {
          currentStack.files.push(file);
          currentStack.expectedSize = normalizedRawStackSize ?? currentStack.files.length;
          return;
        }

        currentStack = {
          id: `captured-run:${stacks.length}`,
          files: [file],
          expectedSize: normalizedRawStackSize ?? 1,
        };
        stacks.push(currentStack);
        return;
      }

      if (filenameSequence !== null) {
        const previousFile = currentStack?.files[currentStack.files.length - 1];
        const previousFilenameSequence = previousFile ? parseFilenameSequence(previousFile.filename) : null;
        const previousCapturedSecond = parseCapturedSecond(previousFile?.captured_at);
        const isCapturedCloseEnough =
          capturedSecond === null ||
          previousCapturedSecond === null ||
          Math.abs(capturedSecond - previousCapturedSecond) <= CAPTURED_BRACKET_GAP_SECONDS;
        const sequenceStackLimit = normalizedRawStackSize ?? MAX_FILENAME_SEQUENCE_STACK_SIZE;
        const isSameFilenameRun =
          currentStack?.id.startsWith('filename-run:') &&
          previousFilenameSequence !== null &&
          Math.abs(filenameSequence - previousFilenameSequence) === 1 &&
          isCapturedCloseEnough &&
          currentStack.files.length < sequenceStackLimit;

        if (isSameFilenameRun && currentStack) {
          currentStack.files.push(file);
          currentStack.expectedSize = normalizedRawStackSize ?? currentStack.files.length;
          return;
        }

        if (capturedSecond === null) {
          currentStack = {
            id: `filename-run:${stacks.length}`,
            files: [file],
            expectedSize: normalizedRawStackSize ?? 1,
          };
          stacks.push(currentStack);
          return;
        }
      }

      currentStack = null;
      stacks.push({ id: file.id, files: [file], expectedSize: 1 });
    });

    return stacks.flatMap(normalizeStack);
  };

  const regularStacks = buildMediaStacks(regularFiles);
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
  const getLatestCommentText = (file: MediaFile) =>
    file.latest_comment?.comment?.trim() ||
    file.comments?.[file.comments.length - 1]?.comment?.trim() ||
    '';
  const handleCommentPopoverChange = (fileId: string, open: boolean) => {
    if (open) {
      setCommentPopoverFileId(fileId);
      setCommentDraft('');
      return;
    }

    if (commentPopoverFileId === fileId) {
      setCommentPopoverFileId(null);
      setCommentDraft('');
    }
  };
  const submitInlineComment = (fileId: string) => {
    if (!onAddComment) {
      return;
    }

    const trimmedComment = commentDraft.trim();
    if (!trimmedComment) {
      return;
    }

    onAddComment(fileId, trimmedComment);
    setCommentPopoverFileId(null);
    setCommentDraft('');
  };
  const renderCommentAction = (file: MediaFile, buttonClassName: string) => {
    if (!canInteractSingleMedia || !onAddComment) {
      return null;
    }

    const displayFilename = getDisplayMediaFilename(file) || file.filename;

    return (
      <Popover
        open={commentPopoverFileId === file.id}
        onOpenChange={(open) => handleCommentPopoverChange(file.id, open)}
      >
        <PopoverTrigger asChild>
          <button
            className={buttonClassName}
            onClick={(e) => {
              e.stopPropagation();
            }}
            title="Add comment"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          className="z-[80] w-80 rounded-xl border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Comment on image</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{displayFilename}</p>
            </div>
            <Textarea
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Add a quick note for this image..."
              className="min-h-[88px] resize-none"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setCommentPopoverFileId(null);
                  setCommentDraft('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  submitInlineComment(file.id);
                }}
                disabled={!commentDraft.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };
  const renderSingleMediaActions = (file: MediaFile, alwaysVisible = false) => {
    const showHiddenToggle = Boolean(toggleFileHidden) && !isClient;
    if (!canInteractSingleMedia && !showHiddenToggle) {
      return null;
    }

    const isCommentPopoverOpen = commentPopoverFileId === file.id;

    return (
      <div className={`absolute top-2 right-2 z-[3] flex items-center gap-1 transition-opacity ${alwaysVisible || isCommentPopoverOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {canInteractSingleMedia && onToggleFavorite && (
          <button
            className={`h-7 w-7 rounded-full backdrop-blur-sm flex items-center justify-center ${file.is_favorite ? 'bg-red-500/90 text-white' : 'bg-black/55 text-white'}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(file.id);
            }}
            title={file.is_favorite ? 'Unlike image' : 'Like image'}
          >
            <Heart className={`h-3.5 w-3.5 ${file.is_favorite ? 'fill-current' : ''}`} />
          </button>
        )}
        {renderCommentAction(file, 'h-7 w-7 rounded-full bg-black/55 backdrop-blur-sm text-white flex items-center justify-center')}
        {canDownloadSingleMedia && onDownloadSingle && (
          <button
            className="h-7 w-7 rounded-full bg-black/55 backdrop-blur-sm text-white flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              onDownloadSingle(file.id);
            }}
            title="Download image"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        )}
        {showHiddenToggle && (
          <button
            className={`h-7 w-7 rounded-full backdrop-blur-sm flex items-center justify-center ${file.is_hidden ? 'bg-yellow-500/90 text-white opacity-100' : 'bg-black/55 text-white'}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleFileHidden?.(file.id, !file.is_hidden);
            }}
            title={file.is_hidden ? 'Unhide image' : 'Hide image'}
          >
            {file.is_hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    );
  };

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
  const getHiddenMediaClassName = (file: MediaFile) =>
    file.is_hidden ? 'blur-[1px] brightness-[0.92]' : '';
  const getGridPreviewMediaClassName = (file: MediaFile) =>
    `absolute inset-0 h-full w-full object-cover transition-all duration-200 ${getHiddenMediaClassName(file)}`;
  const getVideoThumbnailSource = (file: MediaFile): string =>
    getMediaVideoUrl(file) || getImageUrl(file, 'original');
  const renderHiddenMediaOverlay = () => (
    <>
      <div className="absolute inset-0 bg-slate-950/10 z-[2] pointer-events-none" />
      <div className="absolute inset-x-3 bottom-3 z-[3] flex items-center justify-center pointer-events-none">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
          <EyeOff className="h-3.5 w-3.5" />
          <span>Hidden</span>
        </div>
      </div>
    </>
  );
  
  const renderFileCard = (file: MediaFile, index: number, isExtraSection: boolean = false, stack?: MediaStack) => {
    const isSelected = selectedFiles.has(file.id);
    const isImg = isImage(file);
    const isVid = isVideo?.(file) ?? false;
    const isRaw = isRawFile(file.filename);
    const thumbUrl = getImageUrl(file, 'thumb');
    const ext = file.filename.split('.').pop()?.toUpperCase();
    const displayFilename = getDisplayMediaFilename(file) || file.filename;
    const videoThumbSrc = isVid ? getVideoThumbnailSource(file) : '';
    
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
                  const hasProcessedStackThumb = stackIsRaw
                    ? !!(stackFile.thumbnail_path || stackFile.web_path)
                    : true;
                  const hasDisplayableStackImage = hasProcessedStackThumb && (stackFile.thumb || stackThumbUrl);
                  const stackVideoSrc = stackIsVid ? getVideoThumbnailSource(stackFile) : '';

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
                          src={stackFile.thumb || stackThumbUrl}
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
          const hasDisplayableImage = hasProcessedThumb && (file.thumb || thumbUrl);
          const thumbSrc = file.thumb || thumbUrl;
          
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
          <div className="absolute inset-0 z-[2] flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 rounded-full p-1.5">
              <Play className="h-5 w-5 text-white fill-white" />
            </div>
          </div>
        )}

        {/* Hidden overlay */}
        {file.is_hidden && renderHiddenMediaOverlay()}

        {hasStack && (
          <>
            <div className="absolute bottom-1.5 right-1.5 z-[4] rounded-md border border-black/10 bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-slate-900 shadow-sm">
              {stackPosition}/{stackTotal}
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-1.5 right-1.5 z-[4] flex items-center justify-between opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
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
    const activeStackIndex = Math.min(stackPreviewIndexes[stack.id] ?? 0, stack.files.length - 1);
    const activeFile = stack.files[Math.max(0, activeStackIndex)] ?? stack.files[0];

    return renderFileCard(activeFile, index, false, stack);
  };

  const renderSortableFileCard = (file: MediaFile, index: number) => {
    const isSelected = selectedFiles.has(file.id);
    const isImg = isImage(file);
    const isVid = isVideo?.(file) ?? false;
    const isRaw = isRawFile(file.filename);
    const thumbUrl = getImageUrl(file, 'thumb');
    const ext = file.filename.split('.').pop()?.toUpperCase();
    const displayFilename = getDisplayMediaFilename(file) || file.filename;
    const videoThumbSrc = isVid ? getVideoThumbnailSource(file) : '';
    const actualIndex = sortedFiles.findIndex(f => f.id === file.id);
    const latestCommentText = getLatestCommentText(file);

    return (
      <SortableItemWrapper key={file.id} id={file.id}>
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
              const hasDisplayableImage = hasProcessedThumb && (file.thumb || thumbUrl);
              const thumbSrc = file.thumb || thumbUrl;

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
              <div className="absolute inset-0 z-[2] flex items-center justify-center pointer-events-none">
                <div className="bg-black/50 rounded-full p-1.5">
                  <Play className="h-5 w-5 text-white fill-white" />
                </div>
              </div>
            )}

            {file.is_hidden && renderHiddenMediaOverlay()}

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
              {latestCommentText && (
                <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2 max-h-0 opacity-0 group-hover:max-h-10 group-hover:opacity-100 transition-all">
                  {latestCommentText}
                </p>
              )}
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
    const displayFilename = getDisplayMediaFilename(file) || file.filename;
    const videoThumbSrc = isVid ? getVideoThumbnailSource(file) : '';
    const actualIndex = sortedFiles.findIndex(f => f.id === file.id);
    const isDragging = draggedId === file.id;
    const isDragOver = dragOverId === file.id;
    const latestCommentText = getLatestCommentText(file);

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
        <div className="relative w-24 h-16 sm:w-32 sm:h-20 flex-shrink-0 rounded overflow-hidden border bg-muted/40">
          {hasDisplayableImage ? (
            <img
              src={file.thumb || imageUrl}
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
          {file.isExtra && (
            <div className="absolute top-0.5 left-0.5 bg-orange-500 text-white text-[6px] px-0.5 py-0 rounded font-medium">
              EXTRA
            </div>
          )}
          {Number(file.comment_count ?? 0) > 0 && (
            <div className="absolute bottom-1 left-1 bg-white/90 text-slate-900 text-[9px] px-1 py-0.5 rounded-full font-medium flex items-center gap-1">
              <MessageSquare className="h-2.5 w-2.5" />
              {file.comment_count}
            </div>
          )}
          {file.is_hidden && renderHiddenMediaOverlay()}
        </div>

        {/* Filename - takes remaining space */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" title={displayFilename}>
            {displayFilename}
          </p>
          {latestCommentText && (
            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
              {latestCommentText}
            </p>
          )}
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
          {canDownloadSingleMedia && onDownloadSingle && (
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
    const videoThumbSrc = isVid ? getVideoThumbnailSource(file) : '';
    const actualIndex = sortedFiles.findIndex(f => f.id === file.id);
    const hasProcessedThumb = isRaw ? !!(file.thumbnail_path || file.web_path) : true;
    const hasDisplayableImage = hasProcessedThumb && (file.thumb || imageUrl);
    const latestCommentText = getLatestCommentText(file);

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

            <div className="relative w-24 h-16 sm:w-32 sm:h-20 flex-shrink-0 rounded overflow-hidden border bg-muted/40">
              {hasDisplayableImage ? (
                <img
                  src={file.thumb || imageUrl}
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
              {file.is_hidden && renderHiddenMediaOverlay()}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" title={displayFilename}>
                {displayFilename}
              </p>
              {latestCommentText && (
                <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                  {latestCommentText}
                </p>
              )}
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
              {canDownloadSingleMedia && onDownloadSingle && (
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
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                {regularFiles.map((file, index) => renderSortableFileCard(file, index))}
              </div>
          </SortableContext>
        </DndContext>
      ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
            {regularStacks.map((stack, index) => renderStackCard(stack, index))}
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
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
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
            <div className="w-36 flex-shrink-0" aria-hidden="true"></div>
            <div className="w-20 flex-shrink-0" aria-hidden="true"></div>
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
