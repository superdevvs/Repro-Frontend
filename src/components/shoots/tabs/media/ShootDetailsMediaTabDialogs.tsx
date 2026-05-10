/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShootRequestManager } from '../ShootRequestManager';
import { MediaViewer } from './MediaViewer';
import { Loader2, Sparkles } from 'lucide-react';

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
    showAiEditDialog,
    setShowAiEditDialog,
    selectedFiles,
    editingTypes,
    selectedEditingType,
    setSelectedEditingType,
    submittingAiEdit,
    handleAiEdit,
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
      />

      {/* AI Edit Dialog */}
      <Dialog open={showAiEditDialog} onOpenChange={setShowAiEditDialog}>
        <DialogContent className="max-w-lg w-[90vw] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-base">Send to Autoenhance</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Queue selected raw photos for Autoenhance processing.
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">
                  {selectedFiles?.size || 0} selected image{selectedFiles?.size === 1 ? '' : 's'}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Each selected image will be queued as an Autoenhance job and tracked in the AI Editing activity queue.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Autoenhance mode</Label>
              <Select value={selectedEditingType} onValueChange={setSelectedEditingType} disabled={submittingAiEdit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Autoenhance mode" />
                </SelectTrigger>
                <SelectContent>
                  {(editingTypes || []).map((type: any) => (
                    <SelectItem key={type.id} value={type.id} disabled={type.id === 'hdr_merge'}>
                      {type.name}{type.id === 'hdr_merge' ? ' (coming soon)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                HDR bracket merge needs the dedicated grouped workflow and is not available from this quick action yet.
              </p>
            </div>
          </div>
          <div className="px-4 pb-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" asChild>
              <a href="/ai-editing">View Autoenhance Queue</a>
            </Button>
            <Button variant="outline" onClick={() => setShowAiEditDialog(false)}>
              Close
            </Button>
            <Button onClick={handleAiEdit} disabled={submittingAiEdit || !selectedEditingType || !selectedFiles?.size}>
              {submittingAiEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Submit
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
