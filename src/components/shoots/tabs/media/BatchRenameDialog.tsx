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
  const [submitting, setSubmitting] = useState(false);

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
        start: Number(start) || 1,
        digits: Number(digits) || 2,
        separator,
      }),
    [currentNames, digits, find, mode, replace, separator, start, value],
  );

  const canSubmit =
    apiEnabled &&
    selectedFiles.length > 0 &&
    !submitting &&
    (mode !== 'replace' || Boolean(find.trim()));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        mode,
        value: value || undefined,
        find: mode === 'replace' ? find : undefined,
        replace: mode === 'replace' ? replace : undefined,
        start: mode === 'sequence' ? Number(start) || 1 : undefined,
        digits: mode === 'sequence' ? Number(digits) || 2 : undefined,
        separator: mode === 'sequence' ? separator : undefined,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Batch rename ({selectedFiles.length})</DialogTitle>
          <DialogDescription>
            {apiEnabled
              ? 'Apply a shared rename pattern to the selected files. Extensions are preserved.'
              : 'Batch rename will unlock after the server update is live. You can still preview patterns now.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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
              </SelectContent>
            </Select>
          </div>

          {(mode === 'prefix' || mode === 'suffix' || mode === 'sequence') && (
            <div className="space-y-1.5">
              <Label htmlFor="batch-rename-value">{mode === 'sequence' ? 'Stem (optional)' : 'Value'}</Label>
              <Input
                id="batch-rename-value"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={mode === 'prefix' ? 'Kitchen-' : mode === 'suffix' ? '-final' : 'Kitchen'}
              />
            </div>
          )}

          {mode === 'replace' && (
            <div className="grid grid-cols-2 gap-2">
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

          {mode === 'sequence' && (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="batch-rename-start">Start</Label>
                <Input id="batch-rename-start" value={start} onChange={(event) => setStart(event.target.value)} inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batch-rename-digits">Digits</Label>
                <Input id="batch-rename-digits" value={digits} onChange={(event) => setDigits(event.target.value)} inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batch-rename-separator">Separator</Label>
                <Input id="batch-rename-separator" value={separator} onChange={(event) => setSeparator(event.target.value)} />
              </div>
            </div>
          )}

          <div className="rounded-md border bg-muted/40 p-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Preview (first {Math.min(5, previewNames.length)})</p>
            <ul className="max-h-36 space-y-1 overflow-auto text-xs">
              {previewNames.slice(0, 5).map((name, index) => (
                <li key={`${currentNames[index]}-${index}`} className="truncate">
                  <span className="text-muted-foreground">{currentNames[index]}</span>
                  <span className="mx-1">→</span>
                  <span className="font-medium">{name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
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
