import { ShootEditingDialog } from '@/components/shoots/ShootEditingDialog';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { ShootRequestManager } from '../ShootRequestManager';
import { MediaViewer } from './MediaViewer';

export function ShootDetailsMediaTabDialogs(props: any) {
  const {
    viewerOpen,
    setViewerOpen,
    viewerFiles,
    viewerIndex,
    setViewerIndex,
    setViewerFiles,
    getImageUrl,
    shoot,
    isAdmin,
    isClient,
    canViewFullSize,
    canStartSlideshow,
    slideshowFiles,
    onShootUpdate,
    canInteractSingleMedia,
    canDownloadSingleMedia,
    onToggleFavorite,
    onAddComment,
    onToggleHidden,
    onDownloadSingle,
    downloadingFileIds,
    showAiEditDialog,
    setShowAiEditDialog,
    selectedFiles,
    requestManagerOpen,
    setRequestManagerOpen,
    isPhotographer,
    isEditor,
    setSelectedFiles,
  } = props;
  return (
    <>
      {/* Image Viewer */}
      <MediaViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        files={viewerFiles}
        currentIndex={viewerIndex}
        onIndexChange={setViewerIndex}
        getImageUrl={getImageUrl}
        shoot={shoot}
        isAdmin={isAdmin}
        isClient={isClient}
        canViewFullSize={canViewFullSize}
        canStartSlideshow={canStartSlideshow}
        slideshowFiles={slideshowFiles}
        onViewerContextChange={(index: number, files: any[]) => {
          setViewerFiles(files);
          setViewerIndex(index);
        }}
        onShootUpdate={onShootUpdate}
        canInteractSingleMedia={canInteractSingleMedia}
        canDownloadSingleMedia={canDownloadSingleMedia}
        onToggleFavorite={onToggleFavorite}
        onAddComment={onAddComment}
        onToggleHidden={onToggleHidden}
        onDownloadSingle={onDownloadSingle}
        downloadingFileIds={downloadingFileIds}
      />

      {showAiEditDialog && <ShootEditingDialog shootId={shoot.id} fileIds={Array.from(selectedFiles as Set<string>).map(Number)} onClose={sent => {
        setShowAiEditDialog(false);
        if (sent) { setSelectedFiles(new Set()); onShootUpdate(); }
      }} />}

      {/* Request Manager Modal - for creating requests with selected photos */}
                <ShootRequestManager
        isOpen={requestManagerOpen}
        onClose={() => {
          setRequestManagerOpen(false);
          setSelectedFiles(new Set()); // Clear selection after closing
        }}
        shootId={shoot.id}
        isAdmin={isAdmin}
        isPhotographer={isPhotographer}
        isEditor={isEditor}
        isClient={isClient}
        onIssueUpdate={() => {
          onShootUpdate();
          setSelectedFiles(new Set()); // Clear selection after request is created
        }}
        preselectedMediaIds={Array.from(selectedFiles)}
      />
    </>
  );
}
