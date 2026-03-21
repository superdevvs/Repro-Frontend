import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useUpload, ShootUpload } from '@/context/UploadContext';
import { X, MapPin, CheckCircle, AlertCircle, UploadCloud, FileIcon } from 'lucide-react';

interface UploadStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UploadStatusDialog: React.FC<UploadStatusDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { uploads, cancelUpload, dismissUpload, clearCompleted } = useUpload();

  const hasCompleted = uploads.some(u => u.status !== 'uploading');

  const statusBadge = (upload: ShootUpload) => {
    switch (upload.status) {
      case 'uploading':
        return (
          <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400 gap-1">
            <UploadCloud className="h-3 w-3 animate-pulse" />
            {upload.progress}%
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="text-[10px] border-green-200 text-green-600 dark:border-green-800 dark:text-green-400 gap-1">
            <CheckCircle className="h-3 w-3" />
            Done
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="text-[10px] border-red-200 text-red-600 dark:border-red-800 dark:text-red-400 gap-1">
            <AlertCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Upload Status
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6" style={{ scrollbarWidth: 'thin' }}>
          {uploads.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              No uploads
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="rounded-xl border border-border bg-muted/20 p-3 space-y-2"
                >
                  {/* Address + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                      <span className="text-sm font-medium text-foreground leading-tight truncate">
                        {upload.shootAddress || `Shoot #${upload.shootId}`}
                      </span>
                    </div>
                    {statusBadge(upload)}
                  </div>

                  {/* File info */}
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <FileIcon className="h-3 w-3" strokeWidth={1.5} />
                    <span>{upload.fileCount} file{upload.fileCount !== 1 ? 's' : ''}</span>
                    <span className="text-muted-foreground/50">|</span>
                    <span className="capitalize">{upload.uploadType}</span>
                  </div>

                  {/* Progress bar for active uploads */}
                  {upload.status === 'uploading' && (
                    <Progress value={upload.progress} className="h-1.5" />
                  )}

                  {/* Error message */}
                  {upload.status === 'failed' && upload.error && (
                    <p className="text-[11px] text-red-500 dark:text-red-400">{upload.error}</p>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-2">
                    {upload.status === 'uploading' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px] text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => cancelUpload(upload.id)}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    )}
                    {upload.status !== 'uploading' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => dismissUpload(upload.id)}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Dismiss
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasCompleted && (
          <div className="flex justify-end pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={clearCompleted}
            >
              Clear completed
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
