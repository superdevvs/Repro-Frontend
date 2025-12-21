import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, CheckCircle, Loader2 } from 'lucide-react';

interface MediaUploadProgressProps {
  isUploading: boolean;
  progress: number;
  uploadedCount: number;
  totalCount: number;
  currentFileName?: string;
}

export const MediaUploadProgress: React.FC<MediaUploadProgressProps> = ({
  isUploading,
  progress,
  uploadedCount,
  totalCount,
  currentFileName,
}) => {
  if (!isUploading && uploadedCount === 0) {
    return null;
  }

  const isComplete = uploadedCount === totalCount && !isUploading;

  return (
    <Card className={isComplete ? 'border-green-500 bg-green-50' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            {isComplete ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : isUploading ? (
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {isComplete ? (
                  'Upload Complete'
                ) : isUploading ? (
                  'Uploading Photos...'
                ) : (
                  'Upload Paused'
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {uploadedCount} / {totalCount} files
              </div>
            </div>

            <Progress value={progress} className="h-2" />

            {currentFileName && isUploading && (
              <div className="text-xs text-muted-foreground truncate">
                Uploading: {currentFileName}
              </div>
            )}

            {isComplete && (
              <div className="text-xs text-green-700">
                All {totalCount} files uploaded successfully
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

