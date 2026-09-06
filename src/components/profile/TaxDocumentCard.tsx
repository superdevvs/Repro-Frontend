import React, { useEffect, useState } from 'react';
import { FileText, Upload, Download } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { downloadTaxDocument, readTaxDocument, uploadTaxDocument, validateTaxDocument, type TaxDocumentSummary } from '@/services/taxDocuments';

export function TaxDocumentCard() {
  const { user, isImpersonating } = useAuth();
  const [summary, setSummary] = useState<TaxDocumentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setSummary(null);
    setError(null);
    setOpen(false);
    setLoading(true);
    if (!user?.id || isImpersonating) { setLoading(false); return; }
    readTaxDocument(controller.signal).then((value) => {
      if (!controller.signal.aborted) setSummary(value);
    }).catch(() => {
      if (!controller.signal.aborted) setError('Your tax document status could not be loaded. Refresh and try again.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [user?.id, isImpersonating]);

  if (isImpersonating) {
    return <p className="text-sm text-muted-foreground">Tax documents are unavailable while impersonating another account.</p>;
  }

  const submit = async () => {
    const validation = validateTaxDocument(file);
    if (validation) { setError(validation); return; }
    if (busy || !file) return;
    setBusy(true);
    setError(null);
    try {
      setSummary(await uploadTaxDocument(file, notes));
      setOpen(false);
      setFile(null);
      setNotes('');
    } catch {
      setError('We could not confirm your upload. Refresh to check your current submission, or contact an administrator.');
    } finally { setBusy(false); }
  };

  const download = async () => {
    if (!summary || downloading) return;
    setDownloading(true);
    setError(null);
    try { await downloadTaxDocument(summary.original_name); }
    catch { setError('Your document could not be downloaded. Refresh and try again.'); }
    finally { setDownloading(false); }
  };

  return <>
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-medium"><FileText className="h-4 w-4" />Tax / License Document</p>
          <p className="text-sm text-muted-foreground">W-9, business license, or equivalent documentation</p>
          {summary && <p className="text-xs text-muted-foreground">{summary.original_name} · Submitted {new Date(summary.submitted_at).toLocaleDateString()}</p>}
          <p className="text-xs text-muted-foreground">Available to you and authorized administrators.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={summary ? 'outline' : 'secondary'}>{loading ? 'Loading…' : summary ? 'Submitted' : error ? 'Unavailable' : 'Required'}</Badge>
          {summary?.can_download && <Button type="button" size="sm" variant="outline" onClick={download} disabled={downloading}><Download className="mr-1 h-3.5 w-3.5" />{downloading ? 'Downloading…' : 'Download'}</Button>}
          <Button type="button" size="sm" variant={summary ? 'outline' : 'default'} disabled={loading || !user?.id} onClick={() => { setError(null); setFile(null); setNotes(''); setOpen(true); }}><Upload className="mr-1 h-3.5 w-3.5" />{summary ? 'Update' : 'Upload'}</Button>
        </div>
      </div>
      {!open && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {summary && !summary.can_download && <p className="text-sm text-muted-foreground">Your submitted file is unavailable. Contact an administrator.</p>}
    </div>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Upload Tax / License Document</DialogTitle><DialogDescription>PDF, PNG or JPG up to 10 MB. Uploading a new document replaces your previous submission.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="tax-doc-file">Document</Label><Input id="tax-doc-file" type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
          <div className="space-y-2"><Label htmlFor="tax-doc-notes">Notes (optional)</Label><Textarea id="tax-doc-notes" value={notes} maxLength={1000} disabled={busy} onChange={(event) => setNotes(event.target.value)} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button type="button" disabled={busy || !file} onClick={submit}>{busy ? 'Uploading…' : 'Upload Document'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
