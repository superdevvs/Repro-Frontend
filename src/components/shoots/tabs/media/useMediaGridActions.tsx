import { useState } from 'react';
import { Download, Eye, EyeOff, Heart, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import type { MediaFile } from '@/hooks/useShootFiles';
import { getDisplayMediaFilename } from './mediaPreviewUtils';

interface UseMediaGridActionsOptions {
  canInteractSingleMedia: boolean;
  canDownloadSingleMedia: boolean;
  isClient: boolean;
  toggleFileHidden?: (fileId: string, hidden: boolean) => void;
  onToggleFavorite?: (fileId: string) => void;
  onAddComment?: (fileId: string, comment: string) => void;
  onDownloadSingle?: (fileId: string) => void;
}

export function useMediaGridActions({
  canInteractSingleMedia,
  canDownloadSingleMedia,
  isClient,
  toggleFileHidden,
  onToggleFavorite,
  onAddComment,
  onDownloadSingle,
}: UseMediaGridActionsOptions) {
  const [commentPopoverFileId, setCommentPopoverFileId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');

  const getLatestCommentText = (file: MediaFile) =>
    file.latest_comment?.comment?.trim() ||
    file.comments?.[file.comments.length - 1]?.comment?.trim() ||
    '';

  const closeComment = () => {
    setCommentPopoverFileId(null);
    setCommentDraft('');
  };

  const renderCommentAction = (file: MediaFile, buttonClassName: string) => {
    if (!canInteractSingleMedia || !onAddComment) return null;
    const displayFilename = getDisplayMediaFilename(file) || file.filename;

    return (
      <Popover
        open={commentPopoverFileId === file.id}
        onOpenChange={(open) => {
          if (open) {
            setCommentPopoverFileId(file.id);
            setCommentDraft('');
          } else if (commentPopoverFileId === file.id) {
            closeComment();
          }
        }}
      >
        <PopoverTrigger asChild>
          <button className={buttonClassName} onClick={(event) => event.stopPropagation()} title="Add comment">
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          className="z-[80] w-80 rounded-xl border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur"
          onClick={(event) => event.stopPropagation()}
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
              <Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); closeComment(); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  const comment = commentDraft.trim();
                  if (comment) {
                    onAddComment(file.id, comment);
                    closeComment();
                  }
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
    if (!canInteractSingleMedia && !showHiddenToggle) return null;
    const keepVisible = alwaysVisible || commentPopoverFileId === file.id;

    return (
      <div className={`absolute top-2 right-2 z-[3] flex items-center gap-1 transition-opacity ${keepVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {canInteractSingleMedia && onToggleFavorite && (
          <button
            className={`h-7 w-7 rounded-full backdrop-blur-sm flex items-center justify-center ${file.is_favorite ? 'bg-red-500/90 text-white' : 'bg-black/55 text-white'}`}
            onClick={(event) => { event.stopPropagation(); onToggleFavorite(file.id); }}
            title={file.is_favorite ? 'Unlike image' : 'Like image'}
          >
            <Heart className={`h-3.5 w-3.5 ${file.is_favorite ? 'fill-current' : ''}`} />
          </button>
        )}
        {renderCommentAction(file, 'h-7 w-7 rounded-full bg-black/55 backdrop-blur-sm text-white flex items-center justify-center')}
        {canDownloadSingleMedia && onDownloadSingle && (
          <button
            className="h-7 w-7 rounded-full bg-black/55 backdrop-blur-sm text-white flex items-center justify-center"
            onClick={(event) => { event.stopPropagation(); onDownloadSingle(file.id); }}
            title="Download image"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        )}
        {showHiddenToggle && (
          <button
            className={`h-7 w-7 rounded-full backdrop-blur-sm flex items-center justify-center ${file.is_hidden ? 'bg-yellow-500/90 text-white opacity-100' : 'bg-black/55 text-white'}`}
            onClick={(event) => { event.stopPropagation(); toggleFileHidden?.(file.id, !file.is_hidden); }}
            title={file.is_hidden ? 'Unhide image' : 'Hide image'}
          >
            {file.is_hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    );
  };

  return { getLatestCommentText, renderCommentAction, renderSingleMediaActions };
}
