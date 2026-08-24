import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EditedUploadSection, RawUploadSection } from './MediaUploadSections';
import { UploadProgressCard } from './MediaUploadPanels';
import { MediaGrid } from './MediaGrid';
import { IguideMediaPanel } from './IguideMediaPanel';
import { getPhotographerEditedMediaMlsLink } from '@/utils/shootTourData';
import { AlertCircle, ArrowUpDown, Check, ChevronDown, ChevronRight, ChevronUp, CloudUpload, Download, ExternalLink, FileIcon, GripVertical, LayoutGrid, List, Loader2, Trash2, Upload, X } from 'lucide-react';
import type { ShootDetailsMediaTabViewProps } from './shootDetailsMediaTabViewTypes';
import { ShootMediaHeader } from './ShootMediaHeader';

export function ShootDetailsMediaTabView(props: ShootDetailsMediaTabViewProps) {
  const {
    downloadPopup,
    handleManualDownload,
    closeDownloadPopup,
    activeSubTab,
    displayTab,
    defaultTab,
    isClient,
    isPhotographer,
    rawFiles,
    editedFiles,
    setActiveSubTab,
    setDisplayTab,
    mediaViewMode,
    toggleMediaViewMode,
    isEditor,
    sortOrder,
    isDragMode,
    sortSaveStatus,
    changeSortOrder,
    toggleDragMode,
    activeShootUploads,
    showUploadTab,
    selectedFiles,
    setRequestManagerOpen,
    downloading,
    handleDownload,
    handleDeleteFiles,
    handleGenerateShareLink,
    handleEditorDownloadRaw,
    canDelete,
    canDownload,
    isAdmin,
    handleReclassify,
    markMenuOptions,
    directUploading,
    directUploadCompleted,
    directUploadTotal,
    directUploadProgress,
    dragOverTab,
    handleTabDragEnter,
    handleTabDragLeave,
    handleTabDragOver,
    handleDirectDrop,
    uploadedMediaTab,
    setUploadedMediaTab,
    uploadedPhotos,
    uploadedVideos,
    shootHasVideoService,
    iguideUrl,
    iguideFloorplans,
    iguideSync,
    uploadedFloorplans,
    uploadedVirtualStaging,
    uploadedGreenGrass,
    uploadedTwilight,
    uploadedDrone,
    uploadedExtras,
    renderMediaGridPane,
    renderAdminUploadSection,
    shoot,
    toast,
    queryClient,
    onShootUpdate,
    clientEditedMediaTabs,
    editedMediaTab,
    setEditedMediaTab,
    editedPhotos,
    editedVideos,
    editedFloorplans,
    editedVirtualStaging,
    editedGreenGrass,
    editedTwilight,
    editedDrone,
    editedExtras,
    openViewer,
    toggleSelection,
    setSelectedFiles,
    manualOrder,
    handleManualOrderChange,
    getImageUrl,
    getSrcSet,
    isPreviewableImage,
    isVideoFile,
    isExpanded,
    onToggleExpand,
    toggleFileHidden,
  } = props;
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const canMarkSelectedFiles = !isClient && (!isEditor || displayTab === 'edited');
  const renderRawUploadsTab = () => (
    !isClient && (
      <TabsTrigger 
        value="uploaded" 
        className="text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground whitespace-nowrap"
        onClick={() => {
          setActiveSubTab('uploaded');
          setDisplayTab('uploaded');
        }}
      >
        <span className="sm:hidden">Raw ({rawFiles.length})</span>
        <span className="hidden sm:inline">Raw Uploads ({rawFiles.length})</span>
      </TabsTrigger>
    )
  );
  const renderEditedTab = () => (
    isPhotographer ? (() => {
      // Photographer-only Edited Media link → MLS tour. Only enabled once the
      // shoot has reached Ready or Delivered status; otherwise greyed out and
      // non-clickable (no edited deliverables exist yet).
      const statusSource = shoot as typeof shoot & { workflow_status?: string; status?: string };
      const photographerEditedTabStatus = String(
        statusSource.workflowStatus
          || statusSource.workflow_status
          || statusSource.status
          || '',
      ).toLowerCase();
      const photographerEditedAllowed = ['ready', 'delivered'].includes(photographerEditedTabStatus);

      return (
        <button
          type="button"
          aria-disabled={!photographerEditedAllowed}
          title={photographerEditedAllowed ? undefined : 'Available once the shoot reaches Ready or Delivered status.'}
          className={`text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 font-medium rounded-md transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
            photographerEditedAllowed
              ? 'text-primary hover:bg-primary/10 cursor-pointer'
              : 'text-muted-foreground/60 opacity-50 cursor-not-allowed pointer-events-none'
          }`}
          onClick={(event) => {
            if (!photographerEditedAllowed) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            const mlsLink = getPhotographerEditedMediaMlsLink(shoot);
            if (mlsLink) {
              window.open(mlsLink, '_blank', 'noopener,noreferrer');
            } else {
              // Open the app's MLS tour page for this shoot
              const baseUrl = window.location.origin;
              window.open(`${baseUrl}/tour/mls?shootId=${shoot.id}`, '_blank', 'noopener,noreferrer');
            }
          }}
        >
          <ExternalLink className="h-3 w-3" />
          Edited Media
        </button>
      );
    })() : (
      <TabsTrigger 
        value="edited" 
        className="text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground whitespace-nowrap"
        onClick={() => {
          setActiveSubTab('edited');
          setDisplayTab('edited');
        }}
      >
        Edited ({editedFiles.length})
      </TabsTrigger>
    )
  );
  const renderClientEditedCategoryTabs = () => (
    <div className="flex-1 min-w-0 overflow-x-auto">
      <div className="flex items-center gap-1.5 min-w-max">
        {clientEditedMediaTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setEditedMediaTab(tab.id)}
            className={`text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 rounded-full transition-all whitespace-nowrap ${
              editedMediaTab === tab.id
                ? 'bg-primary text-primary-foreground font-medium'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-background px-1 sm:px-0" style={{ height: '100%', minHeight: '100%' }}>
      {/* Download progress popup */}
      {downloadPopup.visible && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center pointer-events-none">
          <div className="pointer-events-auto mb-4 sm:mb-0 mx-4 w-full max-w-xs bg-card border rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start gap-3">
              {downloadPopup.status === 'processing' && (
                <div className="flex-shrink-0 h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <Loader2 className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
              )}
              {downloadPopup.status === 'ready' && (
                <div className="flex-shrink-0 h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <Download className="h-4.5 w-4.5 text-green-600 dark:text-green-400" />
                </div>
              )}
              {downloadPopup.status === 'error' && (
                <div className="flex-shrink-0 h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                  <AlertCircle className="h-4.5 w-4.5 text-red-600 dark:text-red-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {downloadPopup.status === 'processing' && 'Processing images…'}
                  {downloadPopup.status === 'ready' && 'Download ready!'}
                  {downloadPopup.status === 'error' && 'Download failed'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {downloadPopup.status === 'processing' && `Preparing ${downloadPopup.fileCount} image${downloadPopup.fileCount > 1 ? 's' : ''} · ${downloadPopup.sizeLabel}`}
                  {downloadPopup.status === 'ready' && `${downloadPopup.fileCount} image${downloadPopup.fileCount > 1 ? 's' : ''} · ${downloadPopup.sizeLabel}`}
                  {downloadPopup.status === 'error' && 'Something went wrong. Please try again.'}
                </p>
                {downloadPopup.status === 'ready' && (
                  <button
                    onClick={() => handleManualDownload(downloadPopup)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <Download className="h-3 w-3" />
                    Download again
                  </button>
                )}
              </div>
              <button
                onClick={() => closeDownloadPopup(downloadPopup)}
                className="flex-shrink-0 h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      )}
      <ShootMediaHeader
        isClient={isClient}
        rawFiles={rawFiles}
        editedFiles={editedFiles}
        activeSubTab={activeSubTab}
        displayTab={displayTab}
        defaultTab={defaultTab}
        setActiveSubTab={setActiveSubTab}
        setDisplayTab={setDisplayTab}
        isPhotographer={isPhotographer}
        isEditor={isEditor}
        renderClientEditedCategoryTabs={renderClientEditedCategoryTabs}
        renderEditedTab={renderEditedTab}
        renderRawUploadsTab={renderRawUploadsTab}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        mediaViewMode={mediaViewMode}
        toggleMediaViewMode={toggleMediaViewMode}
        sortMenuOpen={sortMenuOpen}
        setSortMenuOpen={setSortMenuOpen}
        sortOrder={sortOrder}
        isDragMode={isDragMode}
        sortSaveStatus={sortSaveStatus}
        changeSortOrder={changeSortOrder}
        toggleDragMode={toggleDragMode}
        showUploadTab={showUploadTab}
        selectedFiles={selectedFiles}
        setRequestManagerOpen={setRequestManagerOpen}
        downloading={downloading}
        handleDownload={handleDownload}
        handleGenerateShareLink={handleGenerateShareLink}
        handleEditorDownloadRaw={handleEditorDownloadRaw}
        canMarkSelectedFiles={canMarkSelectedFiles}
        canDownload={canDownload}
        isAdmin={isAdmin}
        handleReclassify={handleReclassify}
        markMenuOptions={markMenuOptions}
        canDelete={canDelete}
        handleDeleteFiles={handleDeleteFiles}
      />
      {/* Content - Compact Overview-style layout */}
      <div className="flex-1 min-h-0 flex flex-col bg-background">
        {activeShootUploads.length > 0 && (
          <div className="space-y-2 border-b bg-background px-2.5 py-2">
            {activeShootUploads.map((upload) => (
              <UploadProgressCard
                key={upload.id}
                fileCount={upload.fileCount}
                fileNames={upload.fileNames}
                progress={upload.progress}
                note={`${
                  upload.uploadType === 'edited' ? 'Edited' : 'Raw'
                } files are still uploading in the background. You can stay on this shoot and keep working.`}
              />
            ))}
          </div>
        )}
        {activeSubTab === 'upload' ? (
          /* Upload Tab Content */
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5" data-testid="media-upload-scroll-owner">
            <div className="border rounded-lg bg-card p-3 pb-6 flex min-h-full flex-col">
              {isAdmin ? (
                /* Admins upload raw or edited files based on which tab they're on */
                /* Invoked, not mounted: see renderAdminUploadSection's note. As a
                   component its identity changed every parent render and React
                   remounted the upload panel, wiping the staged queue. */
                renderAdminUploadSection({
                  shoot,
                  uploadContext: displayTab === 'edited' ? 'edited' : 'raw',
                  onUploadComplete: () => {
                    toast({
                      title: 'Upload complete',
                      description: 'Files uploaded successfully',
                    });
                    // Invalidate React Query cache to refresh files
                    queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
                    queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
                    onShootUpdate();
                    setActiveSubTab('uploaded');
                    setDisplayTab('uploaded');
                  },
                  onEditedUploadComplete: () => {
                    toast({
                      title: 'Upload complete',
                      description: 'Edited files uploaded successfully',
                    });
                    // Invalidate React Query cache to refresh files
                    queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
                    queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
                    onShootUpdate();
                    setActiveSubTab('edited');
                    setDisplayTab('edited');
                  },
                })
              ) : isEditor ? (
                <EditedUploadSection
                  shoot={shoot}
                  isEditor={isEditor}
                  showInlineProgress={false}
                    onUploadComplete={() => {
                      toast({
                        title: 'Upload complete',
                        description: 'Edited files uploaded successfully',
                      });
                      // Invalidate React Query cache to refresh files
                      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
                      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
                      onShootUpdate();
                      setActiveSubTab('edited');
                      setDisplayTab('edited');
                    }}
                />
              ) : (
                <RawUploadSection
                  shoot={shoot}
                  rawFiles={rawFiles}
                  showInlineProgress={false}
                    onUploadComplete={() => {
                      toast({
                        title: 'Upload complete',
                        description: 'Files uploaded successfully',
                      });
                      // Invalidate React Query cache to refresh files
                      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'raw'] });
                      queryClient.invalidateQueries({ queryKey: ['shootFiles', shoot.id, 'edited'] });
                      onShootUpdate();
                      setActiveSubTab('uploaded');
                      setDisplayTab('uploaded');
                    }}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 w-full h-full bg-background" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Clients should only see edited media; raw uploads are hidden */}
            
            {/* Uploaded Media Tab - Hidden for clients */}
            {!isClient && displayTab === 'uploaded' && (
              <div
                className="flex-1 relative"
                style={{ minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
                onDragEnter={(e) => handleTabDragEnter(e, 'uploaded')}
                onDragLeave={handleTabDragLeave}
                onDragOver={handleTabDragOver}
                onDrop={(e) => handleDirectDrop(e, 'raw')}
              >
                {/* Drag overlay */}
                {dragOverTab === 'uploaded' && showUploadTab && (
                  <div className="absolute inset-0 z-30 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-2 text-primary">
                      <CloudUpload className="h-12 w-12" />
                      <span className="text-sm font-medium">Drop files to upload as Raw</span>
                    </div>
                  </div>
                )}
                {/* Direct upload progress bar */}
                {directUploading && displayTab === 'uploaded' && (
                  <div className="px-2.5 py-1.5 border-b bg-background flex-shrink-0">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Uploading {directUploadCompleted}/{directUploadTotal} file(s)...</span>
                      <span>{directUploadProgress}%</span>
                    </div>
                    <Progress value={directUploadProgress} className="h-1.5" />
                  </div>
                )}
                {/* Sub-tabs for Photos/Videos/iGuide/Floorplans */}
                <div className="sticky top-0 z-10 px-2.5 py-1.5 border-b bg-background" style={{ flexShrink: 0 }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      <button
                        onClick={() => setUploadedMediaTab('photos')}
                        className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${uploadedMediaTab === 'photos' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                      >
                        Photos ({uploadedPhotos.length})
                      </button>
                      {(shootHasVideoService || uploadedVideos.length > 0) && (
                        <button
                          onClick={() => setUploadedMediaTab('videos')}
                          className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${uploadedMediaTab === 'videos' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                        >
                          Video ({uploadedVideos.length})
                        </button>
                      )}
                      {!isEditor && iguideUrl && (
                        <button
                          onClick={() => setUploadedMediaTab('iguide')}
                          className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${uploadedMediaTab === 'iguide' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                        >
                          iGuide
                        </button>
                      )}
                      {!isEditor && (uploadedFloorplans.length > 0 || iguideFloorplans.length > 0) && (
                        <button
                          onClick={() => setUploadedMediaTab('floorplans')}
                          className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${uploadedMediaTab === 'floorplans' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                        >
                          Floorplans ({uploadedFloorplans.length + iguideFloorplans.length})
                        </button>
                      )}
                      {uploadedVirtualStaging.length > 0 && (
                        <button
                          onClick={() => setUploadedMediaTab('virtualStaging')}
                          className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${uploadedMediaTab === 'virtualStaging' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                        >
                          Virtual Staging ({uploadedVirtualStaging.length})
                        </button>
                      )}
                      {uploadedGreenGrass.length > 0 && (
                        <button
                          onClick={() => setUploadedMediaTab('greenGrass')}
                          className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${uploadedMediaTab === 'greenGrass' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                        >
                          Green Grass ({uploadedGreenGrass.length})
                        </button>
                      )}
                      {uploadedTwilight.length > 0 && (
                        <button
                          onClick={() => setUploadedMediaTab('twilight')}
                          className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${uploadedMediaTab === 'twilight' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                        >
                          Twilight ({uploadedTwilight.length})
                        </button>
                      )}
                      {uploadedDrone.length > 0 && (
                        <button
                          onClick={() => setUploadedMediaTab('drone')}
                          className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${uploadedMediaTab === 'drone' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                        >
                          Drone ({uploadedDrone.length})
                        </button>
                      )}
                      {uploadedExtras.length > 0 && (
                        <button
                          onClick={() => setUploadedMediaTab('extras')}
                          className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${uploadedMediaTab === 'extras' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                        >
                          Extras ({uploadedExtras.length})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Sub-tab content */}
                <div style={{ flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}>
                  {uploadedMediaTab === 'photos' &&
                    renderMediaGridPane(
                      uploadedPhotos,
                      'No uploaded files yet',
                      `${shootHasVideoService ? 'Upload property photos and videos to get started.' : 'Upload property photos to get started.'} Our AI will automatically analyze assets for quality and categorization.`,
                    )}
                  
                  {uploadedMediaTab === 'videos' &&
                    renderMediaGridPane(
                      uploadedVideos,
                      'No uploaded videos yet',
                      'Upload property videos to get started. Our AI will automatically analyze assets for quality and categorization.',
                      'Upload Videos',
                    )}
                  
                  {uploadedMediaTab === 'iguide' && iguideUrl && (
                    <IguideMediaPanel iguideUrl={iguideUrl} iguideSync={iguideSync} />
                  )}
                  
                  {uploadedMediaTab === 'floorplans' && (uploadedFloorplans.length > 0 || iguideFloorplans.length > 0) && (
                    <div className="h-full overflow-y-auto">
                      {/* Uploaded floorplan images */}
                      {uploadedFloorplans.length > 0 && (
                        <div className="m-0 sm:m-2.5 border-0 sm:border rounded-none sm:rounded-lg bg-card p-1 sm:p-2.5">
                          <MediaGrid
                            files={uploadedFloorplans}
                            onFileClick={(index, sorted) => openViewer(index, sorted, 'uploaded')}
                            selectedFiles={selectedFiles}
                            onSelectionChange={toggleSelection}
                            onSelectAll={() => {
                              if (selectedFiles.size === uploadedFloorplans.length) {
                                setSelectedFiles(new Set());
                              } else {
                                setSelectedFiles(new Set(uploadedFloorplans.map(f => f.id)));
                              }
                            }}
                            canSelect={canDownload}
                            sortOrder={sortOrder}
                            manualOrder={manualOrder}
                            onManualOrderChange={(nextOrder) => handleManualOrderChange(uploadedFloorplans, nextOrder)}
                            getImageUrl={getImageUrl}
                            getSrcSet={getSrcSet}
                            isImage={isPreviewableImage}
                            isVideo={isVideoFile}
                            viewMode={mediaViewMode}
                            isClient={isClient}
                            toggleFileHidden={toggleFileHidden}
                          />
                        </div>
                      )}
                      {/* iGuide floorplan links */}
                      {iguideFloorplans.length > 0 && (
                        <div className="m-2.5 border rounded-lg bg-card p-4">
                          <h4 className="font-medium mb-3 text-sm">iGuide Floorplans ({iguideFloorplans.length})</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {iguideFloorplans.map((fp, idx) => (
                              <div key={idx} className="border rounded-lg p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                                  <span className="text-sm">{fp.filename || `Floorplan ${idx + 1}`}</span>
                                </div>
                                <a
                                  href={fp.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline"
                                >
                                  View
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {uploadedMediaTab === 'virtualStaging' &&
                    renderMediaGridPane(
                      uploadedVirtualStaging,
                      'No virtual staging files yet',
                      'Upload files marked as VS to keep virtual staging assets grouped separately from standard photos.',
                    )}

                  {uploadedMediaTab === 'greenGrass' &&
                    renderMediaGridPane(
                      uploadedGreenGrass,
                      'No green grass files yet',
                      'Upload files marked as GG to keep green grass edits grouped separately from standard photos.',
                    )}

                  {uploadedMediaTab === 'twilight' &&
                    renderMediaGridPane(
                      uploadedTwilight,
                      'No twilight files yet',
                      'Upload files marked as TW to keep twilight edits grouped separately from standard photos.',
                    )}

                  {uploadedMediaTab === 'drone' &&
                    renderMediaGridPane(
                      uploadedDrone,
                      'No drone files yet',
                      'Upload files marked as DR to keep drone deliverables grouped separately from the main gallery.',
                    )}

                  {uploadedMediaTab === 'extras' &&
                    renderMediaGridPane(
                      uploadedExtras,
                      'No extra files yet',
                      'Upload files marked as EX to collect add-on assets in a separate extras tab.',
                      'Upload Extras',
                      false,
                    )}
                </div>
              </div>
            )}

            {/* Edited Media Tab - Hidden for photographers (they use MLS link) */}
            {!isPhotographer && displayTab === 'edited' && (
              <div
                className="flex-1 relative"
                style={{ minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
                onDragEnter={(e) => handleTabDragEnter(e, 'edited')}
                onDragLeave={handleTabDragLeave}
                onDragOver={handleTabDragOver}
                onDrop={(e) => handleDirectDrop(e, 'edited')}
              >
                {/* Drag overlay */}
                {dragOverTab === 'edited' && showUploadTab && (
                  <div className="absolute inset-0 z-30 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-2 text-primary">
                      <CloudUpload className="h-12 w-12" />
                      <span className="text-sm font-medium">Drop files to upload as Edited</span>
                    </div>
                  </div>
                )}
                {/* Direct upload progress bar */}
                {directUploading && displayTab === 'edited' && (
                  <div className="px-2.5 py-1.5 border-b bg-background flex-shrink-0">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Uploading {directUploadCompleted}/{directUploadTotal} file(s)...</span>
                      <span>{directUploadProgress}%</span>
                    </div>
                    <Progress value={directUploadProgress} className="h-1.5" />
                  </div>
                )}
                {!isClient && (
                  <div className="sticky top-0 z-10 px-2.5 py-1.5 border-b bg-background" style={{ flexShrink: 0 }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 overflow-x-auto">
                        <button
                          onClick={() => setEditedMediaTab('photos')}
                          className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${editedMediaTab === 'photos' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                        >
                          Photos ({editedPhotos.length})
                        </button>
                        {(shootHasVideoService || editedVideos.length > 0) && (
                          <button
                            onClick={() => setEditedMediaTab('videos')}
                            className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${editedMediaTab === 'videos' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                          >
                            Video ({editedVideos.length})
                          </button>
                        )}
                        {!isEditor && iguideUrl && (
                          <button
                            onClick={() => setEditedMediaTab('iguide')}
                            className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${editedMediaTab === 'iguide' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                          >
                            iGuide
                          </button>
                        )}
                        {!isEditor && (editedFloorplans.length > 0 || iguideFloorplans.length > 0) && (
                          <button
                            onClick={() => setEditedMediaTab('floorplans')}
                            className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${editedMediaTab === 'floorplans' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                          >
                            Floorplans ({editedFloorplans.length + iguideFloorplans.length})
                          </button>
                        )}
                        {editedVirtualStaging.length > 0 && (
                          <button
                            onClick={() => setEditedMediaTab('virtualStaging')}
                            className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${editedMediaTab === 'virtualStaging' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                          >
                            Virtual Staging ({editedVirtualStaging.length})
                          </button>
                        )}
                        {editedGreenGrass.length > 0 && (
                          <button
                            onClick={() => setEditedMediaTab('greenGrass')}
                            className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${editedMediaTab === 'greenGrass' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                          >
                            Green Grass ({editedGreenGrass.length})
                          </button>
                        )}
                        {editedTwilight.length > 0 && (
                          <button
                            onClick={() => setEditedMediaTab('twilight')}
                            className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${editedMediaTab === 'twilight' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                          >
                            Twilight ({editedTwilight.length})
                          </button>
                        )}
                        {editedDrone.length > 0 && (
                          <button
                            onClick={() => setEditedMediaTab('drone')}
                            className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${editedMediaTab === 'drone' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                          >
                            Drone ({editedDrone.length})
                          </button>
                        )}
                        {editedExtras.length > 0 && (
                          <button
                            onClick={() => setEditedMediaTab('extras')}
                            className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${editedMediaTab === 'extras' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                          >
                            Extras ({editedExtras.length})
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Sub-tab content */}
                <div style={{ flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}>
                  {editedMediaTab === 'photos' &&
                    renderMediaGridPane(
                      editedPhotos,
                      'No edited files yet',
                      'Upload edited photos and videos to get started. Our AI will automatically analyze assets for quality and categorization.',
                    )}
                  
                  {editedMediaTab === 'videos' &&
                    renderMediaGridPane(
                      editedVideos,
                      'No edited videos yet',
                      'Upload edited videos to get started. Our AI will automatically analyze assets for quality and categorization.',
                      'Upload Videos',
                    )}
                  
                  {editedMediaTab === 'iguide' && iguideUrl && (
                    <IguideMediaPanel iguideUrl={iguideUrl} iguideSync={iguideSync} />
                  )}
                  
                  {editedMediaTab === 'floorplans' && (editedFloorplans.length > 0 || iguideFloorplans.length > 0) && (
                    <div className="h-full overflow-y-auto">
                      {/* Edited floorplan images */}
                      {editedFloorplans.length > 0 && (
                        <div className="m-0 sm:m-2.5 border-0 sm:border rounded-none sm:rounded-lg bg-card p-1 sm:p-2.5">
                          <MediaGrid
                            files={editedFloorplans}
                            onFileClick={(index, sorted) => openViewer(index, sorted, 'edited')}
                            selectedFiles={selectedFiles}
                            onSelectionChange={toggleSelection}
                            onSelectAll={() => {
                              if (selectedFiles.size === editedFloorplans.length) {
                                setSelectedFiles(new Set());
                              } else {
                                setSelectedFiles(new Set(editedFloorplans.map(f => f.id)));
                              }
                            }}
                            canSelect={canDownload}
                            sortOrder={sortOrder}
                            manualOrder={manualOrder}
                            onManualOrderChange={(nextOrder) => handleManualOrderChange(editedFloorplans, nextOrder)}
                            getImageUrl={getImageUrl}
                            getSrcSet={getSrcSet}
                            isImage={isPreviewableImage}
                            isVideo={isVideoFile}
                            viewMode={mediaViewMode}
                            isClient={isClient}
                            toggleFileHidden={toggleFileHidden}
                          />
                        </div>
                      )}
                      {/* iGuide floorplan links */}
                      {iguideFloorplans.length > 0 && (
                        <div className="m-2.5 border rounded-lg bg-card p-4">
                          <h4 className="font-medium mb-3 text-sm">iGuide Floorplans ({iguideFloorplans.length})</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {iguideFloorplans.map((fp, idx) => (
                              <div key={idx} className="border rounded-lg p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                                  <span className="text-sm">{fp.filename || `Floorplan ${idx + 1}`}</span>
                                </div>
                                <a
                                  href={fp.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline"
                                >
                                  View
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {editedMediaTab === 'virtualStaging' &&
                    renderMediaGridPane(
                      editedVirtualStaging,
                      'No virtual staging files yet',
                      'Files marked as VS will appear here so virtual staging deliverables stay separated from the main gallery.',
                    )}

                  {editedMediaTab === 'greenGrass' &&
                    renderMediaGridPane(
                      editedGreenGrass,
                      'No green grass files yet',
                      'Files marked as GG will appear here so green grass edits stay separated from the main gallery.',
                    )}

                  {editedMediaTab === 'twilight' &&
                    renderMediaGridPane(
                      editedTwilight,
                      'No twilight files yet',
                      'Files marked as TW will appear here so twilight deliverables stay separated from the main gallery.',
                    )}

                  {editedMediaTab === 'drone' &&
                    renderMediaGridPane(
                      editedDrone,
                      'No drone files yet',
                      'Files marked as DR will appear here so drone deliverables stay separated from the main gallery.',
                    )}

                  {editedMediaTab === 'extras' &&
                    renderMediaGridPane(
                      editedExtras,
                      'No extra files yet',
                      'Files marked as EX will appear here as additional deliverables outside the main photo set.',
                      'Upload Extras',
                      false,
                    )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
