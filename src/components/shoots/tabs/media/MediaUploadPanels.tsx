import React from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, ImageIcon, AlertTriangle, RefreshCcw } from 'lucide-react';

export interface UploadIssue {
  id: string;
  fileName: string;
  errorType: string;
  message: string;
  retryable: boolean;
  nextStep?: string | null;
}

interface UploadProgressCardProps {
  fileCount: number;
  fileNames: string[];
  progress: number;
  note: string;
}

export function UploadProgressCard({
  fileCount,
  fileNames,
  progress,
  note,
}: UploadProgressCardProps) {
  return (
    <div className="space-y-3 border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium">
          Uploading {fileCount} file{fileCount !== 1 ? 's' : ''}... {progress}%
        </span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="max-h-32 overflow-y-auto space-y-1">
        {fileNames.map((name, index) => {
          const filesDone = Math.floor((progress / 100) * fileCount);
          const isDone = index < filesDone;
          return (
            <div key={index} className="flex items-center gap-2 text-xs py-1">
              <div className="flex-shrink-0">
                {isDone ? (
                  <svg className="h-4 w-4 text-green-500" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                )}
              </div>
              <span className={`truncate flex-1 ${isDone ? 'text-muted-foreground' : ''}`}>{name}</span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

interface UploadDropzoneProps {
  empty: boolean;
  accept: string;
  inputId: string;
  title: string;
  description: string;
  buttonLabel: string;
  browseLabel: string;
  onBrowse: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function UploadDropzone({
  empty,
  accept,
  inputId,
  title,
  description,
  buttonLabel,
  browseLabel,
  onBrowse,
  onDrop,
  onDragOver,
  onFileSelect,
}: UploadDropzoneProps) {
  return empty ? (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-card flex-1 flex items-center justify-center min-h-[250px] shadow-sm"
    >
      <input
        type="file"
        multiple
        accept={accept}
        onChange={onFileSelect}
        className="hidden"
        id={inputId}
      />
      <label htmlFor={inputId} className="cursor-pointer flex flex-col items-center w-full">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <ImageIcon className="h-10 w-10 text-primary/60" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">{description}</p>
        <Button
          type="button"
          variant="default"
          size="lg"
          className="bg-primary hover:bg-primary/90"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBrowse();
          }}
        >
          <Upload className="h-4 w-4 mr-2" />
          {buttonLabel}
        </Button>
      </label>
    </div>
  ) : (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      className="border-2 border-dashed rounded-lg p-3 text-center hover:border-primary/50 transition-colors cursor-pointer"
    >
      <input
        type="file"
        multiple
        accept={accept}
        onChange={onFileSelect}
        className="hidden"
        id={inputId}
      />
      <label htmlFor={inputId} className="cursor-pointer flex items-center justify-center gap-2">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <div className="text-xs text-muted-foreground">{browseLabel}</div>
      </label>
    </div>
  );
}

interface UploadResultsPanelProps {
  title: string;
  issues: UploadIssue[];
  limitHint?: string;
  onRetryAll?: () => void;
  onRetryIssue?: (issueId: string) => void;
}

export function UploadResultsPanel({
  title,
  issues,
  limitHint,
  onRetryAll,
  onRetryIssue,
}: UploadResultsPanelProps) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-900">
            <AlertTriangle className="h-4 w-4" />
            <span>{title}</span>
          </div>
          <p className="text-xs text-rose-700">
            {issues.length} file{issues.length === 1 ? '' : 's'} need attention.
          </p>
          {limitHint && <p className="text-xs text-rose-700">{limitHint}</p>}
        </div>
        {onRetryAll && issues.some((issue) => issue.retryable) && (
          <Button type="button" size="sm" variant="outline" onClick={onRetryAll}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry Failed
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {issues.map((issue) => (
          <div key={issue.id} className="rounded-md border border-rose-200 bg-white p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{issue.fileName}</p>
                <p className="mt-1 text-sm text-slate-700">{issue.message}</p>
                {issue.nextStep && (
                  <p className="mt-1 text-xs text-slate-500">{issue.nextStep}</p>
                )}
              </div>
              {issue.retryable && onRetryIssue && (
                <Button type="button" size="sm" variant="ghost" onClick={() => onRetryIssue(issue.id)}>
                  Retry
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
