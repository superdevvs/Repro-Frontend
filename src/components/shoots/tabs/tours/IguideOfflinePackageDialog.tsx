import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, FileArchive, Loader2, UploadCloud, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { getApiHeaders } from '@/services/api';
import { API_ROUTES } from '@/lib/api';
import type { NormalizedIguideOfflinePackage } from '@/utils/shootTourData';
import {
  formatFileSize,
  IGUIDE_OFFLINE_PACKAGE_MAX_BYTES,
  parseIguideOfflinePackageResponse,
  validateIguideOfflineZip,
} from './iguideOfflinePackage';

interface IguideOfflinePackageDialogProps {
  currentPackage: NormalizedIguideOfflinePackage;
  onOpenChange: (open: boolean) => void;
  onUploaded: (offlinePackage: NormalizedIguideOfflinePackage) => void;
  open: boolean;
  shootId: number | string;
}

const getUploadError = (xhr: XMLHttpRequest) => {
  let message = xhr.status === 413
    ? 'The server rejected this ZIP because it is too large.'
    : `The iGUIDE package could not be uploaded (${xhr.status || 'network error'}).`;

  try {
    const payload = JSON.parse(xhr.responseText || '{}');
    message = payload.message || payload.error || message;
  } catch {
    // Keep the actionable status-based fallback when the server returns HTML/text.
  }

  return message;
};

export function IguideOfflinePackageDialog({
  currentPackage,
  onOpenChange,
  onUploaded,
  open,
  shootId,
}: IguideOfflinePackageDialogProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const mountedRef = useRef(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const replacing = currentPackage.exists;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      xhrRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (open || isUploading) return;
    setSelectedFile(null);
    setError('');
    setProgress(0);
    setIsDragging(false);
    if (inputRef.current) inputRef.current.value = '';
  }, [isUploading, open]);

  const chooseFile = (file?: File) => {
    if (!file || isUploading) return;
    const validationError = validateIguideOfflineZip(file);
    setSelectedFile(validationError ? null : file);
    setError(validationError || '');
    setProgress(0);
  };

  const cancelUpload = () => {
    xhrRef.current?.abort();
  };

  const startUpload = () => {
    if (!selectedFile || isUploading) return;
    const validationError = validateIguideOfflineZip(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setProgress(0);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('package', selectedFile);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.addEventListener('progress', (event) => {
      if (!mountedRef.current || !event.lengthComputable) return;
      setProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    });

    xhr.addEventListener('load', () => {
      if (!mountedRef.current) return;
      xhrRef.current = null;
      setIsUploading(false);

      if (xhr.status < 200 || xhr.status >= 300) {
        setError(getUploadError(xhr));
        return;
      }

      try {
        const payload = JSON.parse(xhr.responseText || '{}');
        const offlinePackage = parseIguideOfflinePackageResponse(payload, selectedFile);
        setProgress(100);
        onUploaded(offlinePackage);
        onOpenChange(false);
      } catch {
        setError('The upload finished, but its status response could not be read. Refresh and try again.');
      }
    });

    xhr.addEventListener('error', () => {
      if (!mountedRef.current) return;
      xhrRef.current = null;
      setIsUploading(false);
      setError('The connection was interrupted while uploading the ZIP. You can retry the same file.');
    });

    xhr.addEventListener('abort', () => {
      if (!mountedRef.current) return;
      xhrRef.current = null;
      setIsUploading(false);
      setProgress(0);
      setError('Upload cancelled.');
    });

    xhr.open('POST', API_ROUTES.integrations.iguide.offlinePackage(shootId));
    Object.entries(getApiHeaders()).forEach(([name, value]) => {
      if (name.toLowerCase() !== 'content-type') xhr.setRequestHeader(name, value);
    });
    xhr.send(formData);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isUploading && !nextOpen) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg" data-testid="iguide-offline-package-dialog">
        <DialogHeader>
          <DialogTitle>{replacing ? 'Replace iGUIDE ZIP' : 'Upload iGUIDE ZIP'}</DialogTitle>
          <DialogDescription>
            Upload the offline package exported by iGUIDE. The package is scanned before it becomes ready.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {replacing && (
            <Alert className="border-amber-500/40 bg-amber-500/5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs">
                This explicitly replaces the current package after the new ZIP passes validation.
              </AlertDescription>
            </Alert>
          )}

          <label
            htmlFor={inputId}
            className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60 hover:bg-muted/30'
            } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              chooseFile(event.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed,application/octet-stream"
              className="sr-only"
              disabled={isUploading}
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            {selectedFile ? (
              <>
                <FileArchive className="mb-2 h-7 w-7 text-primary" />
                <span className="max-w-full truncate text-sm font-medium">{selectedFile.name}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</span>
              </>
            ) : (
              <>
                <UploadCloud className="mb-2 h-7 w-7 text-muted-foreground" />
                <span className="text-sm font-medium">Drop the ZIP here or browse</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  One .zip file, up to {formatFileSize(IGUIDE_OFFLINE_PACKAGE_MAX_BYTES)}
                </span>
              </>
            )}
          </label>

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

          {isUploading && (
            <div className="space-y-1.5" aria-live="polite">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Uploading package</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {isUploading ? (
            <Button type="button" variant="outline" onClick={cancelUpload}>
              <X className="mr-1.5 h-4 w-4" />
              Cancel upload
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          <Button type="button" onClick={startUpload} disabled={!selectedFile || isUploading}>
            {isUploading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-1.5 h-4 w-4" />
            )}
            {replacing ? 'Replace package' : 'Upload package'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
