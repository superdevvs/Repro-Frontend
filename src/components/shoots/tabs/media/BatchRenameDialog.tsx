import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MediaFile } from '@/hooks/useShootFiles';
import { MEDIA_BATCH_RENAME_API_ENABLED } from '@/features/media-filename-rename/featureFlag';
import { previewBatchRenameFilenames } from '@/features/media-filename-rename/batchRenamePreview';
import type { BatchRenameMode } from '@/services/shootMediaService';
import { getDisplayMediaFilename } from './mediaPreviewUtils';

export interface BatchRenameSubmitPayload {
  mode: BatchRenameMode;
  value?: string;
  find?: string;
  replace?: string;
  start?: number;
  digits?: number;
  separator?: string;
  number_action?: 'remove' | 'move' | 'renumber';
  number_position?: 'start' | 'end';
}

interface BatchRenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFiles: MediaFile[];
  onSubmit: (payload: BatchRenameSubmitPayload) => Promise<void> | void;
  apiEnabled?: boolean;
}

export function BatchRenameDialog({
  open,
  onOpenChange,
  selectedFiles,
  onSubmit,
  apiEnabled = MEDIA_BATCH_RENAME_API_ENABLED,
}: BatchRenameDialogProps) {
  const [mode, setMode] = useState<BatchRenameMode>('prefix');
  const [value, setValue] = useState('');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [start, setStart] = useState('1');
  const [digits, setDigits] = useState('2');
  const [separator, setSeparator] = useState('-');
  const [numberAction, setNumberAction] = useState<'remove' | 'move' | 'renumber'>('remove');
  const [numberPosition, setNumberPosition] = useState<'start' | 'end'>('end');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentNames = useMemo(
    () => selectedFiles.map((file) => getDisplayMediaFilename(file) || file.filename),
    [selectedFiles],
  );

  const previewNames = useMemo(
    () =>
      previewBatchRenameFilenames(currentNames, {
        mode,
        value,
        find,
        replace,
        start: Number(start),
        digits: Number(digits) || 2,
        separator,
        number_action: numberAction,
        number_position: numberPosition,
      }),
    [currentNames, digits, find, mode, numberAction, numberPosition, replace, separator, start, value],
  );

  const canSubmit =
    apiEnabled &&
    selectedFiles.length > 0 &&
    !submitting &&
    (mode !== 'replace' || Boolean(find.trim())) &&
    (!['prefix', 'suffix'].includes(mode) || Boolean(value.trim())) &&
    (!(mode === 'sequence' || (mode === 'numbering' && numberAction === 'renumber')) ||
      (Number.isInteger(Number(start)) && Number(start) >= 0 && Number.isInteger(Number(digits)) && Number(digits) >= 1 && Number(digits) <= 10)) &&
    previewNames.every((name) => Boolean(name) && new TextEncoder().encode(name).length <= 255);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        mode,
        value: value || undefined,
        find: mode === 'replace' ? find : undefined,
        replace: mode === 'replace' ? replace : undefined,
        start: mode === 'sequence' || mode === 'numbering' ? Number(start) : undefined,
        digits: mode === 'sequence' || mode === 'numbering' ? Number(digits) : undefined,
        separator: mode === 'sequence' || mode === 'numbering' ? separator : undefined,
        number_action: mode === 'numbering' ? numberAction : undefined,
        number_position: mode === 'numbering' ? numberPosition : undefined,
      });
      onOpenChange(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to rename selected files. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] min-w-0 max-w-xl flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="min-w-0 shrink-0 pr-6 text-left">
          <DialogTitle>Batch rename ({selectedFiles.length})</DialogTitle>
          <DialogDescription>
            {apiEnabled
              ? 'Apply a shared rename pattern to the selected files. Extensions are preserved. Unsupported characters are removed automatically.'
              : 'Batch rename will unlock after the server update is live. You can still preview patterns now.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="batch-rename-mode">Mode</Label>
            <Select value={mode} onValueChange={(next) => setMode(next as BatchRenameMode)}>
              <SelectTrigger id="batch-rename-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prefix">Prefix</SelectItem>
                <SelectItem value="suffix">Suffix</SelectItem>
                <SelectItem value="replace">Find & replace</SelectItem>
                <SelectItem value="sequence">Sequence</SelectItem>
                <SelectItem value="numbering">Edit numbering</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'numbering' && (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="batch-number-action">Numbering action</Label>
                <Select value={numberAction} onValueChange={(next) => setNumberAction(next as typeof numberAction)}>
                  <SelectTrigger id="batch-number-action"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remove">Remove existing numbers</SelectItem>
                    <SelectItem value="move">Move existing numbers</SelectItem>
                    <SelectItem value="renumber">Replace with a new sequence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {numberAction !== 'remove' && (
                <div className="space-y-1.5">
                  <Label htmlFor="batch-number-position">Number position</Label>
                  <Select value={numberPosition} onValueChange={(next) => setNumberPosition(next as typeof numberPosition)}>
                    <SelectTrigger id="batch-number-position"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="start">Before the filename</SelectItem>
                      <SelectItem value="end">After the filename</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">Recognizes separate numbers such as 014_Name or Name-014. Address numbers and camera IDs are preserved.</p>
            </div>
          )}

          {(mode === 'prefix' || mode === 'suffix' || mode === 'sequence' || (mode === 'numbering' && numberAction === 'renumber')) && (
            <div className="space-y-1.5">
              <Label htmlFor="batch-rename-value">{mode === 'sequence' || mode === 'numbering' ? 'Filename (optional)' : 'Value'}</Label>
              <Input
                id="batch-rename-value"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={mode === 'prefix' ? 'Kitchen-' : mode === 'suffix' ? '-final' : 'Kitchen'}
              />
            </div>
          )}

          {mode === 'replace' && (
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 [&>div]:min-w-0">
              <div className="space-y-1.5">
                <Label htmlFor="batch-rename-find">Find</Label>
                <Input id="batch-rename-find" value={find} onChange={(event) => setFind(event.target.value)} placeholder="IMG_" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batch-rename-replace">Replace</Label>
                <Input id="batch-rename-replace" value={replace} onChange={(event) => setReplace(event.target.value)} placeholder="Room-" />
              </div>
            </div>
          )}

          {(mode === 'sequence' || (mode === 'numbering' && numberAction !== 'remove')) && (
            <div className="grid min-w-0 grid-cols-3 gap-2 [&>div]:min-w-0">
              {numberAction !== 'move' || mode === 'sequence' ? <><div className="space-y-1.5">
                <Label htmlFor="batch-rename-start">Start</Label>
                <Input id="batch-rename-start" value={start} onChange={(event) => setStart(event.target.value)} inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batch-rename-digits">Digits</Label>
                <Input id="batch-rename-digits" value={digits} onChange={(event) => setDigits(event.target.value)} inputMode="numeric" />
              </div></> : null}
              <div className="space-y-1.5">
                <Label htmlFor="batch-rename-separator">Separator</Label>
                <Input id="batch-rename-separator" value={separator} onChange={(event) => setSeparator(event.target.value)} />
              </div>
            </div>
          )}

          <div className="min-w-0 rounded-xl border bg-muted/30 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Preview (first {Math.min(5, previewNames.length)})</p>
            <ul className="max-h-52 min-w-0 space-y-2 overflow-y-auto text-xs">
              {previewNames.slice(0, 5).map((name, index) => (
                <li key={`${currentNames[index]}-${index}`} className="min-w-0 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <span className="block truncate text-muted-foreground" title={currentNames[index]}>{currentNames[index]}</span>
                  <span className="mt-1 flex min-w-0 gap-2"><span aria-hidden="true">→</span><span className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">{name || 'Enter a valid filename'}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {error && <p role="alert" className="break-words text-xs text-destructive">{error}</p>}

        <DialogFooter className="shrink-0 gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => { void handleSubmit(); }} disabled={!canSubmit} title={apiEnabled ? 'Apply rename' : 'Batch rename is not live yet'}>
            {submitting ? 'Renaming…' : apiEnabled ? 'Rename selected' : 'Not available yet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
