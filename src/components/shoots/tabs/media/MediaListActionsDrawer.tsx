import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';
import { Download, Eye, EyeOff, Heart, Image as ImageIcon, ImagePlus, MessageSquare, MoreHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerClose, DrawerDescription, DrawerFooter, DrawerHeader, DrawerOverlay, DrawerPortal, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Textarea } from '@/components/ui/textarea';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import type { MediaFile } from '@/hooks/useShootFiles';
import { getDisplayMediaFilename } from './mediaPreviewUtils';

interface MediaListActionsDrawerProps {
  file: MediaFile;
  previewUrl?: string;
  downloading: boolean;
  onToggleFavorite?: () => void;
  onAddComment?: (comment: string) => void;
  onDownload?: () => void | Promise<void>;
  onSetHero?: () => void;
  onToggleHidden?: () => void;
}

function ActionRow({ icon, children, ...props }: ComponentProps<typeof Button> & { icon: ReactNode }) {
  return <Button variant="ghost" className="h-14 w-full justify-start gap-3 rounded-xl px-3 text-sm font-medium" {...props}>
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted" aria-hidden="true">{icon}</span>
    {children}
  </Button>;
}

export function MediaListActionsDrawer({ file, previewUrl, downloading, onToggleFavorite, onAddComment, onDownload, onSetHero, onToggleHidden }: MediaListActionsDrawerProps) {
  const [open, setOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [downloadPending, setDownloadPending] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const downloadLock = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const filename = getDisplayMediaFilename(file) || file.filename;
  const imageUrl = previewUrl;
  const isDownloading = downloading || downloadPending;
  const latestComment = file.latest_comment?.comment?.trim() || file.comments?.[file.comments.length - 1]?.comment?.trim();

  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setCommentOpen(false);
      setCommentDraft('');
      setDownloadError(false);
    }
  };
  const download = async () => {
    if (!onDownload || isDownloading || downloadLock.current) return;
    downloadLock.current = true;
    setDownloadPending(true);
    setDownloadError(false);
    try {
      await onDownload();
    } catch {
      setDownloadError(true);
    } finally {
      downloadLock.current = false;
      setDownloadPending(false);
    }
  };

  return <div className="shrink-0" onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation(); }}>
    <Drawer open={open} onOpenChange={changeOpen} shouldScaleBackground={false} autoFocus>
      <DrawerTrigger asChild>
        <Button ref={triggerRef} type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Media actions for ${filename}`}>
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DrawerTrigger>
      <DrawerPortal>
        <DrawerOverlay className="z-[120] bg-black/55 backdrop-blur-[2px]" />
        <DrawerPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-[121] mx-auto flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border bg-background shadow-2xl outline-none"
          onCloseAutoFocus={event => { event.preventDefault(); triggerRef.current?.focus(); }}
        >
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/25" aria-hidden="true" />
          <DrawerHeader className="relative flex shrink-0 items-center gap-3 border-b p-5 pr-14 text-left">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
              {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
            </div>
            <div className="min-w-0 space-y-1.5">
              <DrawerTitle className="text-base">File actions</DrawerTitle>
              <DrawerDescription className="break-words text-xs leading-relaxed">{filename}</DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3 h-9 w-9 rounded-full" aria-label="Close file actions"><X className="h-4 w-4" /></Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-3" data-vaul-no-drag>
            {onToggleFavorite && <ActionRow icon={<Heart className={`h-5 w-5 ${file.is_favorite ? 'fill-current text-red-500' : ''}`} />} onClick={onToggleFavorite}>
              {file.is_favorite ? 'Unlike image' : 'Like image'}
            </ActionRow>}
            {onAddComment && <>
              {!commentOpen ? <ActionRow icon={<MessageSquare className="h-5 w-5" />} onClick={() => setCommentOpen(true)}>Add comment</ActionRow> : (
                <form className="m-1 space-y-3 rounded-xl border bg-muted/25 p-3" onSubmit={event => {
                  event.preventDefault();
                  const comment = commentDraft.trim();
                  if (!comment) return;
                  onAddComment(comment);
                  setCommentDraft('');
                  setCommentOpen(false);
                }}>
                  <label className="block space-y-2 text-sm font-medium">
                    <span>Add a comment</span>
                    <Textarea autoFocus value={commentDraft} onChange={event => setCommentDraft(event.target.value)} placeholder="Write a note about this image…" className="min-h-24 resize-y bg-background text-sm" />
                  </label>
                  {latestComment && <p className="line-clamp-3 break-words text-xs text-muted-foreground">Latest: {latestComment}</p>}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setCommentOpen(false); setCommentDraft(''); }}>Cancel comment</Button>
                    <Button type="submit" size="sm" disabled={!commentDraft.trim()}>Post comment</Button>
                  </div>
                </form>
              )}
            </>}
            {onDownload && <ActionRow icon={isDownloading ? <InlineSpinner className="h-5 w-5" /> : <Download className="h-5 w-5" />} aria-label="Download image" aria-busy={isDownloading} disabled={isDownloading} onClick={() => { void download(); }}>
              {isDownloading ? 'Downloading…' : 'Download image'}
            </ActionRow>}
            {downloadError && <p role="alert" className="px-3 pb-2 text-xs text-destructive">Download failed. Try again.</p>}
            {onSetHero && <ActionRow icon={<ImagePlus className="h-5 w-5" />} aria-label="Set hero image" disabled={file.is_cover} onClick={onSetHero}>
              {file.is_cover ? 'Current hero image' : 'Set hero image'}
            </ActionRow>}
            {onToggleHidden && <ActionRow icon={file.is_hidden ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />} onClick={onToggleHidden}>
              {file.is_hidden ? 'Unhide image' : 'Hide image'}
            </ActionRow>}
          </div>
          <DrawerFooter className="sticky bottom-0 shrink-0 border-t bg-background px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerClose asChild><Button type="button" variant="secondary" className="h-11 rounded-xl">Done</Button></DrawerClose>
          </DrawerFooter>
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  </div>;
}
