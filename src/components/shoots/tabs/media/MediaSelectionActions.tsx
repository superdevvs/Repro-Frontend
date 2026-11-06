import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { AlertCircle, Download, MoreHorizontal, Tag, Trash2 } from 'lucide-react';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { MediaSortOrder } from './mediaSort';
import { MediaSortControl } from './MediaSortControl';

export interface MediaSelectionActionsProps {
  selectedFiles: Set<string>;
  isClient: boolean;
  isEditor: boolean;
  isAdmin: boolean;
  displayTab: 'uploaded' | 'edited';
  rawFiles: MediaFile[];
  editedFiles: MediaFile[];
  sortMenuOpen: boolean;
  setSortMenuOpen: Dispatch<SetStateAction<boolean>>;
  sortOrder: MediaSortOrder;
  isDragMode: boolean;
  sortSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  changeSortOrder: (order: MediaSortOrder) => void;
  toggleDragMode: () => void;
  canMarkSelectedFiles: boolean;
  onOpenMark?: () => void;
  canDelete: boolean;
  hasDeletableFiles?: boolean;
  handleDeleteFiles: () => Promise<void>;
  canDownload: boolean;
  downloading: boolean;
  handleDownload: (size: 'original' | 'small') => Promise<void>;
  handleEditorDownloadRaw: (downloadAll?: boolean) => Promise<void>;
  presentationActions?: ReactNode;
  /** Real menu items for secondary actions; the inline mobile buttons stay separate. */
  presentationMenuActions?: ReactNode;
  hasPresentationMenuActions?: boolean;
  canCreateRequest?: boolean;
  setRequestManagerOpen: Dispatch<SetStateAction<boolean>>;
  desktop?: boolean;
}

export function MediaSelectionActions({ selectedFiles, isClient, isEditor, isAdmin, displayTab, rawFiles, editedFiles,
  sortMenuOpen, setSortMenuOpen, sortOrder, isDragMode, sortSaveStatus, changeSortOrder, toggleDragMode,
  canMarkSelectedFiles, onOpenMark, canDelete, hasDeletableFiles = canDelete, handleDeleteFiles, canDownload, downloading,
  handleDownload, handleEditorDownloadRaw, presentationActions, presentationMenuActions,
  hasPresentationMenuActions = Boolean(presentationMenuActions), canCreateRequest = true, setRequestManagerOpen, desktop = false,
}: MediaSelectionActionsProps) {
  const hasSelection = selectedFiles.size > 0;
  if (!desktop && !hasSelection) return null;
  const canMark = (canMarkSelectedFiles || isAdmin) && Boolean(onOpenMark);
  const canRequest = isClient && canCreateRequest;
  const hasMore = desktop ? canDownload || hasPresentationMenuActions || canRequest : canMarkSelectedFiles || canRequest || canDelete;
  const sortControl = !isEditor && (rawFiles.length > 0 || editedFiles.length > 0) && <MediaSortControl
    open={sortMenuOpen} onOpenChange={setSortMenuOpen} sortOrder={sortOrder} isDragMode={isDragMode}
    sortSaveStatus={sortSaveStatus} changeSortOrder={changeSortOrder} toggleDragMode={toggleDragMode} compact />;
  const markButton = canMark && <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 text-xs" onClick={onOpenMark}
    disabled={!hasSelection} title={hasSelection ? 'Mark selected media' : 'Select media to mark'}>
    <Tag className="h-3.5 w-3.5" />
    <span className={desktop ? undefined : 'hidden min-[380px]:inline'}>Mark</span>
    {!desktop && <span className="min-[380px]:hidden sr-only">Mark selected media</span>}
  </Button>;
  const downloadMenuItems = isEditor && displayTab === 'uploaded' ? (
    <DropdownMenuItem className="min-h-10" disabled={downloading} onSelect={() => void handleEditorDownloadRaw(false)}>
      {downloading ? <InlineSpinner className="mr-2 h-4 w-4" aria-hidden="true" /> : <Download className="mr-2 h-4 w-4" />}
      Download selected RAW files
    </DropdownMenuItem>
  ) : <>
    <DropdownMenuItem className="min-h-10" disabled={downloading} onSelect={() => void handleDownload('small')}>
      <Download className="mr-2 h-4 w-4" />
      <div><div className="text-sm font-medium">MLS Optimized</div><div className="text-xs text-muted-foreground">Best for MLS uploads</div></div>
    </DropdownMenuItem>
    <DropdownMenuItem className="min-h-10" disabled={downloading} onSelect={() => void handleDownload('original')}>
      <Download className="mr-2 h-4 w-4" />
      <div><div className="text-sm font-medium">Print Resolution</div><div className="text-xs text-muted-foreground">Large files for print/design</div></div>
    </DropdownMenuItem>
  </>;

  return <div className={desktop
    ? 'shoot-media-selection-actions-desktop flex shrink-0 flex-nowrap items-center gap-1'
    : 'shoot-media-selection-toolbar mb-1.5 flex shrink-0 flex-nowrap items-center gap-1 border-b py-1.5'}
    role="group" aria-label="Media actions">
    <span className={desktop ? 'sr-only' : 'min-w-0 flex-1 truncate pr-1 text-xs font-medium tabular-nums text-muted-foreground'} title={`${selectedFiles.size} selected`}>
      {selectedFiles.size}<span className="sr-only min-[360px]:not-sr-only"> selected</span>
    </span>
    {desktop ? <>
      {sortControl}
      {markButton}
      {(canDelete || (!hasSelection && hasDeletableFiles)) && <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 text-xs text-destructive hover:text-destructive"
        disabled={!hasSelection || !canDelete}
        aria-label="Delete selected files" title={hasSelection ? `Delete ${selectedFiles.size} selected file${selectedFiles.size === 1 ? '' : 's'}` : 'Select media to delete'}
        onClick={() => void handleDeleteFiles()}><Trash2 className="h-3.5 w-3.5" />Delete</Button>}
    </> : <>
      {presentationActions}
      {sortControl}
      {markButton}
      {canDownload && (isEditor && displayTab === 'uploaded' ? (
        <Button size="icon" className="h-9 w-9 shrink-0 gap-0 sm:h-8 sm:w-8" disabled={downloading}
          aria-busy={downloading} aria-label="Download selected files" title={`Download ${selectedFiles.size} raw file(s)`}
          onClick={() => void handleEditorDownloadRaw(false)}>
          {downloading ? <InlineSpinner aria-hidden="true" /> : <Download />}
        </Button>
      ) : <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="icon" className="h-9 w-9 shrink-0 gap-0 sm:h-8 sm:w-8" disabled={downloading}
          aria-busy={downloading} aria-label="Download selected files" title={`Download ${selectedFiles.size} file(s)`}>
          {downloading ? <InlineSpinner aria-hidden="true" /> : <Download />}
        </Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" collisionPadding={12}>
          <DropdownMenuLabel>Download {selectedFiles.size} selected</DropdownMenuLabel>{downloadMenuItems}
        </DropdownMenuContent>
      </DropdownMenu>)}
    </>}
    {hasMore && <DropdownMenu key={hasSelection ? 'selected' : 'empty'}>
      <DropdownMenuTrigger disabled={!hasSelection} asChild><Button size="icon" variant="outline" className="h-9 w-9 shrink-0 gap-0 sm:h-8 sm:w-8"
        disabled={!hasSelection} aria-label="More selected file actions" title={hasSelection ? 'More actions' : 'Select media for more actions'} aria-busy={desktop && downloading}>
        {desktop && downloading ? <InlineSpinner aria-hidden="true" /> : <MoreHorizontal />}
      </Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={12}>
        <DropdownMenuLabel>{selectedFiles.size} selected</DropdownMenuLabel>
        {desktop && canDownload && downloadMenuItems}
        {desktop && hasPresentationMenuActions && <>{canDownload && <DropdownMenuSeparator />}{presentationMenuActions}</>}
        {!desktop && canMark && <DropdownMenuItem className="min-h-10" onSelect={onOpenMark}>
          <Tag className="mr-2 h-4 w-4" />Mark media…
        </DropdownMenuItem>}
        {canRequest && <DropdownMenuItem className="min-h-10" onSelect={() => setRequestManagerOpen(true)}>
          <AlertCircle className="mr-2 h-4 w-4" />Create request
        </DropdownMenuItem>}
        {!desktop && canDelete && <><DropdownMenuSeparator />
          <DropdownMenuItem className="min-h-10 text-destructive focus:text-destructive" onSelect={() => void handleDeleteFiles()}>
            <Trash2 className="mr-2 h-4 w-4" />Delete {selectedFiles.size} selected file{selectedFiles.size === 1 ? '' : 's'}
          </DropdownMenuItem>
        </>}
      </DropdownMenuContent>
    </DropdownMenu>}
  </div>;
}
