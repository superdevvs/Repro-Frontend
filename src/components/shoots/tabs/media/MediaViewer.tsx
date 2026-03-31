import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { type ShootData } from '@/types/shoots';
import { type MediaFile } from '@/hooks/useShootFiles';
import { isRawFile } from '@/services/rawPreviewService';
import { blurActiveElement } from '../../dialogFocusUtils';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Eye, EyeOff, FileIcon, Heart, Play, X } from 'lucide-react';
// Media Viewer Component
interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  files: MediaFile[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  getImageUrl: (file: MediaFile, size?: 'thumb' | 'medium' | 'large' | 'original') => string;
  getSrcSet: (file: MediaFile) => string;
  shoot?: ShootData;
  isAdmin?: boolean;
  isClient?: boolean;
  canInteractSingleMedia?: boolean;
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

export function MediaViewer({ 
  isOpen, 
  onClose, 
  files, 
  currentIndex, 
  onIndexChange,
  getImageUrl,
  getSrcSet,
  shoot,
  isAdmin = false,
  isClient = false,
  canInteractSingleMedia = false,
  onToggleFavorite,
  onAddComment,
  onToggleHidden,
  onDownloadSingle,
  onShootUpdate,
}: MediaViewerProps) {
  const { toast } = useToast();
  
  const isImageFile = (file: MediaFile): boolean => {
    // If RAW file has processed thumbnail, it's displayable
    if ((file.media_type === 'raw' || file.media_type === 'image') && (file.thumbnail_path || file.thumb || file.medium)) {
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
    if ((file.media_type === 'raw' || file.media_type === 'image') && (file.thumbnail_path || file.thumb || file.medium)) {
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
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagging, setFlagging] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [showFileDetails, setShowFileDetails] = useState(false);
  const [viewerRequests, setViewerRequests] = useState<MediaIssueRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestRefreshKey, setRequestRefreshKey] = useState(0);
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
    setShowFileDetails(false);
  }, [currentFile?.id]);

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
      setShowFlagDialog(false);
      setFlagReason('');
      setRequestRefreshKey((current) => current + 1);
      onShootUpdate?.();
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
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
      setZoom(1); // Reset zoom when navigating
    }
  };

  const handleNext = () => {
    if (currentIndex < files.length - 1) {
      onIndexChange(currentIndex + 1);
      setZoom(1); // Reset zoom when navigating
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
        setZoom(prev => Math.min(prev + 0.25, 3));
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
  }, [isOpen, currentIndex, files.length, onClose, onIndexChange]);

  if (!isOpen || !currentFile) return null;

  // Use medium size for viewer (1500px) - only load original when user explicitly requests
  const imageUrl = getImageUrl(currentFile, 'medium') || getImageUrl(currentFile, 'large');
  const srcSet = getSrcSet(currentFile);
  const isImg = isPreviewableImage(currentFile);
  const isVid = isVideoFile(currentFile);
  const videoUrl = isVid ? (getImageUrl(currentFile, 'original') || getImageUrl(currentFile, 'large')) : '';
  const fileExt = currentFile?.filename?.split('.')?.pop()?.toUpperCase();
  const mediaType = (currentFile.media_type || '').toLowerCase();
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="!fixed !inset-0 !translate-x-0 !translate-y-0 max-w-none max-h-none w-screen h-screen p-0 bg-black/95 backdrop-blur-md border-0 rounded-none [&>button:last-child]:hidden"
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
        
        <div className="relative z-10 flex h-full w-full items-stretch justify-stretch">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-20 h-9 w-9 rounded-full text-white hover:bg-white/20 sm:right-4 sm:top-3 sm:h-10 sm:w-10"
            onClick={onClose}
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>

          <div className="flex h-full w-full min-h-0 flex-col px-2 pb-2 pt-2 sm:px-4 sm:pb-4 sm:pt-3 lg:px-6 lg:pb-6 lg:pt-4">
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,68fr)_minmax(340px,32fr)] lg:gap-4">
              <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
                {/* Top Metadata Bar */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-3 py-3 sm:px-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white sm:text-base">{currentFile.filename}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                      <span>{currentIndex + 1} of {files.length}</span>
                      {currentFile.width && currentFile.height && <span>{currentFile.width} × {currentFile.height}</span>}
                      {!isClient && currentFile.fileSize && <span>{formatViewerFileSize(currentFile.fileSize)}</span>}
                    </div>
                  </div>
                  {/* Zoom Controls */}
                  {isImg ? (
                    <div className="flex items-center gap-1 rounded-lg bg-black/30 p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white hover:bg-white/15"
                        onClick={handleZoomOut}
                        disabled={zoom <= 0.5}
                        title="Zoom out"
                      >
                        <span className="text-sm">−</span>
                      </Button>
                      <span className="min-w-[3rem] text-center text-xs font-medium text-white">{Math.round(zoom * 100)}%</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white hover:bg-white/15"
                        onClick={handleZoomIn}
                        disabled={zoom >= 3}
                        title="Zoom in"
                      >
                        <span className="text-sm">+</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hidden h-8 text-xs text-white hover:bg-white/15 sm:inline-flex"
                        onClick={handleResetZoom}
                        title="Reset zoom (0)"
                      >
                        Reset
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-white/55">Use ← → to navigate • ESC to close</p>
                  )}
                </div>

                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex min-h-0 flex-1 items-stretch justify-center px-2 pb-2 pt-2 sm:px-3 sm:pb-3 sm:pt-2">
                    <div className="relative flex h-full min-h-[420px] w-full items-center justify-center overflow-auto rounded-xl bg-black/55 p-2 sm:min-h-[520px] sm:p-3">
                      {currentIndex > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 text-white hover:bg-white/15"
                          onClick={handlePrevious}
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </Button>
                      )}

                      {currentIndex < files.length - 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 text-white hover:bg-white/15"
                          onClick={handleNext}
                        >
                          <ChevronRight className="h-6 w-6" />
                        </Button>
                      )}
                      {isImg ? (
                        <img
                          src={imageUrl}
                          srcSet={srcSet}
                          sizes="(min-width: 1024px) 60vw, 100vw"
                          alt={currentFile.filename}
                          className="max-h-full max-w-full select-none rounded-xl object-contain shadow-2xl transition-transform duration-200"
                          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                          loading="eager"
                          draggable={false}
                        />
                      ) : isVid ? (
                        <video
                          key={currentFile.id}
                          src={videoUrl}
                          controls
                          autoPlay
                          className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
                          style={{ outline: 'none' }}
                        />
                      ) : (
                        <div className="text-white text-center">
                          <FileIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4" />
                          <p className="text-sm sm:text-base">{currentFile.filename}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Filmstrip */}
                  <div className="border-t border-white/10 px-3 py-3 sm:px-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-white">All media</p>
                        <p className="text-[11px] text-white/55">
                          {isImg ? 'Use ← → to navigate • + - to zoom • ESC to close' : 'Use ← → to navigate • ESC to close'}
                        </p>
                      </div>
                      <p className="text-[11px] text-white/50">{currentIndex + 1} of {files.length}</p>
                    </div>

                    {/* Filmstrip Thumbnails */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                      {files.map((file, index) => {
                        const isActive = index === currentIndex;
                        const fileImageUrl = getImageUrl(file, 'thumb');
                        const fileIsImg = isImageFile(file);
                        const fileIsVid = isVideoFile(file);
                        const fileIsRaw = isRawFile(file.filename);
                        const hasDisplayableThumb = fileIsRaw
                          ? !!(file.thumbnail_path || file.web_path)
                          : fileIsImg;

                        return (
                          <button
                            key={file.id}
                            onClick={() => {
                              onIndexChange(index);
                              setZoom(1);
                            }}
                            className={`relative flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all ${
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
                              <div className="absolute inset-0 flex items-center justify-center">
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
                </div>
              </div>

              <div className="min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
                <ScrollArea className="h-full">
                  <div className="space-y-4 p-3 text-white sm:p-4">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Current file</p>
                          <p className="mt-1 text-lg font-semibold leading-tight">{currentFile.filename}</p>
                          <p className="mt-1 text-xs text-white/55">
                            {fileExt ? `${fileExt} file` : 'Preview item'}{currentFile.isExtra ? ' • Extra delivery' : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {currentFile.is_cover && <Badge className="border-blue-500/30 bg-blue-500/15 text-blue-100 hover:bg-blue-500/15">Hero</Badge>}
                          {currentFile.is_favorite && <Badge className="border-rose-500/30 bg-rose-500/15 text-rose-100 hover:bg-rose-500/15">Liked</Badge>}
                          {currentFile.is_hidden && <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-100 hover:bg-amber-500/15">Hidden</Badge>}
                          {currentFile.isExtra && <Badge className="border-orange-500/30 bg-orange-500/15 text-orange-100 hover:bg-orange-500/15">Extra</Badge>}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {canSetHero && (
                        <Button
                          variant="outline"
                          className="justify-start border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                          onClick={handleSetHeroImage}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Make hero
                        </Button>
                      )}
                      {canInteractSingleMedia && onToggleFavorite && (
                        <Button
                          variant="outline"
                          className="justify-start border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                          onClick={() => onToggleFavorite(currentFile.id)}
                        >
                          <Heart className={`mr-2 h-4 w-4 ${currentFile.is_favorite ? 'fill-current' : ''}`} />
                          {currentFile.is_favorite ? 'Liked' : 'Like'}
                        </Button>
                      )}
                      {canInteractSingleMedia && onDownloadSingle && (
                        <Button
                          variant="outline"
                          className="justify-start border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                          onClick={() => onDownloadSingle(currentFile.id)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      )}
                      {onToggleHidden && (
                        <Button
                          variant="outline"
                          className="justify-start border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                          onClick={() => onToggleHidden(currentFile.id, !currentFile.is_hidden)}
                        >
                          {currentFile.is_hidden ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                          {currentFile.is_hidden ? 'Unhide image' : 'Hide image'}
                        </Button>
                      )}
                      {/* Flag Image Button (Admin only) */}
                      {isAdmin && isImg && shoot && (
                        <Button
                          variant="destructive"
                          className="justify-start"
                          onClick={() => {
                            blurActiveElement();
                            setShowFlagDialog(true);
                          }}
                        >
                          <AlertCircle className="mr-2 h-4 w-4" />
                          Request modification
                        </Button>
                      )}
                    </div>

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
                          <Textarea
                            value={commentDraft}
                            onChange={(event) => setCommentDraft(event.target.value)}
                            placeholder="Add a comment for this image..."
                            className="min-h-[88px] resize-none border-white/10 bg-black/30 text-white placeholder:text-white/45"
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
                      ) : (
                        <p className="mt-3 text-sm text-white/55">
                          {canInteractSingleMedia && onAddComment ? 'No comments yet. Use the composer above to add one.' : 'No comments on this image yet.'}
                        </p>
                      )}
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

        {/* Flag Image Dialog */}
        {isAdmin && shoot && (
          <Dialog open={showFlagDialog} onOpenChange={setShowFlagDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Image Modification</DialogTitle>
                <DialogDescription>
                  Create a request for this image. It will appear in the Requests tab for this shoot and be available for the editor to handle.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Request Description</Label>
                  <Textarea
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    placeholder="Describe what needs to be corrected..."
                    className="min-h-[100px]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setShowFlagDialog(false);
                    setFlagReason('');
                  }}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleFlagImage} 
                    disabled={!flagReason.trim() || flagging}
                    variant="destructive"
                  >
                    {flagging ? 'Creating request...' : 'Create request'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}



