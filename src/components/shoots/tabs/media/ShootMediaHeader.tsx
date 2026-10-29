import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Download, FileIcon, LayoutGrid, List, MoreHorizontal, Trash2, Upload } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MediaSortControl } from './MediaSortControl';
import { RawDownloadBatches } from './RawDownloadBatches';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { ReclassifyMediaType } from './useShootMediaActions';
import type { MediaSortOrder } from './mediaSort';

interface ShootMediaHeaderProps {
  shootId?: string | number;
  visibleFileCount?: number;
  isClient: boolean;
  rawFiles: MediaFile[];
  editedFiles: MediaFile[];
  activeSubTab: 'uploaded' | 'edited' | 'upload';
  displayTab: 'uploaded' | 'edited';
  defaultTab: 'uploaded' | 'edited' | 'upload';
  setActiveSubTab: Dispatch<SetStateAction<'uploaded' | 'edited' | 'upload'>>;
  setDisplayTab: Dispatch<SetStateAction<'uploaded' | 'edited'>>;
  isPhotographer: boolean;
  isEditor: boolean;
  renderClientEditedCategoryTabs: () => ReactNode;
  renderEditedTab: () => ReactNode;
  renderRawUploadsTab: () => ReactNode;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  mediaViewMode: 'list' | 'grid';
  toggleMediaViewMode: (mode: 'list' | 'grid') => void;
  sortMenuOpen: boolean;
  setSortMenuOpen: Dispatch<SetStateAction<boolean>>;
  sortOrder: MediaSortOrder;
  isDragMode: boolean;
  sortSaveStatus: 'idle' | 'saving' | 'saved';
  changeSortOrder: (order: MediaSortOrder) => void;
  toggleDragMode: () => void;
  showUploadTab: boolean;
  selectedFiles: Set<string>;
  setRequestManagerOpen: Dispatch<SetStateAction<boolean>>;
  downloading: boolean;
  handleDownload: (size: 'original' | 'small') => Promise<void>;
  handleGenerateShareLink: (shareAll?: boolean) => Promise<void>;
  handleEditorDownloadRaw: (downloadAll?: boolean) => Promise<void>;
  canMarkSelectedFiles: boolean;
  canDownload: boolean;
  isAdmin: boolean;
  handleReclassify: (type: ReclassifyMediaType, fileIdsOverride?: Array<string | number>) => Promise<void>;
  markMenuOptions: Array<{ label: string; value: ReclassifyMediaType }>;
  canDelete: boolean;
  handleDeleteFiles: () => Promise<void>;
  canBatchRename?: boolean;
  batchRenameEnabled?: boolean;
  onOpenBatchRename?: () => void;
  presentationActions?: ReactNode;
  canCreateRequest?: boolean;
}

export function ShootMediaHeader({
  shootId,
  visibleFileCount,
  isClient, rawFiles, editedFiles, activeSubTab, displayTab, defaultTab, setActiveSubTab, setDisplayTab,
  isPhotographer, isEditor, renderClientEditedCategoryTabs, renderEditedTab, renderRawUploadsTab,
  isExpanded, onToggleExpand, mediaViewMode, toggleMediaViewMode, sortMenuOpen, setSortMenuOpen,
  sortOrder, isDragMode, sortSaveStatus, changeSortOrder, toggleDragMode, showUploadTab,
  selectedFiles, setRequestManagerOpen, downloading, handleDownload, handleGenerateShareLink,
  handleEditorDownloadRaw, canMarkSelectedFiles, canDownload, isAdmin, handleReclassify,
  markMenuOptions, canDelete, handleDeleteFiles,
  canBatchRename = false, batchRenameEnabled = false, onOpenBatchRename,
  presentationActions,
  canCreateRequest = true,
}: ShootMediaHeaderProps) {
  const hasMoreActions = canMarkSelectedFiles || (isClient && canCreateRequest) || canDelete;
  const libraryCount = visibleFileCount ?? (displayTab === 'edited' ? editedFiles.length : rawFiles.length);

  return (
    <>
      {/* Header - Tabs with Upload button inline on desktop, expand/collapse button */}
      <div className="shoot-media-header border-b flex-shrink-0 bg-background pt-1 sm:pt-2">
        <div className="shoot-media-heading hidden items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Media library</h2>
          <span className="border-l pl-3 text-xs tabular-nums text-muted-foreground">{libraryCount} file{libraryCount === 1 ? '' : 's'}</span>
        </div>
        <div className="shoot-media-primary-controls flex items-center justify-between gap-2">
          {isClient ? (
            renderClientEditedCategoryTabs()
          ) : (
            <Tabs value={activeSubTab === 'upload' ? displayTab : (activeSubTab === 'uploaded' || activeSubTab === 'edited' ? activeSubTab : defaultTab)} onValueChange={(v) => {
              if (v === 'media') {
                // Media tab defaults based on role
                if (isClient) {
                  setActiveSubTab('edited');
                  setDisplayTab('edited');
                } else {
                  setActiveSubTab('uploaded');
                  setDisplayTab('uploaded');
                }
              } else if (v === 'uploaded' && !isClient) {
                setActiveSubTab('uploaded');
                setDisplayTab('uploaded');
              } else if (v === 'edited' && !isPhotographer) {
                setActiveSubTab('edited');
                setDisplayTab('edited');
              }
            }} className="shoot-media-header-tabs flex-1 min-w-0 overflow-x-auto">
              <TabsList className="shoot-media-segments w-full justify-start h-7 sm:h-8 bg-background p-0 min-w-max sm:min-w-0 border-b rounded-none">
                {/* Media tab - visible to all */}
                <TabsTrigger 
                  value="media" 
                      className="shoot-media-legacy-tab hidden text-[11px] sm:inline-flex sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground whitespace-nowrap"
                  onClick={() => {
                    // For clients, Media tab shows edited; for others, shows uploaded
                    if (isClient) {
                      setActiveSubTab('edited');
                      setDisplayTab('edited');
                    } else {
                      setActiveSubTab('uploaded');
                      setDisplayTab('uploaded');
                    }
                  }}
                >
                  Media
                </TabsTrigger>
                {isEditor ? (
                  <>
                    {renderEditedTab()}
                    {renderRawUploadsTab()}
                  </>
                ) : (
                  <>
                    {/* Uploaded tab - hidden for clients (they only see edited media) */}
                    {renderRawUploadsTab()}
                    {renderEditedTab()}
                  </>
                )}
              </TabsList>
            </Tabs>
          )}
          
          <div className="shoot-media-toolbar flex shrink-0 items-center gap-1.5">
            {isEditor && !isClient && canDownload && displayTab === 'uploaded' && shootId != null && (
              <RawDownloadBatches key={shootId} shootId={shootId} files={rawFiles} disabled={downloading} />
            )}
            {(rawFiles.length > 0 || editedFiles.length > 0) && (
              <div className="flex shrink-0 items-center overflow-hidden rounded-md border" role="group" aria-label="Media view">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleMediaViewMode('list')}
                  className={`h-9 w-8 gap-0 rounded-none sm:h-8 ${mediaViewMode === 'list' ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : 'text-muted-foreground'}`}
                  title="List view"
                  aria-label="List view"
                  aria-pressed={mediaViewMode === 'list'}
                >
                  <List />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleMediaViewMode('grid')}
                  className={`h-9 w-8 gap-0 rounded-none sm:h-8 ${mediaViewMode === 'grid' ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : 'text-muted-foreground'}`}
                  title="Grid view"
                  aria-label="Grid view"
                  aria-pressed={mediaViewMode === 'grid'}
                >
                  <LayoutGrid />
                </Button>
              </div>
            )}
            {showUploadTab && (rawFiles.length > 0 || editedFiles.length > 0) && (
              <Button
                type="button"
                size="sm"
                className="hidden h-8 gap-1.5 px-2 text-xs sm:inline-flex"
                onClick={() => setActiveSubTab('upload')}
                title="Upload More"
                aria-label="Upload More"
              >
                <Upload />
                <span className="hidden lg:inline">Upload More</span>
              </Button>
            )}
          </div>

          {/* Expand/Collapse Button - Mobile only, on extreme right */}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="sm:hidden flex items-center justify-center h-7 w-7 rounded hover:bg-muted/50 transition-colors flex-shrink-0"
              aria-label={isExpanded ? 'Collapse media' : 'Expand media'}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* A single action row is shared by mobile and desktop. Secondary actions expand into a menu. */}
      {((!isEditor && (rawFiles.length > 0 || editedFiles.length > 0)) || selectedFiles.size > 0) && (
        <div className="shoot-media-selection-toolbar mb-1.5 flex shrink-0 flex-nowrap items-center gap-1 border-b py-1.5" role="group" aria-label="Media actions">
          {!isEditor && (rawFiles.length > 0 || editedFiles.length > 0) && (
            <MediaSortControl
              open={sortMenuOpen}
              onOpenChange={setSortMenuOpen}
              sortOrder={sortOrder}
              isDragMode={isDragMode}
              sortSaveStatus={sortSaveStatus}
              changeSortOrder={changeSortOrder}
              toggleDragMode={toggleDragMode}
              compact={sortOrder === 'manual' && selectedFiles.size > 0}
            />
          )}
          {selectedFiles.size > 0 && (
            <>
              <span className="min-w-0 flex-1 truncate pr-1 text-xs font-medium tabular-nums text-muted-foreground" title={`${selectedFiles.size} selected`}>
                {selectedFiles.size}<span className="sr-only min-[360px]:not-sr-only"> selected</span>
              </span>
              {presentationActions}
              {canDownload && (
                isEditor && displayTab === 'uploaded' ? (
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0 gap-0 sm:h-8 sm:w-8"
                    disabled={downloading}
                    aria-busy={downloading}
                    aria-label="Download selected files"
                    onClick={() => handleEditorDownloadRaw(false)}
                    title={`Download ${selectedFiles.size} raw file(s)`}
                  >
                    {downloading ? <Loader2 aria-hidden="true" /> : <Download />}
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        className="h-9 w-9 shrink-0 gap-0 sm:h-8 sm:w-8"
                        disabled={downloading}
                        aria-busy={downloading}
                        aria-label="Download selected files"
                        title={`Download ${selectedFiles.size} file(s)`}
                      >
                        {downloading ? <Loader2 aria-hidden="true" /> : <Download />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" collisionPadding={12}>
                      <DropdownMenuLabel>Download {selectedFiles.size} selected</DropdownMenuLabel>
                      <DropdownMenuItem className="min-h-10" onClick={() => handleDownload('small')}>
                        <Download className="mr-2 h-4 w-4" />
                        <div>
                          <div className="text-sm font-medium">MLS Optimized</div>
                          <div className="text-xs text-muted-foreground">Best for MLS uploads</div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="min-h-10" onClick={() => handleDownload('original')}>
                        <Download className="mr-2 h-4 w-4" />
                        <div>
                          <div className="text-sm font-medium">Print Resolution</div>
                          <div className="text-xs text-muted-foreground">Large files for print/design</div>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              )}
              {hasMoreActions && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="outline" className="h-9 w-9 shrink-0 gap-0 sm:h-8 sm:w-8" aria-label="More selected file actions" title="More actions">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" collisionPadding={12}>
                    <DropdownMenuLabel>{selectedFiles.size} selected</DropdownMenuLabel>
                    {canMarkSelectedFiles && (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="min-h-10">
                          <FileIcon className="mr-2 h-4 w-4" />Mark as
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent collisionPadding={12}>
                          {markMenuOptions.map(option => (
                            <DropdownMenuItem key={option.value} className="min-h-10" onClick={() => handleReclassify(option.value)}>
                              {option.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    )}
                    {isClient && canCreateRequest && (
                      <DropdownMenuItem className="min-h-10" onClick={() => setRequestManagerOpen(true)}>
                        <AlertCircle className="mr-2 h-4 w-4" />Create request
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="min-h-10 text-destructive focus:text-destructive" onClick={handleDeleteFiles}>
                          <Trash2 className="mr-2 h-4 w-4" />Delete {selectedFiles.size} selected file{selectedFiles.size === 1 ? '' : 's'}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
