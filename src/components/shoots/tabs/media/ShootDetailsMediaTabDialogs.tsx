/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShootRequestManager } from '../ShootRequestManager';
import { MediaViewer } from './MediaViewer';
import { Sparkles } from 'lucide-react';

export function ShootDetailsMediaTabDialogs(props: any) {
  const {
    viewerOpen,
    setViewerOpen,
    viewerFiles,
    viewerIndex,
    setViewerIndex,
    getImageUrl,
    getSrcSet,
    shoot,
    isAdmin,
    isClient,
    onShootUpdate,
    canInteractSingleMedia,
    canDownloadSingleMedia,
    canPreviewFullSize,
    onToggleFavorite,
    onAddComment,
    onToggleHidden,
    onDownloadSingle,
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
        getSrcSet={getSrcSet}
        shoot={shoot}
        isAdmin={isAdmin}
        isClient={isClient}
        onShootUpdate={onShootUpdate}
        canInteractSingleMedia={canInteractSingleMedia}
        canDownloadSingleMedia={canDownloadSingleMedia}
        canPreviewFullSize={canPreviewFullSize}
        onToggleFavorite={onToggleFavorite}
        onAddComment={onAddComment}
        onToggleHidden={onToggleHidden}
        onDownloadSingle={onDownloadSingle}
      />

      {/* AI Edit Dialog */}
      <Dialog open={showAiEditDialog} onOpenChange={setShowAiEditDialog}>
        <DialogContent className="max-w-lg w-[90vw] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-base">Ai Edit</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Send raw images to AI for editing after upload
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="relative">
            <div className="p-5 space-y-4 blur-[2px] opacity-60 pointer-events-none select-none" aria-hidden="true">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Exposure Balance', 'Auto-correct highlights and shadows'],
                  ['Sky Cleanup', 'Enhance outdoor scenes with clean sky replacement'],
                  ['Window Pull', 'Balance interiors with brighter window views'],
                  ['Color Polish', 'Refine tones for listing-ready delivery'],
                ].map(([title, description]) => (
                  <div key={title} className="border rounded-lg p-3 space-y-1.5">
                    <div className="h-20 bg-muted rounded flex items-center justify-center">
                      <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <p className="text-xs font-medium">{title}</p>
                    <p className="text-[10px] text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="flex-1 h-9 bg-muted rounded" />
                <div className="w-28 h-9 bg-violet-200 rounded dark:bg-violet-900" />
              </div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <div className="bg-card border shadow-lg rounded-xl px-6 py-4 text-center space-y-2">
                <Sparkles className="h-8 w-8 mx-auto text-violet-500" />
                <h3 className="text-lg font-semibold">Coming Soon</h3>
                <p className="text-sm text-muted-foreground max-w-[260px]">
                  AI image editing will be available in a future update.
                </p>
              </div>
            </div>
          </div>
          <div className="px-4 pb-4 flex justify-end">
            <Button variant="outline" onClick={() => setShowAiEditDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
