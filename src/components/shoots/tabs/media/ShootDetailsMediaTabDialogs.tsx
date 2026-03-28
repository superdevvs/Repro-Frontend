/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShootIssueManager } from '../ShootIssueManager';
import { MediaViewer } from './MediaViewer';
import { Loader2, Sparkles } from 'lucide-react';

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
        getSrcSet={getSrcSet}
        shoot={shoot}
        isAdmin={isAdmin}
        isClient={isClient}
        onShootUpdate={onShootUpdate}
        canInteractSingleMedia={canInteractSingleMedia}
        onToggleFavorite={onToggleFavorite}
        onAddComment={onAddComment}
        onToggleHidden={onToggleHidden}
        onDownloadSingle={onDownloadSingle}
      />

      {/* AI Edit Dialog */}
      <Dialog open={showAiEditDialog} onOpenChange={setShowAiEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Edit Images</DialogTitle>
            <DialogDescription>
              Select an editing type to apply to {selectedFiles.size} selected image(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Editing Type</Label>
              <Select
                value={selectedEditingType}
                onValueChange={setSelectedEditingType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select editing type" />
                </SelectTrigger>
                <SelectContent>
                  {editingTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingTypes.find(t => t.id === selectedEditingType) && (
                <p className="text-sm text-muted-foreground">
                  {editingTypes.find(t => t.id === selectedEditingType)?.description}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAiEditDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAiEdit}
                disabled={submittingAiEdit || !selectedEditingType}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {submittingAiEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Submit
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Manager Modal - for creating requests with selected photos */}
      <ShootIssueManager
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
