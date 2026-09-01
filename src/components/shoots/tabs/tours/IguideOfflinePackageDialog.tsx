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
import type { NormalizedIguideOfflinePackage } from '@/utils/shootTourData';
import {
  formatFileSize,
  IGUIDE_OFFLINE_PACKAGE_MAX_BYTES,
  validateIguideOfflineZip,
} from './iguideOfflinePackage';
import {
  discardIguideUploadSession,
  getPersistedIguideUpload,
  IguideResumableUploadError,
  IguideUploadPausedError,
  type IguideResumableUploadPhase,
  type IguideResumableUploadProgress,
  uploadIguideOfflinePackageResumable,
} from './iguideResumableUpload';

interface IguideOfflinePackageDialogProps {
  currentPackage: NormalizedIguideOfflinePackage;
  onOpenChange: (open: boolean) => void;
  onUploaded: (offlinePackage: NormalizedIguideOfflinePackage) => void;
  open: boolean;
  shootId: number | string;
}

type DialogUploadPhase = IguideResumableUploadPhase | 'discarding' | 'error' | 'idle' | 'paused';

const EMPTY_PROGRESS: IguideResumableUploadProgress = {
  bytesConfirmed: 0,
  bytesTransferred: 0,
  chunkIndex: null,
  percent: 0,
  phase: 'preparing',
  totalBytes: 0,
  totalChunks: 0,
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const operationRef = useRef(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [conflictSessionId, setConflictSessionId] = useState('');
  const [error, setError] = useState('');
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<DialogUploadPhase>('idle');
  const [progress, setProgress] = useState<IguideResumableUploadProgress>(EMPTY_PROGRESS);
  const replacing = currentPackage.exists;
  const isBusy = phase === 'preparing' || phase === 'uploading' || phase === 'finalizing';
  const hasRecoverableSession = hasSavedSession || Boolean(conflictSessionId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!open) setIsDragging(false);
  }, [open]);

  const chooseFile = (file?: File) => {
    if (!file || isBusy) return;
    const validationError = validateIguideOfflineZip(file);
    setSelectedFile(validationError ? null : file);
    setConflictSessionId('');
    setError(validationError || '');
    setProgress({ ...EMPTY_PROGRESS, totalBytes: file.size });
    const saved = validationError ? null : getPersistedIguideUpload(shootId, file);
    setHasSavedSession(Boolean(saved?.sessionId));
    setPhase(saved?.sessionId ? 'paused' : 'idle');
  };

  const pauseUpload = () => {
    abortControllerRef.current?.abort();
    setPhase('paused');
    setError('');
  };

  const startUpload = async () => {
    if (!selectedFile || isBusy || phase === 'discarding' || conflictSessionId) return;
    const validationError = validateIguideOfflineZip(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    const operation = operationRef.current + 1;
    operationRef.current = operation;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setError('');
    setPhase('preparing');

    try {
      const offlinePackage = await uploadIguideOfflinePackageResumable({
        file: selectedFile,
        shootId,
        signal: controller.signal,
        onProgress: (nextProgress) => {
          if (!mountedRef.current || operationRef.current !== operation) return;
          setProgress(nextProgress);
          setPhase(nextProgress.phase);
          setHasSavedSession(Boolean(getPersistedIguideUpload(shootId, selectedFile)?.sessionId));
        },
      });
      if (!mountedRef.current || operationRef.current !== operation) return;
      setProgress((current) => ({ ...current, percent: 100 }));
      setConflictSessionId('');
      setHasSavedSession(false);
      setPhase('idle');
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded(offlinePackage);
      onOpenChange(false);
    } catch (uploadError) {
      if (!mountedRef.current || operationRef.current !== operation) return;
      const saved = Boolean(getPersistedIguideUpload(shootId, selectedFile)?.sessionId);
      setHasSavedSession(saved);
      if (uploadError instanceof IguideUploadPausedError) {
        setPhase('paused');
        setError('');
      } else {
        setConflictSessionId(uploadError instanceof IguideResumableUploadError
          ? uploadError.sessionId
          : '');
        setPhase('error');
        setError(uploadError instanceof Error
          ? uploadError.message
          : 'The iGUIDE package could not be uploaded.');
      }
    } finally {
      if (operationRef.current === operation) abortControllerRef.current = null;
    }
  };

  const discardUpload = async () => {
    if (!selectedFile || isBusy || phase === 'discarding' || !hasRecoverableSession) return;
    operationRef.current += 1;
    abortControllerRef.current?.abort();
    setPhase('discarding');
    setError('');
    try {
      await discardIguideUploadSession({
        file: selectedFile,
        shootId,
        ...(conflictSessionId ? { sessionId: conflictSessionId } : {}),
      });
      if (!mountedRef.current) return;
      setConflictSessionId('');
      setHasSavedSession(false);
      setProgress({ ...EMPTY_PROGRESS, totalBytes: selectedFile.size });
      setPhase('idle');
    } catch (discardError) {
      if (!mountedRef.current) return;
      setHasSavedSession(Boolean(getPersistedIguideUpload(shootId, selectedFile)?.sessionId));
      setPhase('error');
      setError(discardError instanceof Error
        ? discardError.message
        : 'The saved upload could not be discarded.');
    }
  };

  const phaseLabel = phase === 'preparing'
    ? 'Preparing secure upload'
    : phase === 'uploading'
      ? progress.chunkIndex === null
        ? 'Uploading package'
        : `Uploading chunk ${progress.chunkIndex + 1} of ${progress.totalChunks}`
      : phase === 'finalizing'
        ? 'Finalizing and validating package'
        : phase === 'paused'
          ? 'Upload paused — progress saved'
          : phase === 'discarding'
            ? 'Discarding saved upload'
            : conflictSessionId
              ? 'Existing upload must be discarded'
              : hasSavedSession
              ? 'Ready to resume'
              : 'Ready to upload';

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isBusy && !nextOpen) pauseUpload();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg" data-testid="iguide-offline-package-dialog">
        <DialogHeader>
          <DialogTitle>{replacing ? 'Replace iGUIDE ZIP' : 'Upload iGUIDE ZIP'}</DialogTitle>
          <DialogDescription>
            Upload the offline package exported by iGUIDE. The package is scanned before it becomes ready.
            {' '}Once ready, it is used on delivered branded and MLS tours, so upload an MLS-safe, unbranded export.
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
            } ${isBusy || hasRecoverableSession ? 'pointer-events-none opacity-60' : ''}`}
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
              disabled={isBusy || hasRecoverableSession}
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

          {selectedFile && phase !== 'idle' && phase !== 'discarding' && (
            <div className="space-y-1.5" aria-live="polite">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{phaseLabel}</span>
                <span className="font-medium">{progress.percent}%</span>
              </div>
              <Progress value={progress.percent} className="h-1.5" />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isBusy ? (
            <Button type="button" variant="outline" onClick={pauseUpload}>
              <X className="mr-1.5 h-4 w-4" />
              Pause upload
            </Button>
          ) : (
            <>
              {hasRecoverableSession && (
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void discardUpload()} disabled={phase === 'discarding'}>
                  {phase === 'discarding' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  {conflictSessionId ? 'Discard existing upload' : 'Discard upload'}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </>
          )}
          <Button type="button" onClick={() => void startUpload()} disabled={!selectedFile || isBusy || phase === 'discarding' || Boolean(conflictSessionId)}>
            {isBusy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-1.5 h-4 w-4" />
            )}
            {isBusy
              ? phase === 'finalizing' ? 'Finalizing…' : 'Uploading…'
              : conflictSessionId
                ? replacing ? 'Replace package' : 'Upload package'
                : hasSavedSession ? 'Resume upload' : replacing ? 'Replace package' : 'Upload package'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
