import { AlertCircle, CheckCircle2, ChevronDown, Download, Eye, EyeOff, Pencil, Play, Tag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { openMediaMark } from './mark/mediaMarkEvents';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { MediaEditingMenuItems } from '../../MediaEditingMenu';
import { canShowMediaEditingActions } from './mediaEditingPermissions';
import { useAuth } from '@/components/auth/AuthProvider';
import { useState } from 'react';
import type { useMediaViewerController } from './useMediaViewerController';

export type MediaViewerModel = NonNullable<ReturnType<typeof useMediaViewerController>>;
const itemClass = 'media-viewer-menu-item';

export function MediaViewerActions({ model }: { model: MediaViewerModel }) {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const closeOnEscape = (event: KeyboardEvent) => { event.preventDefault(); event.stopPropagation(); setOpen(false); };
  const { currentFile, canSetHero, canMarkAs, canDownloadSingleMedia, onDownloadSingle,
    downloadingFileIds, onToggleHidden, canShowRenameFilename, renameApiEnabled, renamingFilename,
    canDeleteCurrentFile, deletingFile, slideshowAvailable, canRequestModification } = model;
  const downloading = downloadingFileIds.has(String(currentFile.id));
  const canOpenMark = canMarkAs || ['admin', 'superadmin', 'super_admin', 'editing_manager'].includes(String(role)) && currentFile.can_interact !== false;
  if (!(canSetHero || canOpenMark || (canDownloadSingleMedia && onDownloadSingle) || onToggleHidden || canShowRenameFilename || canDeleteCurrentFile || slideshowAvailable || canRequestModification || canShowMediaEditingActions(currentFile, model.shoot?.id, role))) return null;
  return <DropdownMenu open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="media-viewer-actions" aria-label="Image actions">Actions <ChevronDown className="h-3.5 w-3.5" /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={10} className="media-viewer-menu" onEscapeKeyDown={closeOnEscape} onCloseAutoFocus={event => {
      // Composers take focus when selected from the menu.
      if (model.showRenameComposer || model.showRequestComposer) event.preventDefault();
    }}>
      <DropdownMenuLabel className="media-viewer-menu-label">Image actions</DropdownMenuLabel>
      {canSetHero && <DropdownMenuItem className={itemClass} onSelect={model.handleSetHeroImage}><CheckCircle2 />Make hero</DropdownMenuItem>}
      {canOpenMark && model.shoot && <DropdownMenuItem className={itemClass} onSelect={() => { setOpen(false); model.onClose(); setTimeout(() => openMediaMark({ shootId: model.shoot!.id, shootLabel: model.shoot?.location?.address, files: [currentFile], allowType: canMarkAs, onChanged: model.onShootUpdate }), 0); }}><Tag />Mark media…</DropdownMenuItem>}
      {canDownloadSingleMedia && onDownloadSingle && <DropdownMenuItem className={itemClass} disabled={downloading} aria-busy={downloading} onSelect={() => model.handleDownloadSingle(currentFile.id)}>
        {downloading ? <InlineSpinner aria-hidden="true" /> : <Download />}{downloading ? 'Downloading…' : 'Download'}
      </DropdownMenuItem>}
      {onToggleHidden && <DropdownMenuItem className={itemClass} onSelect={() => onToggleHidden(currentFile.id, !currentFile.is_hidden)}>{currentFile.is_hidden ? <Eye /> : <EyeOff />}{currentFile.is_hidden ? 'Unhide image' : 'Hide image'}</DropdownMenuItem>}
      {canShowRenameFilename && <DropdownMenuItem className={itemClass} disabled={!renameApiEnabled || renamingFilename} onSelect={model.openRenameComposer}><Pencil />Rename filename</DropdownMenuItem>}
      <MediaEditingMenuItems file={currentFile} shootId={model.shoot?.id} beforeOpen={model.onClose} className={itemClass} />
      {(slideshowAvailable || canRequestModification) && <DropdownMenuSeparator className="bg-white/10" />}
      {slideshowAvailable && <DropdownMenuItem className={itemClass} onSelect={model.handleEnterSlideshow}><Play />Slideshow</DropdownMenuItem>}
      {canRequestModification && <DropdownMenuItem className={itemClass} onSelect={() => model.setShowRequestComposer(true)}><AlertCircle />Request modification</DropdownMenuItem>}
      {canDeleteCurrentFile && <><DropdownMenuSeparator className="bg-white/10" /><DropdownMenuItem className={`${itemClass} media-viewer-delete`} disabled={deletingFile} onSelect={event => { event.preventDefault(); void model.handleDeleteCurrentFile(); }}><Trash2 />{deletingFile ? 'Deleting…' : 'Delete file'}</DropdownMenuItem></>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
