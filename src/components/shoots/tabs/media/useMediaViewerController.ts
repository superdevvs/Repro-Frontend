import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useReducedMotion } from 'framer-motion';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import type { MediaFile } from '@/hooks/useShootFiles';
import {
  getDisplayMediaFilename,
  getMediaFullSizeImageUrl,
  getMediaVideoUrl,
  getMediaVideoUrlCandidates,
  getMediaViewerImageUrl,
} from './mediaPreviewUtils';
import { isRawFile } from '@/services/rawPreviewService';
import {
  triggerDashboardOverviewRefresh,
  triggerEditingRequestsRefresh,
  triggerShootDetailRefresh,
} from '@/realtime/realtimeRefreshBus';
import { blurActiveElement } from '../../dialogFocusUtils';
import {
  MAX_MEDIA_VIEWER_ZOOM,
  SLIDESHOW_INTERVAL_OPTIONS,
  formatViewerDateTime,
  formatViewerFileSize,
  type MediaIssueRequest,
  type MediaViewerProps,
} from './mediaViewerTypes';
export function useMediaViewerController({
  isOpen,
  onClose,
  files,
  currentIndex,
  onIndexChange,
  getImageUrl,
  getSrcSet: _getSrcSet,
  shoot,
  isAdmin = false,
  isClient = false,
  canViewFullSize = false,
  canStartSlideshow = false,
  canInteractSingleMedia = false,
  canDownloadSingleMedia = false,
  slideshowFiles = [],
  onViewerContextChange,
  onToggleFavorite,
  onAddComment,
  onToggleHidden,
  onDownloadSingle,
  onShootUpdate,
}: MediaViewerProps) {
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const isImageFile = (file: MediaFile): boolean => {
    const mediaType = (file.media_type || '').toLowerCase();
    const previewFile = file as MediaFile & { previewImages?: unknown; preview_images?: unknown };
    const hasPreviewImages =
      (Array.isArray(previewFile.previewImages) && previewFile.previewImages.length > 0) ||
      (Array.isArray(previewFile.preview_images) && previewFile.preview_images.length > 0);
    if (mediaType === 'floorplan' && (hasPreviewImages || file.thumbnail_path || file.thumb || file.medium || file.web_path)) {
      return true;
    }
    // If RAW file has processed thumbnail, it's displayable
    if ((file.media_type === 'raw' || file.media_type === 'image') && (file.thumbnail_path || file.thumb || file.medium || file.web_path)) {
      return true;
    }
    const name = file.filename.toLowerCase();
    const rawExt = /\.(nef|cr2|cr3|arw|dng|raf|rw2|orf|pef|srw|3fr|iiq)$/.test(name);
    if (rawExt) return false;
    const mime = (file.fileType || '').toLowerCase();
    const rawMime = mime.includes('nef') || mime.includes('dng') || mime.includes('cr2') || mime.includes('cr3') || mime.includes('arw') || mime.includes('raf') || mime.includes('raw');
    if (rawMime) return false;
    if (mime.startsWith('image/')) return true;
    return /\.(jpg|jpeg|png|gif|webp|tiff|tif|heic|heif)$/.test(name);
  };
  const isPreviewableImage = (file: MediaFile): boolean => {
    const mediaType = (file.media_type || '').toLowerCase();
    const previewFile = file as MediaFile & { previewImages?: unknown; preview_images?: unknown };
    const hasPreviewImages =
      (Array.isArray(previewFile.previewImages) && previewFile.previewImages.length > 0) ||
      (Array.isArray(previewFile.preview_images) && previewFile.preview_images.length > 0);
    if (mediaType === 'floorplan' && (hasPreviewImages || file.thumbnail_path || file.thumb || file.medium || file.web_path)) {
      return true;
    }
    // If RAW file has processed thumbnail, it's previewable
    if ((file.media_type === 'raw' || file.media_type === 'image') && (file.thumbnail_path || file.thumb || file.medium || file.web_path)) {
      return true;
    }
    const name = file.filename.toLowerCase();
    const rawExt = /\.(nef|cr2|cr3|arw|dng|raf|rw2|orf|pef|srw|3fr|iiq)$/.test(name);
    if (rawExt) return false;
    const mime = (file.fileType || '').toLowerCase();
    const rawMime = mime.includes('nef') || mime.includes('dng') || mime.includes('cr2') || mime.includes('cr3') || mime.includes('arw') || mime.includes('raf') || mime.includes('raw');
    if (rawMime) return false;
    if (mime.startsWith('image/')) return true;
    return /\.(jpg|jpeg|png|gif|webp|tiff|tif|heic|heif)$/.test(name);
  };
  const isVideoFile = (file: MediaFile): boolean => {
    if (file.media_type === 'video') return true;
    const name = (file.filename || '').toLowerCase();
    const mime = (file.fileType || '').toLowerCase();
    if (mime.startsWith('video/')) return true;
    return /\.(mp4|mov|avi|mkv|wmv|webm)$/.test(name);
  };
  const [zoom, setZoom] = useState(1);
  const [previewMode, setPreviewMode] = useState<'web' | 'full'>('web');
  const [viewerMode, setViewerMode] = useState<'standard' | 'slideshow'>('standard');
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [slideshowDirection, setSlideshowDirection] = useState<1 | -1>(1);
  const [slideshowPaused, setSlideshowPaused] = useState(false);
  const [slideshowIntervalSeconds, setSlideshowIntervalSeconds] = useState<number>(
    SLIDESHOW_INTERVAL_OPTIONS[0],
  );
  const [showSlideshowHint, setShowSlideshowHint] = useState(false);
  const [waitingForNextSlide, setWaitingForNextSlide] = useState(false);
  const [slideshowReadyVersion, setSlideshowReadyVersion] = useState(0);
  const [showRequestComposer, setShowRequestComposer] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagging, setFlagging] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const handleDownloadSingle = useCallback(async (fileId: string) => {
    const normalizedFileId = String(fileId);
    if (!onDownloadSingle || downloadingFileId === normalizedFileId) return;
    const startedAt = Date.now();
    setDownloadingFileId(normalizedFileId);
    try {
      await onDownloadSingle(normalizedFileId);
    } finally {
      const remainingFeedbackMs = Math.max(0, 400 - (Date.now() - startedAt));
      if (remainingFeedbackMs > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, remainingFeedbackMs));
      }
      setDownloadingFileId((current) => current === normalizedFileId ? null : current);
    }
  }, [downloadingFileId, onDownloadSingle]);
  const [commentDraft, setCommentDraft] = useState('');
  const [showFileDetails, setShowFileDetails] = useState(true);
  const [viewerRequests, setViewerRequests] = useState<MediaIssueRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestRefreshKey, setRequestRefreshKey] = useState(0);
  const [videoSourceIndex, setVideoSourceIndex] = useState(0);
  const slideshowPreloadRefs = useRef<Map<string, HTMLImageElement>>(new Map());
  const slideshowReadyUrlsRef = useRef<Set<string>>(new Set());
  const zoomStageRef = useRef<HTMLDivElement | null>(null);
  const previousZoomRef = useRef(1);
  const previousZoomContextRef = useRef('');
  const panStateRef = useRef({
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [isPanningZoomStage, setIsPanningZoomStage] = useState(false);
  const currentFile = files[currentIndex];
  const fileComments = useMemo(
    () => {
      const comments = Array.isArray(currentFile?.comments)
        ? currentFile.comments.filter((comment) => comment?.comment?.trim())
        : [];
      if (comments.length > 0) {
        return comments;
      }
      const latestSingleComment = currentFile?.latest_comment;
      return latestSingleComment && latestSingleComment.comment?.trim() ? [latestSingleComment] : [];
    },
    [currentFile],
  );
  const relatedRequests = useMemo(
    () => {
      const currentFileId = String(currentFile?.id ?? '');
      if (!currentFileId) {
        return [];
      }
      return viewerRequests
        .filter((request) => {
          const mediaIds = [
            ...(Array.isArray(request.mediaIds) ? request.mediaIds : []),
            request.mediaId,
          ]
            .filter(Boolean)
            .map((value) => String(value));
          return mediaIds.includes(currentFileId);
        })
        .sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });
    },
    [currentFile?.id, viewerRequests],
  );
  useEffect(() => {
    setCommentDraft('');
    setShowFileDetails(true);
    setShowRequestComposer(false);
    setFlagReason('');
    setVideoSourceIndex(0);
  }, [currentFile?.id]);
  useEffect(() => {
    setPreviewMode('web');
  }, [currentFile?.id, isOpen]);
  useEffect(() => {
    if (!isOpen || !shoot?.id) {
      return;
    }
    let cancelled = false;
    const loadViewerRequests = async () => {
      setRequestsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/issues`, {
          method: 'GET',
          headers: getApiHeaders(),
        });
        if (!response.ok) {
          throw new Error('Failed to load image requests');
        }
        const payload = await response.json();
        const nextRequests = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : [];
        if (!cancelled) {
          setViewerRequests(nextRequests);
        }
      } catch {
        if (!cancelled) {
          setViewerRequests([]);
        }
      } finally {
        if (!cancelled) {
          setRequestsLoading(false);
        }
      }
    };
    void loadViewerRequests();
    return () => {
      cancelled = true;
    };
  }, [isOpen, requestRefreshKey, shoot?.id]);
  const markSlideshowUrlReady = useCallback((url: string) => {
    if (!url || slideshowReadyUrlsRef.current.has(url)) {
      return;
    }
    slideshowReadyUrlsRef.current.add(url);
    setSlideshowReadyVersion((current) => current + 1);
  }, []);
  const preloadSlideshowUrl = useCallback((url: string) => {
    if (!url || slideshowReadyUrlsRef.current.has(url) || slideshowPreloadRefs.current.has(url)) {
      return;
    }
    const image = new Image();
    image.onload = () => markSlideshowUrlReady(url);
    image.onerror = () => markSlideshowUrlReady(url);
    image.src = url;
    if (image.complete) {
      markSlideshowUrlReady(url);
    }
    slideshowPreloadRefs.current.set(url, image);
  }, [markSlideshowUrlReady]);
  const eligibleSlideshowFiles = slideshowFiles.filter((file) => {
    if (!isPreviewableImage(file) || isVideoFile(file)) {
      return false;
    }
    return Boolean(getMediaViewerImageUrl(file));
  });
  const slideshowStartIndex = useMemo(() => {
    const currentId = String(currentFile?.id || '');
    if (currentId) {
      const matchedById = eligibleSlideshowFiles.findIndex((file) => String(file.id) === currentId);
      if (matchedById >= 0) {
        return matchedById;
      }
    }
    const currentName = currentFile ? getDisplayMediaFilename(currentFile).trim().toLowerCase() : '';
    if (currentName) {
      const matchedByName = eligibleSlideshowFiles.findIndex(
        (file) => getDisplayMediaFilename(file).trim().toLowerCase() === currentName,
      );
      if (matchedByName >= 0) {
        return matchedByName;
      }
    }
    return eligibleSlideshowFiles.length > 0 ? 0 : -1;
  }, [currentFile, eligibleSlideshowFiles]);
  const slideshowCurrentFile =
    viewerMode === 'slideshow' && slideshowIndex >= 0
      ? eligibleSlideshowFiles[slideshowIndex] ?? null
      : null;
  const slideshowCurrentImageUrl = slideshowCurrentFile ? getMediaViewerImageUrl(slideshowCurrentFile) : '';
  const nextSlideshowFile =
    viewerMode === 'slideshow' && slideshowIndex < eligibleSlideshowFiles.length - 1
      ? eligibleSlideshowFiles[slideshowIndex + 1]
      : null;
  const nextSlideshowImageUrl = nextSlideshowFile ? getMediaViewerImageUrl(nextSlideshowFile) : '';
  const currentSlideReady =
    viewerMode !== 'slideshow' ||
    !slideshowCurrentImageUrl ||
    (slideshowReadyVersion >= 0 && slideshowReadyUrlsRef.current.has(slideshowCurrentImageUrl));
  const nextSlideReady =
    !nextSlideshowImageUrl ||
    (slideshowReadyVersion >= 0 && slideshowReadyUrlsRef.current.has(nextSlideshowImageUrl));
  const slideshowAvailable =
    canStartSlideshow &&
    eligibleSlideshowFiles.length > 1 &&
    slideshowStartIndex >= 0 &&
    isPreviewableImage(currentFile);
  const isLastSlideshowSlide =
    viewerMode === 'slideshow' && slideshowIndex >= eligibleSlideshowFiles.length - 1;
  const updateViewerContextForSlideshow = useCallback(
    (nextIndex: number) => {
      onViewerContextChange?.(nextIndex, eligibleSlideshowFiles);
    },
    [eligibleSlideshowFiles, onViewerContextChange],
  );
  const exitSlideshow = useCallback(() => {
    if (viewerMode !== 'slideshow') {
      return;
    }
    if (slideshowCurrentFile) {
      const nextIndex = eligibleSlideshowFiles.findIndex((file) => file.id === slideshowCurrentFile.id);
      if (nextIndex >= 0) {
        updateViewerContextForSlideshow(nextIndex);
      }
    }
    setViewerMode('standard');
    setSlideshowPaused(false);
    setSlideshowIntervalSeconds(SLIDESHOW_INTERVAL_OPTIONS[0]);
    setWaitingForNextSlide(false);
    setShowSlideshowHint(false);
    setPreviewMode('web');
    setZoom(1);
    slideshowPreloadRefs.current.forEach((image) => {
      image.onload = null;
      image.onerror = null;
    });
    slideshowPreloadRefs.current.clear();
    slideshowReadyUrlsRef.current.clear();
    setSlideshowReadyVersion(0);
  }, [eligibleSlideshowFiles, slideshowCurrentFile, updateViewerContextForSlideshow, viewerMode]);
  const moveSlideshowToIndex = useCallback(
    (nextIndex: number, direction: 1 | -1) => {
      if (nextIndex < 0 || nextIndex >= eligibleSlideshowFiles.length) {
        return;
      }
      setSlideshowDirection(direction);
      setWaitingForNextSlide(false);
      setSlideshowIndex(nextIndex);
    },
    [eligibleSlideshowFiles.length],
  );
  const handleEnterSlideshow = useCallback(() => {
    if (!slideshowAvailable) {
      return;
    }
    setViewerMode('slideshow');
    setSlideshowIndex(slideshowStartIndex);
    setSlideshowDirection(1);
    setSlideshowPaused(false);
    setSlideshowIntervalSeconds(SLIDESHOW_INTERVAL_OPTIONS[0]);
    setWaitingForNextSlide(false);
    setShowSlideshowHint(true);
    setShowRequestComposer(false);
    setShowFileDetails(true);
    setPreviewMode('web');
    setZoom(1);
    slideshowPreloadRefs.current.forEach((image) => {
      image.onload = null;
      image.onerror = null;
    });
    slideshowPreloadRefs.current.clear();
    slideshowReadyUrlsRef.current.clear();
    setSlideshowReadyVersion(0);
  }, [slideshowAvailable, slideshowStartIndex]);
  const handleCycleSlideshowInterval = useCallback(() => {
    setSlideshowIntervalSeconds((current) => {
      const currentIndex = SLIDESHOW_INTERVAL_OPTIONS.indexOf(
        current as (typeof SLIDESHOW_INTERVAL_OPTIONS)[number],
      );
      if (currentIndex < 0) {
        return SLIDESHOW_INTERVAL_OPTIONS[0];
      }
      return SLIDESHOW_INTERVAL_OPTIONS[
        (currentIndex + 1) % SLIDESHOW_INTERVAL_OPTIONS.length
      ];
    });
  }, []);
  useEffect(() => {
    if (!isOpen) {
      setViewerMode('standard');
      setSlideshowPaused(false);
      setSlideshowIntervalSeconds(SLIDESHOW_INTERVAL_OPTIONS[0]);
      setWaitingForNextSlide(false);
      setShowSlideshowHint(false);
      slideshowPreloadRefs.current.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
      slideshowPreloadRefs.current.clear();
      slideshowReadyUrlsRef.current.clear();
      setSlideshowReadyVersion(0);
    }
  }, [isOpen]);
  useEffect(() => {
    if (viewerMode !== 'slideshow') {
      return;
    }
    const timer = window.setTimeout(() => {
      setShowSlideshowHint(false);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [viewerMode]);
  useEffect(() => {
    if (viewerMode !== 'slideshow') {
      return;
    }
    if (!slideshowCurrentFile) {
      setViewerMode('standard');
      return;
    }
    const keepUrls = [slideshowCurrentImageUrl, nextSlideshowImageUrl].filter(Boolean);
    keepUrls.forEach(preloadSlideshowUrl);
    let removedUrl = false;
    Array.from(slideshowPreloadRefs.current.entries()).forEach(([url, image]) => {
      if (keepUrls.includes(url)) {
        return;
      }
      image.onload = null;
      image.onerror = null;
      slideshowPreloadRefs.current.delete(url);
      removedUrl = slideshowReadyUrlsRef.current.delete(url) || removedUrl;
    });
    if (removedUrl) {
      setSlideshowReadyVersion((current) => current + 1);
    }
  }, [
    nextSlideshowImageUrl,
    preloadSlideshowUrl,
    slideshowCurrentFile,
    slideshowCurrentImageUrl,
    viewerMode,
  ]);
  useEffect(() => {
    if (viewerMode !== 'slideshow') {
      return;
    }
    setWaitingForNextSlide(false);
  }, [slideshowIndex, viewerMode]);
  useEffect(() => {
    if (!isLastSlideshowSlide) {
      return;
    }
    setSlideshowPaused(true);
    setWaitingForNextSlide(false);
  }, [isLastSlideshowSlide]);
  useEffect(() => {
    if (
      viewerMode !== 'slideshow' ||
      slideshowPaused ||
      !currentSlideReady ||
      !slideshowCurrentImageUrl ||
      isLastSlideshowSlide
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (nextSlideReady) {
        moveSlideshowToIndex(slideshowIndex + 1, 1);
        return;
      }
      setWaitingForNextSlide(true);
    }, slideshowIntervalSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [
    currentSlideReady,
    isLastSlideshowSlide,
    moveSlideshowToIndex,
    nextSlideReady,
    slideshowCurrentImageUrl,
    slideshowIntervalSeconds,
    slideshowIndex,
    slideshowPaused,
    viewerMode,
  ]);
  useEffect(() => {
    if (
      viewerMode !== 'slideshow' ||
      !waitingForNextSlide ||
      !nextSlideReady ||
      isLastSlideshowSlide
    ) {
      return;
    }
    moveSlideshowToIndex(slideshowIndex + 1, 1);
  }, [
    isLastSlideshowSlide,
    moveSlideshowToIndex,
    nextSlideReady,
    slideshowIndex,
    viewerMode,
    waitingForNextSlide,
  ]);
  const handleFlagImage = async () => {
    if (!shoot || !currentFile || !flagReason.trim()) return;
    setFlagging(true);
    try {
      const headers = getApiHeaders();
      // Create an issue linked to this media file
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          note: flagReason.trim(),
          mediaId: currentFile.id,
        }),
      });
      if (!res.ok) throw new Error('Failed to create issue');
      toast({
        title: 'Success',
        description: 'Request created successfully. It will appear in the Requests tab.',
      });
      setShowRequestComposer(false);
      setFlagReason('');
      setRequestRefreshKey((current) => current + 1);
      triggerEditingRequestsRefresh();
      triggerDashboardOverviewRefresh();
      triggerShootDetailRefresh(shoot.id);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('shoot-request-created', {
            detail: {
              shootId: String(shoot.id),
              mediaId: String(currentFile.id),
            },
          }),
        );
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create request for this image',
        variant: 'destructive',
      });
    } finally {
      setFlagging(false);
    }
  };
  const handleSetHeroImage = async () => {
    if (!shoot || !currentFile) {
      return;
    }
    try {
      const headers = getApiHeaders();
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/media/${currentFile.id}/cover`, {
        method: 'POST',
        headers,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      toast({ title: 'Hero Image', description: 'Hero image updated successfully' });
      onShootUpdate?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to set hero image',
        variant: 'destructive',
      });
    }
  };
  /**
   * The stage swaps `src` on one <img>, so a full-size load that fails leaves the
   * browser's broken-image glyph with nothing to fall back to. Drop back to the
   * web rendition instead of stranding the user on a dead frame.
   */
  const handleStageImageError = useCallback(() => {
    setPreviewMode((current) => {
      if (current !== 'full') {
        return current;
      }

      toast({
        title: 'Full-size preview unavailable',
        description: 'Showing the web-sized version instead.',
      });

      return 'web';
    });
  }, [toast]);
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, MAX_MEDIA_VIEWER_ZOOM));
  };
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };
  const handleResetZoom = () => {
    setZoom(1);
  };
  const stopZoomPan = useCallback((pointerId?: number | null) => {
    const stage = zoomStageRef.current;
    const activePointerId = pointerId ?? panStateRef.current.pointerId;
    if (stage && typeof activePointerId === 'number' && stage.hasPointerCapture?.(activePointerId)) {
      stage.releasePointerCapture(activePointerId);
    }
    panStateRef.current.pointerId = null;
    setIsPanningZoomStage(false);
  }, []);
  const handleZoomStagePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isPreviewableImage(currentFile) || zoom <= 1 || event.button !== 0) {
        return;
      }
      if (event.target instanceof HTMLElement && event.target.closest('button')) {
        return;
      }
      const stage = zoomStageRef.current;
      if (!stage) {
        return;
      }
      if (stage.scrollWidth <= stage.clientWidth && stage.scrollHeight <= stage.clientHeight) {
        return;
      }
      panStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: stage.scrollLeft,
        scrollTop: stage.scrollTop,
      };
      stage.setPointerCapture?.(event.pointerId);
      setIsPanningZoomStage(true);
      event.preventDefault();
    },
    [currentFile, zoom],
  );
  const handleZoomStagePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (panStateRef.current.pointerId !== event.pointerId) {
        return;
      }
      const stage = zoomStageRef.current;
      if (!stage) {
        return;
      }
      const deltaX = event.clientX - panStateRef.current.startX;
      const deltaY = event.clientY - panStateRef.current.startY;
      stage.scrollLeft = panStateRef.current.scrollLeft - deltaX;
      stage.scrollTop = panStateRef.current.scrollTop - deltaY;
    },
    [],
  );
  const handleZoomStagePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (panStateRef.current.pointerId !== event.pointerId) {
        return;
      }
      stopZoomPan(event.pointerId);
    },
    [stopZoomPan],
  );
  const handlePrevious = () => {
    if (viewerMode === 'slideshow') {
      moveSlideshowToIndex(slideshowIndex - 1, -1);
      return;
    }
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
      setZoom(1); // Reset zoom when navigating
    }
  };
  const handleNext = () => {
    if (viewerMode === 'slideshow') {
      moveSlideshowToIndex(slideshowIndex + 1, 1);
      return;
    }
    if (currentIndex < files.length - 1) {
      onIndexChange(currentIndex + 1);
      setZoom(1); // Reset zoom when navigating
    }
  };
  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewerMode === 'slideshow') {
        if (e.key === 'Escape') {
          e.preventDefault();
          exitSlideshow();
        } else if (e.key === 'ArrowLeft' && slideshowIndex > 0) {
          e.preventDefault();
          moveSlideshowToIndex(slideshowIndex - 1, -1);
        } else if (e.key === 'ArrowRight' && slideshowIndex < eligibleSlideshowFiles.length - 1) {
          e.preventDefault();
          moveSlideshowToIndex(slideshowIndex + 1, 1);
        } else if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          if (!isLastSlideshowSlide) {
            setSlideshowPaused((current) => !current);
          }
        }
        return;
      }
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onIndexChange(currentIndex - 1);
        setZoom(1);
      } else if (e.key === 'ArrowRight' && currentIndex < files.length - 1) {
        onIndexChange(currentIndex + 1);
        setZoom(1);
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom(prev => Math.min(prev + 0.25, MAX_MEDIA_VIEWER_ZOOM));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom(prev => Math.max(prev - 0.25, 0.5));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentIndex,
    eligibleSlideshowFiles.length,
    exitSlideshow,
    files.length,
    isLastSlideshowSlide,
    isOpen,
    moveSlideshowToIndex,
    onClose,
    onIndexChange,
    slideshowIndex,
    viewerMode,
  ]);
  useEffect(() => {
    const stage = zoomStageRef.current;
    const zoomContextKey = `${currentFile?.id ?? ''}:${previewMode}`;
    const zoomChangedFromFit = previousZoomRef.current <= 1 && zoom > 1;
    const zoomContextChanged = previousZoomContextRef.current !== zoomContextKey;
    previousZoomRef.current = zoom;
    previousZoomContextRef.current = zoomContextKey;
    if (!stage) {
      return;
    }
    if (zoom <= 1) {
      stage.scrollTo({ left: 0, top: 0 });
      stopZoomPan();
      return;
    }
    if (!zoomChangedFromFit && !zoomContextChanged) {
      return;
    }
    const animationFrame = window.requestAnimationFrame(() => {
      stage.scrollTo({
        left: Math.max((stage.scrollWidth - stage.clientWidth) / 2, 0),
        top: Math.max((stage.scrollHeight - stage.clientHeight) / 2, 0),
      });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [currentFile?.id, previewMode, stopZoomPan, zoom]);
  if (!isOpen || !currentFile) return null;
  const previewImageUrl = getMediaViewerImageUrl(currentFile);
  const fullSizeImageUrl = getMediaFullSizeImageUrl(currentFile);
  const isImg = isPreviewableImage(currentFile);
  const isVid = isVideoFile(currentFile);
  const videoUrlCandidates = isVid ? getMediaVideoUrlCandidates(currentFile) : [];
  const videoUrl = videoUrlCandidates[videoSourceIndex] || getMediaVideoUrl(currentFile);
  const fileExt = currentFile?.filename?.split('.')?.pop()?.toUpperCase();
  const displayFilename = getDisplayMediaFilename(currentFile) || currentFile.filename;
  const mediaType = (currentFile.media_type || '').toLowerCase();
  const fullSizeAvailable = Boolean(
    fullSizeImageUrl &&
      previewImageUrl &&
      fullSizeImageUrl !== previewImageUrl,
  );
  const imageUrl =
    previewMode === 'full' && fullSizeAvailable
      ? fullSizeImageUrl
      : previewImageUrl;
  const zoomedImageViewportStyle =
    zoom > 1
      ? {
          width: `${zoom * 100}%`,
          height: `${zoom * 100}%`,
        }
      : undefined;
  const canRequestModification = Boolean(shoot) && isImg && (isAdmin || isClient);
  const canSetHero =
    Boolean(shoot) &&
    isImg &&
    !isVid &&
    (isAdmin ||
      (isClient &&
        !currentFile.is_hidden &&
        !currentFile.isExtra &&
        mediaType !== 'raw' &&
        mediaType !== 'extra' &&
        mediaType !== 'floorplan' &&
        ['completed', 'verified'].includes((currentFile.workflowStage || '').toLowerCase())));
  const detailRows: Array<{ label: string; value: string }> = [
    {
      label: 'Type',
      value: currentFile.fileType?.split('/').pop()?.toUpperCase() || fileExt || '—',
    },
    {
      label: 'Media',
      value: currentFile.media_type ? String(currentFile.media_type).replace(/_/g, ' ') : '—',
    },
    {
      label: 'Stage',
      value: currentFile.workflowStage ? String(currentFile.workflowStage).replace(/_/g, ' ') : '—',
    },
    {
      label: 'Edited with AI',
      value: currentFile.is_ai_edited || currentFile.isAiEdited ? 'Yes' : 'No',
    },
    {
      label: 'Resolution',
      value: currentFile.width && currentFile.height ? `${currentFile.width} × ${currentFile.height}` : '—',
    },
    {
      label: 'Captured',
      value: formatViewerDateTime(currentFile.captured_at || currentFile.created_at),
    },
    {
      label: 'Size',
      value: !isClient ? formatViewerFileSize(currentFile.fileSize) : '—',
    },
  ];
  const slideshowMotionVariants = {
    initial: (direction: 1 | -1) => ({
      opacity: 0,
      scale: prefersReducedMotion ? 1 : 1.025,
      x: prefersReducedMotion ? 0 : direction > 0 ? 28 : -28,
      y: prefersReducedMotion ? 0 : 6,
      filter: prefersReducedMotion ? 'none' : 'blur(8px)',
    }),
    animate: {
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: prefersReducedMotion ? 0.2 : 0.72,
        ease: [0.22, 1, 0.36, 1],
      },
    },
    exit: (direction: 1 | -1) => ({
      opacity: 0,
      scale: prefersReducedMotion ? 1 : 0.985,
      x: prefersReducedMotion ? 0 : direction > 0 ? -22 : 22,
      y: prefersReducedMotion ? 0 : -4,
      filter: prefersReducedMotion ? 'none' : 'blur(6px)',
      transition: {
        duration: prefersReducedMotion ? 0.18 : 0.5,
        ease: [0.4, 0, 0.2, 1],
      },
    }),
  };
  const sidebarActionButtonClassName =
    'h-auto min-h-10 min-w-0 justify-start whitespace-normal break-words !border-white/10 !bg-black/40 px-3 py-2 text-left text-[13px] leading-snug !text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:!border-white/20 hover:!bg-black/55 hover:!text-white focus-visible:ring-white/30 lg:min-h-9 lg:px-2.5 lg:py-1.5 lg:text-[12px] xl:min-h-10 xl:px-3 xl:py-2 xl:text-sm';
  const mobileActionMenuItemClassName =
    'gap-2 rounded-md px-2 py-2 text-sm text-white focus:bg-white/10 focus:text-white';
  const showMobileActionMenu =
    canSetHero ||
    (canInteractSingleMedia && Boolean(onToggleFavorite)) ||
    (canDownloadSingleMedia && Boolean(onDownloadSingle)) ||
    Boolean(onToggleHidden) ||
    canRequestModification ||
    slideshowAvailable;
  const fitMediaClassName =
    'block h-full max-h-full min-h-0 w-full max-w-full min-w-0 select-none object-contain object-top rounded-none shadow-none md:object-center lg:rounded-xl lg:shadow-2xl';
  return {
    isOpen,
    onClose,
    files,
    currentIndex,
    onIndexChange,
    getImageUrl,
    _getSrcSet,
    shoot,
    isAdmin,
    isClient,
    canViewFullSize,
    canStartSlideshow,
    canInteractSingleMedia,
    canDownloadSingleMedia,
    slideshowFiles,
    onViewerContextChange,
    onToggleFavorite,
    onAddComment,
    onToggleHidden,
    onDownloadSingle,
    downloadingFileId,
    handleDownloadSingle,
    onShootUpdate,
    toast,
    prefersReducedMotion,
    isImageFile,
    isPreviewableImage,
    isVideoFile,
    zoom,
    setZoom,
    previewMode,
    setPreviewMode,
    handleStageImageError,
    viewerMode,
    setViewerMode,
    slideshowIndex,
    setSlideshowIndex,
    slideshowDirection,
    setSlideshowDirection,
    slideshowPaused,
    setSlideshowPaused,
    slideshowIntervalSeconds,
    setSlideshowIntervalSeconds,
    showSlideshowHint,
    setShowSlideshowHint,
    waitingForNextSlide,
    setWaitingForNextSlide,
    slideshowReadyVersion,
    setSlideshowReadyVersion,
    showRequestComposer,
    setShowRequestComposer,
    flagReason,
    setFlagReason,
    flagging,
    setFlagging,
    commentDraft,
    setCommentDraft,
    showFileDetails,
    setShowFileDetails,
    viewerRequests,
    setViewerRequests,
    requestsLoading,
    setRequestsLoading,
    requestRefreshKey,
    setRequestRefreshKey,
    videoSourceIndex,
    setVideoSourceIndex,
    slideshowPreloadRefs,
    slideshowReadyUrlsRef,
    zoomStageRef,
    previousZoomRef,
    previousZoomContextRef,
    panStateRef,
    isPanningZoomStage,
    setIsPanningZoomStage,
    currentFile,
    fileComments,
    relatedRequests,
    markSlideshowUrlReady,
    preloadSlideshowUrl,
    eligibleSlideshowFiles,
    slideshowStartIndex,
    slideshowCurrentFile,
    slideshowCurrentImageUrl,
    nextSlideshowFile,
    nextSlideshowImageUrl,
    currentSlideReady,
    nextSlideReady,
    slideshowAvailable,
    isLastSlideshowSlide,
    updateViewerContextForSlideshow,
    exitSlideshow,
    moveSlideshowToIndex,
    handleEnterSlideshow,
    handleCycleSlideshowInterval,
    handleFlagImage,
    handleSetHeroImage,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    stopZoomPan,
    handleZoomStagePointerDown,
    handleZoomStagePointerMove,
    handleZoomStagePointerUp,
    handlePrevious,
    handleNext,
    previewImageUrl,
    fullSizeImageUrl,
    isImg,
    isVid,
    videoUrlCandidates,
    videoUrl,
    fileExt,
    displayFilename,
    mediaType,
    fullSizeAvailable,
    imageUrl,
    zoomedImageViewportStyle,
    canRequestModification,
    canSetHero,
    detailRows,
    slideshowMotionVariants,
    sidebarActionButtonClassName,
    mobileActionMenuItemClassName,
    showMobileActionMenu,
    fitMediaClassName,
  };
}
