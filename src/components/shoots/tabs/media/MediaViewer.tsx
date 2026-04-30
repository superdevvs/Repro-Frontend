import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { type ShootData } from '@/types/shoots';
import { type MediaFile } from '@/hooks/useShootFiles';
import { getDisplayMediaFilename, getMediaFullSizeImageUrl, getMediaVideoPreviewUrl, getMediaVideoUrl, getMediaVideoUrlCandidates, getMediaViewerImageUrl } from './mediaPreviewUtils';
import { isRawFile } from '@/services/rawPreviewService';
import VideoThumbnail from '../../VideoThumbnail';
import {
  triggerDashboardOverviewRefresh,
  triggerEditingRequestsRefresh,
  triggerShootDetailRefresh,
} from '@/realtime/realtimeRefreshBus';
import { blurActiveElement } from '../../dialogFocusUtils';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Eye, EyeOff, FileIcon, Heart, Loader2, MoreHorizontal, Pause, Play, X } from 'lucide-react';

// Media Viewer Component
interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  files: MediaFile[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  getImageUrl: (file: MediaFile, size?: 'thumb' | 'web' | 'medium' | 'large' | 'original') => string;
  getSrcSet?: (file: MediaFile) => string;
  shoot?: ShootData;
  isAdmin?: boolean;
  isClient?: boolean;
  canViewFullSize?: boolean;
  canStartSlideshow?: boolean;
  canInteractSingleMedia?: boolean;
  canDownloadSingleMedia?: boolean;
  slideshowFiles?: MediaFile[];
  onViewerContextChange?: (index: number, files: MediaFile[]) => void;
  onToggleFavorite?: (fileId: string) => void;
  onAddComment?: (fileId: string, comment: string) => void;
  onToggleHidden?: (fileId: string, hidden: boolean) => void;
  onDownloadSingle?: (fileId: string) => void;
  onShootUpdate?: () => void;
}

interface MediaIssueRequest {
  id: string;
  mediaId?: string;
  mediaIds?: string[];
  note: string;
  status: 'open' | 'in-progress' | 'resolved' | string;
  createdAt?: string;
  updatedAt?: string;
  assignedToRole?: 'editor' | 'photographer' | string;
  raisedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };
}

const formatViewerFileSize = (bytes?: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatViewerDateTime = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const getRequestStatusClassName = (status?: string) => {
  if (status === 'resolved') return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200';
  if (status === 'in-progress') return 'border-amber-500/30 bg-amber-500/15 text-amber-100';
  return 'border-rose-500/30 bg-rose-500/15 text-rose-100';
};

const SLIDESHOW_INTERVAL_OPTIONS = [5, 7, 10, 3] as const;
const MAX_MEDIA_VIEWER_ZOOM = 10;

export function MediaViewer({
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
          assignedToRole: 'editor', // Auto-assign to editor for image corrections
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
      onShootUpdate?.();
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
  const currentFileIsRaw = mediaType === 'raw' || isRawFile(currentFile.filename);
  const fullSizeAvailable = Boolean(
    !currentFileIsRaw &&
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
  const previewSizeControls = renderPreviewSizeControls('hidden md:flex md:justify-self-end');
  const mobilePreviewSizeControls = renderPreviewSizeControls(
    'pointer-events-auto justify-end',
    'bg-black/60',
  );
  const zoomControls = isImg ? (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-40 flex justify-center sm:bottom-4">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-xl border border-white/10 bg-black/60 p-1 text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="!fixed !inset-0 !translate-x-0 !translate-y-0 max-w-none max-h-none w-screen h-screen overflow-hidden p-0 bg-black/95 backdrop-blur-md border-0 rounded-none [&>button:last-child]:hidden"
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: 'none',
          width: '100vw',
          height: '100dvh',
          zIndex: 100,
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Media Viewer</DialogTitle>
          <DialogDescription>
            View and navigate through media files for this shoot
          </DialogDescription>
        </DialogHeader>
        {/* Glass blur overlay background */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {viewerMode === 'slideshow' && slideshowCurrentFile ? (
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

            <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
              {!currentSlideReady && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/45 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-white/70" />
                  <p className="text-sm text-white/60">
                    {waitingForNextSlide ? 'Loading next image…' : 'Preparing slideshow…'}
                  </p>
                </div>
              )}

              <AnimatePresence mode="wait" custom={slideshowDirection}>
                <motion.img
                  key={slideshowCurrentFile.id}
                  custom={slideshowDirection}
                  variants={slideshowMotionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  src={slideshowCurrentImageUrl}
                  alt={getDisplayMediaFilename(slideshowCurrentFile) || slideshowCurrentFile.filename}
                  className="absolute inset-0 h-full w-full select-none object-cover"
                  draggable={false}
                  loading="eager"
                  onLoad={() => markSlideshowUrlReady(slideshowCurrentImageUrl)}
                  onError={() => markSlideshowUrlReady(slideshowCurrentImageUrl)}
                />
              </AnimatePresence>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4 sm:pb-6">
              <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-2 text-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-white hover:bg-white/10"
                  onClick={handlePrevious}
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
                  onClick={handleNext}
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
        ) : (
        <div className="relative z-10 flex h-full w-full min-h-0 overflow-hidden items-stretch justify-stretch">
          {showMobileActionMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-12 top-2 z-20 h-9 w-9 rounded-full border border-white/10 bg-black/40 text-white hover:bg-white/20 xl:hidden"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="z-[120] min-w-[220px] border-white/10 bg-neutral-950/95 text-white backdrop-blur-md"
              >
                {canSetHero && (
                  <DropdownMenuItem
                    className={mobileActionMenuItemClassName}
                    onSelect={handleSetHeroImage}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Make hero
                  </DropdownMenuItem>
                )}
                {canInteractSingleMedia && onToggleFavorite && (
                  <DropdownMenuItem
                    className={mobileActionMenuItemClassName}
                    onSelect={() => onToggleFavorite(currentFile.id)}
                  >
                    <Heart className={`h-4 w-4 ${currentFile.is_favorite ? 'fill-current' : ''}`} />
                    {currentFile.is_favorite ? 'Liked' : 'Like'}
                  </DropdownMenuItem>
                )}
                {canDownloadSingleMedia && onDownloadSingle && (
                  <DropdownMenuItem
                    className={mobileActionMenuItemClassName}
                    onSelect={() => onDownloadSingle(currentFile.id)}
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                )}
                {onToggleHidden && (
                  <DropdownMenuItem
                    className={mobileActionMenuItemClassName}
                    onSelect={() => onToggleHidden(currentFile.id, !currentFile.is_hidden)}
                  >
                    {currentFile.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {currentFile.is_hidden ? 'Unhide image' : 'Hide image'}
                  </DropdownMenuItem>
                )}
                {slideshowAvailable && (
                  <DropdownMenuItem
                    className={mobileActionMenuItemClassName}
                    onSelect={handleEnterSlideshow}
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Slideshow
                  </DropdownMenuItem>
                )}
                {canRequestModification && (
                  <DropdownMenuItem
                    className={mobileActionMenuItemClassName}
                    onSelect={() => {
                      blurActiveElement();
                      setShowRequestComposer((current) => !current);
                    }}
                  >
                    <AlertCircle className="h-4 w-4" />
                    Request modification
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-20 h-9 w-9 rounded-full text-white hover:bg-white/20 sm:right-4 sm:top-3 sm:h-10 sm:w-10 lg:right-3 lg:top-2.5"
            onClick={onClose}
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
          {canRequestModification && showRequestComposer && (
            <div className="absolute inset-x-3 top-16 z-30 max-h-[calc(100dvh-8rem)] overflow-auto rounded-xl border border-rose-500/25 bg-neutral-950/95 p-3 text-white shadow-2xl backdrop-blur-md sm:left-auto sm:right-14 sm:w-[24rem] xl:hidden">
              <p className="text-sm font-medium text-white">Create request</p>
              <p className="mt-1 text-xs text-white/65">
                Request any changes for this image.
              </p>
              <Textarea
                value={flagReason}
                onChange={(event) => setFlagReason(event.target.value)}
                placeholder="Request any changes in this image..."
                className="mt-3 min-h-[80px] resize-none border-white/10 bg-black/30 text-white placeholder:text-white/45"
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-white hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setShowRequestComposer(false);
                    setFlagReason('');
                  }}
                  disabled={flagging}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleFlagImage}
                  disabled={!flagReason.trim() || flagging}
                  variant="destructive"
                >
                  {flagging ? 'Creating request...' : 'Create request'}
                </Button>
              </div>
            </div>
          )}

          <div className="flex h-full w-full min-h-0 min-w-0 flex-col px-1.5 pb-1.5 pt-1.5 sm:px-3 sm:pb-3 sm:pt-2 lg:px-2.5 lg:pb-2.5 lg:pt-2 2xl:px-3 2xl:pb-3 2xl:pt-2.5">
            <div className="grid min-h-0 min-w-0 w-full max-w-full flex-1 grid-cols-1 gap-2.5 overflow-hidden xl:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_19.5rem]">
              <div className="grid min-h-0 min-w-0 w-full max-w-full grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-md md:grid-rows-[auto_minmax(0,1fr)_auto] sm:rounded-2xl">
                {/* Top Metadata Bar */}
                <div className="grid min-w-0 select-none grid-cols-1 gap-1 border-b border-white/10 px-3 py-3 pr-24 sm:gap-2 sm:px-3 sm:py-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-3 lg:px-3 lg:py-2 xl:pr-3 2xl:px-3 2xl:py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold leading-tight text-white sm:text-sm lg:text-[15px] xl:text-base">{displayFilename}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-white/60 sm:text-[11px]">
                      <span>{currentIndex + 1} of {files.length}</span>
                      {currentFile.width && currentFile.height && <span>{currentFile.width} × {currentFile.height}</span>}
                      {!isClient && currentFile.fileSize && <span>{formatViewerFileSize(currentFile.fileSize)}</span>}
                    </div>
                  </div>
                  {!isImg && (
                    <p className="hidden justify-self-end text-[11px] text-white/55 md:block">Use ← → to navigate • ESC to close</p>
                  )}
                  {isImg && previewSizeControls}
                </div>

                  <div className="min-h-0 min-w-0 w-full px-1 pb-1 pt-1 sm:px-2.5 sm:pb-2.5 sm:pt-2 md:h-full lg:px-1.5 lg:pb-1.5 lg:pt-1.5 2xl:px-2 2xl:pb-2">
                    <div className="relative mx-auto aspect-square max-h-[calc(100dvh-17rem)] w-full max-w-full overflow-hidden bg-black/75 sm:rounded-lg md:h-full md:max-h-none md:aspect-auto md:max-w-none lg:min-h-0 lg:rounded-lg lg:bg-black/50 xl:rounded-xl">
                      {isImg && (
                        <div className="pointer-events-none absolute right-3 top-3 z-40 flex justify-end md:hidden">
                          {mobilePreviewSizeControls}
                        </div>
                      )}
                      {zoomControls}
                      {currentIndex > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute left-3 top-1/2 z-30 h-9 w-9 -translate-y-1/2 rounded-full border border-white/10 bg-black/55 text-white shadow-lg hover:bg-white/15 sm:left-4 sm:h-10 sm:w-10"
                          onClick={handlePrevious}
                        >
                          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                        </Button>
                      )}

                      {currentIndex < files.length - 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-3 top-1/2 z-30 h-9 w-9 -translate-y-1/2 rounded-full border border-white/10 bg-black/55 text-white shadow-lg hover:bg-white/15 sm:right-4 sm:h-10 sm:w-10"
                          onClick={handleNext}
                        >
                          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                        </Button>
                      )}
                    <div
                      ref={zoomStageRef}
                      className={`absolute inset-0 flex min-h-0 min-w-0 items-center justify-center px-2 py-2 sm:px-10 sm:py-1.5 md:px-16 lg:px-20 lg:py-1 xl:px-20 xl:py-1.5 2xl:px-24 ${
                        zoom > 1
                          ? `${isPanningZoomStage ? 'cursor-grabbing' : 'cursor-grab'} touch-none overflow-auto`
                          : 'overflow-hidden'
                      }`}
                      onPointerDown={handleZoomStagePointerDown}
                      onPointerMove={handleZoomStagePointerMove}
                      onPointerUp={handleZoomStagePointerUp}
                      onPointerCancel={handleZoomStagePointerUp}
                      onLostPointerCapture={() => stopZoomPan()}
                    >
                      {isImg ? (
                        zoom > 1 ? (
                          <div
                            className="relative flex shrink-0 items-center justify-center"
                            style={zoomedImageViewportStyle}
                          >
                            <img
                              src={imageUrl}
                              alt={displayFilename}
                              className={fitMediaClassName}
                              loading="eager"
                              draggable={false}
                            />
                          </div>
                        ) : (
                            <img
                              src={imageUrl}
                              alt={displayFilename}
                              className={fitMediaClassName}
                              loading="eager"
                              draggable={false}
                            />
                        )
                        ) : isVid ? (
                        videoUrl ? (
                          <video
                            key={`${currentFile.id}-${videoUrl}`}
                            src={videoUrl}
                            controls
                            playsInline
                            preload="metadata"
                            className={`${fitMediaClassName} bg-black`}
                            style={{ outline: 'none' }}
                            onError={() => {
                              setVideoSourceIndex((current) => {
                                const next = current + 1;
                                return next < videoUrlCandidates.length ? next : current;
                              });
                            }}
                          />
                        ) : (
                          <div className="max-w-sm text-center text-white">
                            <FileIcon className="mx-auto mb-4 h-12 w-12 sm:h-16 sm:w-16" />
                            <p className="text-sm sm:text-base">Video preview is not available.</p>
                          </div>
                        )
                      ) : (
                        <div className="text-white text-center">
                          <FileIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4" />
                          <p className="text-sm sm:text-base">{displayFilename}</p>
                        </div>
                      )}
                    </div>
                    </div>
                  </div>

                  {/* Bottom Filmstrip */}
                    <div className="border-t border-white/10 px-2.5 py-2 sm:px-3 sm:py-2.5 lg:px-2.5 lg:py-1.5 2xl:px-3 2xl:py-2">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 lg:mb-1">
                        <div>
                          <p className="text-[13px] font-medium text-white sm:text-sm">All media</p>
                          <p className="text-[10px] text-white/55 sm:text-[11px]">
                            {isImg ? 'Use ← → to navigate • + - to zoom • ESC to close' : 'Use ← → to navigate • ESC to close'}
                          </p>
                      </div>
                      <p className="text-[10px] text-white/50 sm:text-[11px]">{currentIndex + 1} of {files.length}</p>
                    </div>

                    {/* Filmstrip Thumbnails */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                      {files.map((file, index) => {
                        const isActive = index === currentIndex;
                        const fileImageUrl = getImageUrl(file, 'thumb');
                        const fileIsImg = isImageFile(file);
                        const fileIsVid = isVideoFile(file);
                        const fileIsRaw = isRawFile(file.filename);
                        const fileVideoThumbUrl = fileIsVid ? getMediaVideoUrl(file) || getMediaVideoPreviewUrl(file) : '';
                        const hasDisplayableThumb = fileIsRaw
                          ? !!(file.thumbnail_path || file.web_path)
                          : Boolean(fileImageUrl && (fileIsImg || fileIsVid));

                        return (
                          <button
                            key={file.id}
                            onClick={() => {
                              onIndexChange(index);
                              setZoom(1);
                            }}
                            className={`relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:h-12 sm:w-12 sm:rounded-xl md:h-14 md:w-14 lg:h-14 lg:w-14 xl:h-16 xl:w-16 2xl:h-[4.5rem] 2xl:w-[4.5rem] ${
                              isActive
                                ? 'border-white ring-2 ring-white/50 scale-[1.03]'
                                : 'border-white/20 hover:border-white/60 opacity-70 hover:opacity-100'
                            }`}
                          >
                            {hasDisplayableThumb && fileImageUrl ? (
                              <img
                                src={fileImageUrl}
                                alt={file.filename}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            {fileIsVid && !hasDisplayableThumb && fileVideoThumbUrl ? (
                              <VideoThumbnail
                                src={fileVideoThumbUrl}
                                alt={file.filename}
                                className="absolute inset-0 z-[1] h-full w-full object-cover"
                              />
                            ) : null}
                            <div
                              className="w-full h-full bg-muted items-center justify-center"
                              style={{ display: hasDisplayableThumb && fileImageUrl ? 'none' : 'flex' }}
                            >
                              {fileIsVid ? (
                                <Play className="h-6 w-6 text-muted-foreground" />
                              ) : (
                                <FileIcon className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                            {fileIsVid && (
                              <div className="absolute inset-0 z-[2] flex items-center justify-center">
                                <div className="bg-black/50 rounded-full p-0.5">
                                  <Play className="h-3 w-3 sm:h-4 sm:w-4 text-white fill-white" />
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="min-h-0 overflow-hidden border-t border-white/10 px-2.5 py-2 text-white md:hidden">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-medium">Comments</p>
                      <Badge className="border-white/10 bg-white/10 text-white/80 hover:bg-white/10">
                        {Number(currentFile.comment_count ?? fileComments.length)}
                      </Badge>
                    </div>
                    {(canSetHero ||
                      (canInteractSingleMedia && onToggleFavorite) ||
                      (canDownloadSingleMedia && onDownloadSingle) ||
                      onToggleHidden ||
                      canRequestModification) && (
                      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                        {canSetHero && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-lg !border-white/10 !bg-black/35 !text-white hover:!bg-white/10"
                            onClick={handleSetHeroImage}
                            title="Make hero"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        {canInteractSingleMedia && onToggleFavorite && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-lg !border-white/10 !bg-black/35 !text-white hover:!bg-white/10"
                            onClick={() => onToggleFavorite(currentFile.id)}
                            title={currentFile.is_favorite ? 'Unlike image' : 'Like image'}
                          >
                            <Heart className={`h-4 w-4 ${currentFile.is_favorite ? 'fill-current' : ''}`} />
                          </Button>
                        )}
                        {canDownloadSingleMedia && onDownloadSingle && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-lg !border-white/10 !bg-black/35 !text-white hover:!bg-white/10"
                            onClick={() => onDownloadSingle(currentFile.id)}
                            title="Download image"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {onToggleHidden && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-lg !border-white/10 !bg-black/35 !text-white hover:!bg-white/10"
                            onClick={() => onToggleHidden(currentFile.id, !currentFile.is_hidden)}
                            title={currentFile.is_hidden ? 'Unhide image' : 'Hide image'}
                          >
                            {currentFile.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                        )}
                        {canRequestModification && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-lg !border-rose-400/20 !bg-rose-500/15 !text-rose-50 hover:!bg-rose-500/25"
                            onClick={() => {
                              blurActiveElement();
                              setShowRequestComposer((current) => !current);
                            }}
                            title="Request modification"
                          >
                            <AlertCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                    {canInteractSingleMedia && onAddComment ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <Textarea
                          value={commentDraft}
                          onChange={(event) => setCommentDraft(event.target.value)}
                          placeholder="Add a comment for this image..."
                          className="min-h-[58px] resize-none border-white/10 bg-black/30 text-xs text-white placeholder:text-white/45"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-white hover:bg-white/10 hover:text-white"
                            onClick={() => setCommentDraft('')}
                            disabled={!commentDraft.trim()}
                          >
                            Clear
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => {
                              if (!commentDraft.trim()) return;
                              onAddComment(currentFile.id, commentDraft);
                              setCommentDraft('');
                            }}
                            disabled={!commentDraft.trim()}
                          >
                            Save comment
                          </Button>
                        </div>
                      </div>
                    ) : fileComments.length === 0 ? (
                      <p className="mt-2 text-xs text-white/55">No comments on this image yet.</p>
                    ) : null}
                    {fileComments.length > 0 && (
                      <div className="mt-2 max-h-28 space-y-2 overflow-auto pr-1">
                        {fileComments.slice().reverse().map((comment, index) => (
                          <div key={`${comment.timestamp ?? comment.comment}-${index}`} className="rounded-lg border border-white/10 bg-white/5 p-2">
                            <div className="flex items-center justify-between gap-2 text-[10px] text-white/55">
                              <span>{comment.author || 'Team note'}</span>
                              <span>{formatViewerDateTime(comment.timestamp)}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap break-words text-xs text-white/90">{comment.comment}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              <div className="hidden min-h-0 min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md xl:flex xl:min-h-0 xl:flex-col">
                <ScrollArea className="h-full min-h-0 flex-1">
                  <div className="space-y-3 p-2.5 text-white sm:p-3 lg:space-y-2.5 lg:p-2.5 xl:p-3 2xl:space-y-3 2xl:p-3.5">
                    <div className="hidden min-w-0 gap-2 sm:grid-cols-2 xl:grid">
                      {canSetHero && (
                        <Button
                          variant="outline"
                          className={sidebarActionButtonClassName}
                          onClick={handleSetHeroImage}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Make hero
                        </Button>
                      )}
                      {canInteractSingleMedia && onToggleFavorite && (
                        <Button
                          variant="outline"
                          className={sidebarActionButtonClassName}
                          onClick={() => onToggleFavorite(currentFile.id)}
                        >
                          <Heart className={`mr-2 h-4 w-4 ${currentFile.is_favorite ? 'fill-current' : ''}`} />
                          {currentFile.is_favorite ? 'Liked' : 'Like'}
                        </Button>
                      )}
                      {canDownloadSingleMedia && onDownloadSingle && (
                        <Button
                          variant="outline"
                          className={sidebarActionButtonClassName}
                          onClick={() => onDownloadSingle(currentFile.id)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      )}
                      {onToggleHidden && (
                        <Button
                          variant="outline"
                          className={sidebarActionButtonClassName}
                          onClick={() => onToggleHidden(currentFile.id, !currentFile.is_hidden)}
                        >
                          {currentFile.is_hidden ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                          {currentFile.is_hidden ? 'Unhide image' : 'Hide image'}
                        </Button>
                      )}
                      {(slideshowAvailable || canRequestModification) && (
                        <div className="sm:col-span-2 grid min-w-0 gap-2 sm:grid-cols-2">
                          {slideshowAvailable && (
                            <Button
                              variant="outline"
                              className={`${sidebarActionButtonClassName} w-full ${canRequestModification ? '' : 'sm:col-span-2'}`}
                              onClick={handleEnterSlideshow}
                            >
                              <Play className="mr-2 h-4 w-4 fill-current" />
                              Slideshow
                            </Button>
                          )}
                          {canRequestModification && (
                            <Button
                              variant="destructive"
                              className={`h-auto min-h-10 min-w-0 justify-start whitespace-normal break-words px-3 py-2 text-left text-[13px] leading-snug xl:min-h-11 xl:text-sm ${slideshowAvailable ? '' : 'sm:col-span-2'}`}
                              onClick={() => {
                                blurActiveElement();
                                setShowRequestComposer((current) => !current);
                              }}
                            >
                              <AlertCircle className="mr-2 h-4 w-4" />
                              Request modification
                            </Button>
                          )}
                        </div>
                      )}
                      {/* Inline modification request composer */}
                      {canRequestModification && showRequestComposer && (
                        <div className="sm:col-span-2">
                          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3">
                            <p className="text-sm font-medium text-white">Create request</p>
                            <p className="mt-1 text-xs text-white/65">
                              Request any changes for this image.
                            </p>
                            <Textarea
                              value={flagReason}
                              onChange={(event) => setFlagReason(event.target.value)}
                              placeholder="Request any changes in this image..."
                              className="mt-3 min-h-[80px] resize-none border-white/10 bg-black/30 text-white placeholder:text-white/45 xl:min-h-[72px]"
                            />
                            <div className="mt-3 flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                className="text-white hover:bg-white/10 hover:text-white"
                                onClick={() => {
                                  setShowRequestComposer(false);
                                  setFlagReason('');
                                }}
                                disabled={flagging}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                onClick={handleFlagImage}
                                disabled={!flagReason.trim() || flagging}
                                variant="destructive"
                              >
                                {flagging ? 'Creating request...' : 'Create request'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {canRequestModification && (
                      <div className="space-y-2 xl:hidden">
                        <Button
                          variant="destructive"
                          className="h-10 w-full justify-start"
                          onClick={() => {
                            blurActiveElement();
                            setShowRequestComposer((current) => !current);
                          }}
                        >
                          <AlertCircle className="mr-2 h-4 w-4" />
                          Request modification
                        </Button>
                        {showRequestComposer && (
                          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3">
                            <p className="text-sm font-medium text-white">Create request</p>
                            <p className="mt-1 text-xs text-white/65">
                              Request any changes for this image.
                            </p>
                            <Textarea
                              value={flagReason}
                              onChange={(event) => setFlagReason(event.target.value)}
                              placeholder="Request any changes in this image..."
                              className="mt-3 min-h-[80px] resize-none border-white/10 bg-black/30 text-white placeholder:text-white/45"
                            />
                            <div className="mt-3 flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                className="text-white hover:bg-white/10 hover:text-white"
                                onClick={() => {
                                  setShowRequestComposer(false);
                                  setFlagReason('');
                                }}
                                disabled={flagging}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                onClick={handleFlagImage}
                                disabled={!flagReason.trim() || flagging}
                                variant="destructive"
                              >
                                {flagging ? 'Creating request...' : 'Create request'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 text-left"
                        onClick={() => setShowFileDetails((current) => !current)}
                      >
                        <p className="text-sm font-medium">File details</p>
                        {showFileDetails ? (
                          <ChevronUp className="h-4 w-4 text-white/60" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-white/60" />
                        )}
                      </button>
                      {showFileDetails && (
                        <div className="mt-3 space-y-3">
                          {detailRows.map((row) => (
                            <div key={row.label} className="flex items-start justify-between gap-3 text-sm">
                              <span className="text-white/55">{row.label}</span>
                              <span className="text-right text-white/90">{row.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">Comments</p>
                        <Badge className="border-white/10 bg-white/10 text-white/80 hover:bg-white/10">
                          {Number(currentFile.comment_count ?? fileComments.length)}
                        </Badge>
                      </div>
                      {canInteractSingleMedia && onAddComment && (
                        <div className="mt-3 flex flex-col gap-2">
                          {fileComments.length === 0 && (
                            <p className="text-sm text-white/55">No comments yet. Use the composer below to add one.</p>
                          )}
                          <Textarea
                            value={commentDraft}
                            onChange={(event) => setCommentDraft(event.target.value)}
                            placeholder="Add a comment for this image..."
                            className="min-h-[76px] resize-none border-white/10 bg-black/30 text-white placeholder:text-white/45 lg:min-h-[56px] xl:min-h-[68px]"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-white hover:bg-white/10 hover:text-white"
                              onClick={() => setCommentDraft('')}
                              disabled={!commentDraft.trim()}
                            >
                              Clear
                            </Button>
                            <Button
                              size="sm"
                              className="bg-blue-600 text-white hover:bg-blue-700"
                              onClick={() => {
                                if (!commentDraft.trim()) return;
                                onAddComment(currentFile.id, commentDraft);
                                setCommentDraft('');
                              }}
                              disabled={!commentDraft.trim()}
                            >
                              Save comment
                            </Button>
                          </div>
                        </div>
                      )}
                      {fileComments.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {fileComments.slice().reverse().map((comment, index) => (
                            <div key={`${comment.timestamp ?? comment.comment}-${index}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                              <div className="flex items-center justify-between gap-2 text-xs text-white/55">
                                <span>{comment.author || 'Team note'}</span>
                                <span>{formatViewerDateTime(comment.timestamp)}</span>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-white/90">{comment.comment}</p>
                            </div>
                          ))}
                        </div>
                      ) : !canInteractSingleMedia || !onAddComment ? (
                        <p className="mt-3 text-sm text-white/55">
                          No comments on this image yet.
                        </p>
                      ) : null}
                    </div>

                    {(relatedRequests.length > 0 || requestsLoading) && (
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">Revision history</p>
                          {requestsLoading ? (
                            <span className="text-xs text-white/55">Loading...</span>
                          ) : (
                            <Badge className="border-white/10 bg-white/10 text-white/80 hover:bg-white/10">
                              {relatedRequests.length} request{relatedRequests.length === 1 ? '' : 's'}
                            </Badge>
                          )}
                        </div>
                        {requestsLoading ? (
                          <p className="mt-3 text-sm text-white/55">Loading request history...</p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {relatedRequests.map((request) => (
                              <div key={request.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <Badge className={`${getRequestStatusClassName(request.status)} border capitalize`}>
                                    {String(request.status || 'open').replace(/-/g, ' ')}
                                  </Badge>
                                  <span className="text-xs text-white/50">{formatViewerDateTime(request.updatedAt || request.createdAt)}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/55">
                                  <span>{request.raisedBy?.name || 'Client request'}</span>
                                  {request.assignedToRole && <span>Assigned to {request.assignedToRole}</span>}
                                </div>
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-white/90">{request.note}</p>
                              </div>
                            ))}
                            {shoot?.issuesResolvedAt && (
                              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
                                <p className="text-sm font-medium text-emerald-100">Issues resolved</p>
                                <p className="mt-1 text-xs text-emerald-50/80">{formatViewerDateTime(shoot.issuesResolvedAt)}</p>
                              </div>
                            )}
                            {shoot?.submittedForReviewAt && (
                              <div className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-3">
                                <p className="text-sm font-medium text-blue-100">Submitted for review</p>
                                <p className="mt-1 text-xs text-blue-50/80">{formatViewerDateTime(shoot.submittedForReviewAt)}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}



