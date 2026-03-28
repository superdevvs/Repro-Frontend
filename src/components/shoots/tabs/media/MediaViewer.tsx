import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { type ShootData } from '@/types/shoots';
import { type MediaFile } from '@/hooks/useShootFiles';
import { isRawFile } from '@/services/rawPreviewService';
import { blurActiveElement } from '../../dialogFocusUtils';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, FileIcon, Play, X } from 'lucide-react';
import { isPreviewableImage, isVideoFile } from './mediaPreviewUtils';
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
  onShootUpdate?: () => void;
}

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
  const currentFile = files[currentIndex];

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

      // Also flag the file if endpoint exists
      try {
        await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/files/${currentFile.id}/flag`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            reason: flagReason.trim(),
            file_id: currentFile.id,
          }),
        });
      } catch (flagError) {
        console.warn('File flagging endpoint not available, issue created only');
      }

      toast({
        title: 'Success',
        description: 'Issue created and image flagged successfully',
      });
      setShowFlagDialog(false);
      setFlagReason('');
      onShootUpdate?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to flag image and create issue',
        variant: 'destructive',
      });
    } finally {
      setFlagging(false);
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
        
        <div className="relative z-10 flex h-full w-full items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20 text-white hover:bg-white/20 rounded-full h-9 w-9 sm:h-10 sm:w-10"
            onClick={onClose}
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>

          {currentIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-1 sm:left-4 z-10 text-white hover:bg-white/20 h-10 w-10 sm:h-12 sm:w-12"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
            </Button>
          )}

          {/* Top Metadata Bar */}
          {(isImg || isVid) && currentFile && (
            <div className="absolute top-12 sm:top-4 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-md rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-2 sm:gap-4 text-white text-xs sm:text-sm max-w-[90vw]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{currentFile.filename}</span>
              </div>
              {currentFile.width && currentFile.height && (
                <div className="text-white/70 hidden sm:block">
                  {currentFile.width} × {currentFile.height}
                </div>
              )}
              {!isClient && currentFile.fileSize && (
                <div className="text-white/70 hidden sm:block">
                  {(currentFile.fileSize / 1024 / 1024).toFixed(2)} MB
                </div>
              )}
              {canSetHero && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-white hover:bg-white/20"
                  onClick={async () => {
                    try {
                      const headers = getApiHeaders();
                      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/media/${currentFile.id}/cover`, {
                        method: 'POST',
                        headers,
                      });
                      if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                        console.error('Cover API error:', response.status, errorData);
                        throw new Error(errorData.message || `HTTP ${response.status}`);
                      }
                      toast({ title: 'Hero Image', description: 'Hero image updated successfully' });
                      onShootUpdate();
                    } catch (error) {
                      console.error('Set cover error:', error);
                      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to set hero image', variant: 'destructive' });
                    }
                  }}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Make Hero
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-center p-2 sm:p-8 overflow-auto" style={{ transform: isVid ? undefined : `scale(${zoom})`, transformOrigin: 'center' }}>
            {isImg ? (
              <img
                src={imageUrl}
                srcSet={srcSet}
                sizes="95vw"
                alt={currentFile.filename}
                className="max-w-full max-h-[60vh] sm:max-h-[70vh] object-contain select-none rounded-lg shadow-2xl"
                loading="eager"
                draggable={false}
              />
            ) : isVid ? (
              <video
                key={currentFile.id}
                src={videoUrl}
                controls
                autoPlay
                className="max-w-full max-h-[60vh] sm:max-h-[70vh] object-contain select-none rounded-lg shadow-2xl"
                style={{ outline: 'none' }}
              />
            ) : (
              <div className="text-white text-center">
                <FileIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4" />
                <p className="text-sm sm:text-base">{currentFile.filename}</p>
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          {isImg && (
            <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-20 flex items-center gap-1 sm:gap-2 bg-black/60 backdrop-blur-md rounded-lg p-1 sm:p-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8 text-white hover:bg-white/20"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                title="Zoom out"
              >
                <span className="text-sm">−</span>
              </Button>
              <span className="text-white text-[10px] sm:text-xs min-w-[2.5rem] sm:min-w-[3rem] text-center font-medium">{Math.round(zoom * 100)}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8 text-white hover:bg-white/20"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                title="Zoom in"
              >
                <span className="text-sm">+</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 sm:h-8 text-[10px] sm:text-xs text-white hover:bg-white/20 hidden sm:inline-flex"
                onClick={handleResetZoom}
                title="Reset zoom (0)"
              >
                Reset
              </Button>
            </div>
          )}

          {/* Flag Image Button (Admin only) */}
          {isAdmin && isImg && shoot && (
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-2 sm:top-4 right-14 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto z-10 h-7 sm:h-8 text-xs"
              onClick={() => {
                blurActiveElement();
                setShowFlagDialog(true);
              }}
            >
              <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">Flag Issue</span>
              <span className="sm:hidden">Flag</span>
            </Button>
          )}

          {currentIndex < files.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 sm:right-4 z-10 text-white hover:bg-white/20 h-10 w-10 sm:h-12 sm:w-12"
              onClick={handleNext}
            >
              <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
            </Button>
          )}

          {/* Bottom Filmstrip */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md text-white p-2 sm:p-4 z-20">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="min-w-0">
                <div className="font-medium text-xs sm:text-sm truncate">{currentFile.filename}</div>
                <div className="text-[10px] sm:text-xs text-gray-300">
                  {currentIndex + 1} of {files.length}
                </div>
              </div>
              <div className="text-xs text-gray-400 hidden sm:block">
                Use ← → arrow keys to navigate • + - to zoom • ESC to close
              </div>
            </div>
            
            {/* Filmstrip Thumbnails */}
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {files.map((file, index) => {
                const isActive = index === currentIndex;
                const fileImageUrl = getImageUrl(file, 'thumb');
                const fileIsImg = isImageFile(file);
                const fileIsVid = isVideoFile(file);
                const fileIsRaw = isRawFile(file.filename);
                // For RAW files, only show thumbnail if processed (thumbnail_path exists)
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
                    className={`relative flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded overflow-hidden border-2 transition-all ${
                      isActive 
                        ? 'border-white ring-2 ring-white/50 scale-105' 
                        : 'border-white/30 hover:border-white/60 opacity-70 hover:opacity-100'
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

        {/* Flag Image Dialog */}
        {isAdmin && shoot && (
          <Dialog open={showFlagDialog} onOpenChange={setShowFlagDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Flag Image Issue</DialogTitle>
                <DialogDescription>
                  Flag this image for correction or re-editing. This will create an issue visible to the editor.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Issue Description</Label>
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
                    {flagging ? 'Flagging...' : 'Flag Image'}
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



