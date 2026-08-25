import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileIcon,
  GripVertical,
  LayoutGrid,
  List,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { ReclassifyMediaType } from './useShootMediaActions';
import { DEFAULT_MEDIA_SORT, type MediaSortOrder } from './mediaSort';

interface ShootMediaHeaderProps {
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
  sortSaveStatus: 'idle' | 'saving' | 'saved';
  changeSortOrder: (order: MediaSortOrder) => void;
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
  handleReclassify: (type: ReclassifyMediaType) => Promise<void>;
  markMenuOptions: Array<{ label: string; value: ReclassifyMediaType }>;
  canDelete: boolean;
  handleDeleteFiles: () => Promise<void>;
}

export function ShootMediaHeader({
  isClient, rawFiles, editedFiles, activeSubTab, displayTab, defaultTab, setActiveSubTab, setDisplayTab,
  isPhotographer, isEditor, renderClientEditedCategoryTabs, renderEditedTab, renderRawUploadsTab,
  isExpanded, onToggleExpand, mediaViewMode, toggleMediaViewMode, sortMenuOpen, setSortMenuOpen,
  sortOrder, sortSaveStatus, changeSortOrder, showUploadTab,
  selectedFiles, setRequestManagerOpen, downloading, handleDownload, handleGenerateShareLink,
  handleEditorDownloadRaw, canMarkSelectedFiles, canDownload, isAdmin, handleReclassify,
  markMenuOptions, canDelete, handleDeleteFiles,
}: ShootMediaHeaderProps) {
  return (
    <>
      {/* Header - Tabs with Upload button inline on desktop, expand/collapse button */}
      <div className="border-b flex-shrink-0 bg-background pt-1 sm:pt-2">
        <div className="flex items-center justify-between gap-2">
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
            }} className="flex-1 min-w-0">
              <TabsList className="w-full justify-start h-7 sm:h-8 bg-background p-0 min-w-max sm:min-w-0 border-b rounded-none">
                {/* Media tab - visible to all */}
                <TabsTrigger 
                  value="media" 
                      className="hidden text-[11px] sm:inline-flex sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground whitespace-nowrap"
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
          
          {/* List / Grid view toggle - visible on all screen sizes */}
          {(rawFiles.length > 0 || editedFiles.length > 0) && (
            <div className="flex sm:hidden items-center border rounded-md overflow-hidden flex-shrink-0">
              <button
                onClick={() => toggleMediaViewMode('list')}
                className={`h-7 w-7 flex items-center justify-center transition-colors ${mediaViewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => toggleMediaViewMode('grid')}
                className={`h-7 w-7 flex items-center justify-center transition-colors ${mediaViewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                title="Grid view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Upload and Download buttons - Inline on desktop, below on mobile */}
          <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
            {/* Sort dropdown - hidden for editors */}
            {!isEditor && (rawFiles.length > 0 || editedFiles.length > 0) && (
              <DropdownMenu open={sortMenuOpen} onOpenChange={setSortMenuOpen}>
                <div className="flex items-center rounded-md border overflow-hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 text-[11px] px-2 rounded-none border-0 ${
                      sortOrder === 'manual'
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-transparent'
                    }`}
                    // Selecting Manual from the menu switches dragging on, so
                    // this segment is the way back out of it. Any arrangement
                    // already made is saved, so stopping is non-destructive.
                    onClick={() => {
                      if (sortOrder === 'manual') {
                        changeSortOrder(DEFAULT_MEDIA_SORT);
                        return;
                      }

                      setSortMenuOpen(true);
                    }}
                    title={
                      sortOrder === 'manual'
                        ? 'Reordering is on - click to stop. Your order is saved.'
                        : 'Change photo order'
                    }
                  >
                    {sortOrder === 'manual' ? (
                      <GripVertical className="h-3 w-3 mr-1" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 mr-1" />
                    )}
                    <span>
                      {sortOrder === 'manual'
                        ? 'Reordering - Click to Stop'
                        : `Sort: ${sortOrder === 'name' ? 'Name' : sortOrder === 'date' ? 'Date' : 'Time'}`}
                    </span>
                    {sortSaveStatus === 'saving' && (
                      <Loader2 className={`h-3 w-3 ml-1 animate-spin ${sortOrder === 'manual' ? 'text-white/80' : 'text-muted-foreground'}`} />
                    )}
                    {sortSaveStatus === 'saved' && (
                      <Check className={`h-3 w-3 ml-1 ${sortOrder === 'manual' ? 'text-white' : 'text-green-500'}`} />
                    )}
                  </Button>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 w-7 px-0 rounded-none border-l ${
                        sortOrder === 'manual'
                          ? 'border-white/20 bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-transparent'
                      }`}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                </div>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => changeSortOrder('manual')}>
                    <span className={sortOrder === 'manual' ? 'font-medium' : ''}>Manual (Drag &amp; Drop)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeSortOrder('time')}>
                    <span className={sortOrder === 'time' ? 'font-medium' : ''}>Time Captured</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeSortOrder('name')}>
                    <span className={sortOrder === 'name' ? 'font-medium' : ''}>File Name</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeSortOrder('date')}>
                    <span className={sortOrder === 'date' ? 'font-medium' : ''}>Date Added</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* List / Grid view toggle */}
            {(rawFiles.length > 0 || editedFiles.length > 0) && (
              <div className="flex items-center border rounded-md overflow-hidden">
                <button
                  onClick={() => toggleMediaViewMode('list')}
                  className={`h-7 w-7 flex items-center justify-center transition-colors ${mediaViewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                  title="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => toggleMediaViewMode('grid')}
                  className={`h-7 w-7 flex items-center justify-center transition-colors ${mediaViewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                  title="Grid view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {/* Upload More button - only shown when files already exist */}
            {showUploadTab && (rawFiles.length > 0 || editedFiles.length > 0) && (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-7 text-[11px] px-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setActiveSubTab('upload')}
              >
                <Upload className="h-3 w-3 mr-1" />
                <span>Upload More</span>
              </Button>
            )}
            {/* Selection actions */}
            {(canDownload || canDelete) && selectedFiles.size > 0 && (
              <>
                {/* Mark selected files - admin only */}
                {canMarkSelectedFiles && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] px-2"
                        title={`Mark ${selectedFiles.size} file(s)`}
                      >
                        <FileIcon className="h-3.5 w-3.5 mr-1" />
                        <span>Mark</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {markMenuOptions.map((option) => (
                        <DropdownMenuItem key={option.value} onClick={() => handleReclassify(option.value)}>
                          {option.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {/* Show Create Request button for clients when photos are selected */}
                {isClient && (
                  <Button
                    size="sm"
                    className="h-7 text-[11px] px-2 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setRequestManagerOpen(true)}
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    <span>Create Request ({selectedFiles.size})</span>
                  </Button>
                )}
                {canDownload && (
                  isEditor && displayTab === 'uploaded' ? (
                    <Button
                      size="sm"
                      className="h-7 text-[11px] px-2"
                      disabled={downloading}
                      onClick={() => handleEditorDownloadRaw(false)}
                      title={`Download ${selectedFiles.size} raw file(s)`}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      <span>Download</span>
                      {selectedFiles.size > 0 && (
                        <span className="inline-flex min-w-[16px] h-4 items-center justify-center rounded-full bg-primary-foreground/20 px-1 text-[9px] font-bold leading-none text-current ml-1">
                          {selectedFiles.size}
                        </span>
                      )}
                    </Button>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" className="h-7 w-7 relative" disabled={downloading} title={`Download ${selectedFiles.size} file(s)`}>
                          <Download className="h-3.5 w-3.5" />
                          {selectedFiles.size > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                              {selectedFiles.size}
                            </span>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDownload('small')}>
                          <Download className="h-4 w-4 mr-2" />
                          <div>
                            <div className="font-medium text-sm">MLS Optimized</div>
                            <div className="text-xs text-muted-foreground">Best for MLS uploads</div>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload('original')}>
                          <Download className="h-4 w-4 mr-2" />
                          <div>
                            <div className="font-medium text-sm">Print Resolution</div>
                            <div className="text-xs text-muted-foreground">Large files for print/design</div>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                )}
                {canDelete && (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-7 w-7 relative bg-red-600 hover:bg-red-700 text-white"
                    onClick={handleDeleteFiles}
                    title={`Delete ${selectedFiles.size} file(s)`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {selectedFiles.size > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-white text-red-600 text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 border border-red-300">
                        {selectedFiles.size}
                      </span>
                    )}
                  </Button>
                )}
              </>
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
      
      {/* Selected-file actions - Below tabs on mobile only */}
      {(canDownload || canDelete) && selectedFiles.size > 0 && (
        <div className="mb-1.5 pb-1 border-b flex-shrink-0 sm:hidden">
          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            {/* Mark selected files - mobile */}
            {canMarkSelectedFiles && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] px-2 flex-shrink-0"
                    title={`Mark ${selectedFiles.size} file(s)`}
                  >
                    <FileIcon className="h-3 w-3 mr-1" />
                    <span>Mark</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {markMenuOptions.map((option) => (
                    <DropdownMenuItem key={option.value} onClick={() => handleReclassify(option.value)}>
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* Show Create Request button for clients when photos are selected */}
            {isClient && (
              <Button
                size="sm"
                className="h-7 text-[11px] px-2 flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setRequestManagerOpen(true)}
              >
                <AlertCircle className="h-3 w-3 mr-1" />
                <span>Create Request</span>
              </Button>
            )}
            {canDownload && (
              isEditor && displayTab === 'uploaded' ? (
                <Button
                  size="sm"
                  className="h-7 px-2 text-[11px] gap-1.5 flex-shrink-0"
                  disabled={downloading}
                  onClick={() => handleEditorDownloadRaw(false)}
                  title={`Download ${selectedFiles.size} raw file(s)`}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                  {selectedFiles.size > 0 && (
                    <span className="inline-flex min-w-[16px] h-4 items-center justify-center rounded-full bg-primary-foreground/20 px-1 text-[9px] font-bold leading-none text-current">
                      {selectedFiles.size}
                    </span>
                  )}
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      className="h-7 px-2 text-[11px] gap-1.5 flex-shrink-0"
                      disabled={downloading}
                      title={`Download ${selectedFiles.size} file(s)`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                      {selectedFiles.size > 0 && (
                        <span className="inline-flex min-w-[16px] h-4 items-center justify-center rounded-full bg-primary-foreground/20 px-1 text-[9px] font-bold leading-none text-current">
                          {selectedFiles.size}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDownload('small')}>
                      <Download className="h-4 w-4 mr-2" />
                      <div>
                        <div className="font-medium text-sm">MLS Optimized</div>
                        <div className="text-xs text-muted-foreground">Best for MLS uploads</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownload('original')}>
                      <Download className="h-4 w-4 mr-2" />
                      <div>
                        <div className="font-medium text-sm">Print Resolution</div>
                        <div className="text-xs text-muted-foreground">Large files for print/design</div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            )}
            {canDelete && (
              <Button
                size="icon"
                variant="destructive"
                className="h-7 w-7 relative flex-shrink-0 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDeleteFiles}
                title={`Delete ${selectedFiles.size} file(s)`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {selectedFiles.size > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-white text-red-600 text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 border border-red-300">
                    {selectedFiles.size}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

    </>
  );
}

