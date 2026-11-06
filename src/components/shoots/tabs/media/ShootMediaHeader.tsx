import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { ChevronDown, ChevronUp, LayoutGrid, List, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MediaSelectionActions, type MediaSelectionActionsProps } from './MediaSelectionActions';
import { RawDownloadBatches } from './RawDownloadBatches';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ReclassifyMediaType } from './useShootMediaActions';

export interface ShootMediaHeaderProps extends MediaSelectionActionsProps {
  hideSelectionActions?: boolean;
  shootId?: string | number;
  visibleFileCount?: number;
  activeSubTab: 'uploaded' | 'edited' | 'upload';
  defaultTab: 'uploaded' | 'edited' | 'upload';
  setActiveSubTab: Dispatch<SetStateAction<'uploaded' | 'edited' | 'upload'>>;
  setDisplayTab: Dispatch<SetStateAction<'uploaded' | 'edited'>>;
  isPhotographer: boolean;
  renderClientEditedCategoryTabs: () => ReactNode;
  renderEditedTab: () => ReactNode;
  renderRawUploadsTab: () => ReactNode;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  mediaViewMode: 'list' | 'grid';
  toggleMediaViewMode: (mode: 'list' | 'grid') => void;
  showUploadTab: boolean;
  handleGenerateShareLink: (shareAll?: boolean) => Promise<void>;
  handleReclassify: (type: ReclassifyMediaType, fileIdsOverride?: Array<string | number>) => Promise<void>;
  markMenuOptions: Array<{ label: string; value: ReclassifyMediaType }>;
  canBatchRename?: boolean;
  batchRenameEnabled?: boolean;
  onOpenBatchRename?: () => void;
}

export function ShootMediaHeader(props: ShootMediaHeaderProps) {
  const {
    shootId, visibleFileCount, isClient, rawFiles, editedFiles, activeSubTab, displayTab, defaultTab,
    setActiveSubTab, setDisplayTab, isPhotographer, isEditor, renderClientEditedCategoryTabs,
    renderEditedTab, renderRawUploadsTab, isExpanded, onToggleExpand, mediaViewMode, toggleMediaViewMode,
    showUploadTab, canDownload, downloading, desktop = false, hideSelectionActions = false,
  } = props;
  const libraryCount = visibleFileCount ?? (displayTab === 'edited' ? editedFiles.length : rawFiles.length);

  return (
    <>
      {/* Header - Tabs with Upload button inline on desktop, expand/collapse button */}
      <div className="shoot-media-header border-b flex-shrink-0 bg-background pt-1 sm:pt-2">
        <div className="shoot-media-heading hidden items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Media library</h2>
          <span className="border-l pl-3 text-xs tabular-nums text-muted-foreground">{libraryCount} file{libraryCount === 1 ? '' : 's'}</span>
        </div>
        <div className={`shoot-media-primary-controls flex items-center justify-between gap-2${desktop && isClient ? ' shoot-media-client-primary-controls' : ''}`}>
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

          {desktop && isClient && !hideSelectionActions && <MediaSelectionActions {...props} desktop />}

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
      
      {!hideSelectionActions && !(desktop && isClient) && <MediaSelectionActions {...props} desktop={desktop} />}
    </>
  );
}
