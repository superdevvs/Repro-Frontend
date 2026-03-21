import React, { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { useUpload } from '@/context/UploadContext';
import { UploadStatusDialog } from './UploadStatusDialog';

export const UploadStatusWidget: React.FC = () => {
  const { uploads, activeUploadCount } = useUpload();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Only show when there are uploads (active, completed, or failed)
  if (uploads.length === 0) return null;

  const hasActive = activeUploadCount > 0;
  const totalProgress = hasActive
    ? Math.round(
        uploads
          .filter(u => u.status === 'uploading')
          .reduce((sum, u) => sum + u.progress, 0) / activeUploadCount
      )
    : 100;

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="w-full flex-shrink-0 rounded-2xl border border-blue-200/80 dark:border-blue-800/40 bg-white dark:bg-card shadow-sm px-4 py-3 flex items-center gap-3 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-pointer"
      >
        <div className="relative flex items-center justify-center h-9 w-9 rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/30">
          {hasActive ? (
            <UploadCloud className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
          ) : (
            <span className="text-base font-bold text-blue-600 dark:text-blue-400">{uploads.length}</span>
          )}
        </div>
        <div className="flex-1 text-left">
          <span className="text-[11px] font-medium text-muted-foreground leading-tight block">
            {hasActive
              ? `${activeUploadCount} upload${activeUploadCount !== 1 ? 's' : ''} in progress`
              : `${uploads.length} upload${uploads.length !== 1 ? 's' : ''} completed`}
          </span>
          {hasActive && (
            <div className="mt-1 h-1.5 w-full bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
          )}
        </div>
      </button>

      <UploadStatusDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};
