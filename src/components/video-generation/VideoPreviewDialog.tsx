import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface VideoPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string | null;
  title?: string;
}

export function VideoPreviewDialog({
  open,
  onOpenChange,
  videoUrl,
  title = 'Video Preview',
}: VideoPreviewDialogProps) {
  if (!videoUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="p-4 pt-2 space-y-3">
          <video
            src={videoUrl}
            controls
            autoPlay
            className="w-full aspect-video bg-black rounded-lg"
          />
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <a href={videoUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
