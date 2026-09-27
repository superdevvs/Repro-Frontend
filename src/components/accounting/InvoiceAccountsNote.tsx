import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  fetchInvoiceAccountsNote, saveInvoiceAccountsNote,
  type InvoiceAccountsNote as AccountsNote,
} from '@/services/invoiceAccountsNoteService';

export function InvoiceAccountsNote({ invoiceId }: { invoiceId: number }) {
  const [saved, setSaved] = useState<AccountsNote | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const request = useRef(0);

  useEffect(() => {
    const current = ++request.current;
    setLoading(true);
    setSaving(false);
    setSaved(null);
    setNote('');
    setError('');
    setMessage('');
    void fetchInvoiceAccountsNote(invoiceId).then((result) => {
      if (request.current !== current) return;
      setSaved(result);
      setNote(result.note);
    }).catch(() => {
      if (request.current === current) setError('Could not load the accounts note. Reopen this invoice to retry.');
    }).finally(() => {
      if (request.current === current) setLoading(false);
    });
    return () => { request.current += 1; };
  }, [invoiceId]);

  const save = async () => {
    const current = request.current;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await saveInvoiceAccountsNote(invoiceId, note);
      if (current !== request.current) return;
      setSaved(result);
      setNote(result.note);
      setMessage('Accounts note saved.');
    } catch {
      if (current === request.current) setError('Could not save the accounts note. Your changes are still here.');
    } finally {
      if (current === request.current) setSaving(false);
    }
  };

  return <section className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Label htmlFor={`accounts-note-${invoiceId}`} className="font-semibold">Private accounts note</Label>
      <span className="text-xs text-muted-foreground">Only accounts reviewers can see this</span>
    </div>
    <Textarea id={`accounts-note-${invoiceId}`} value={note} maxLength={5000} rows={3}
      disabled={loading || saving || !saved}
      onChange={(event) => { setNote(event.target.value); setMessage(''); }}
      placeholder={loading ? 'Loading accounts note…' : 'Add internal context for the accounts team'} />
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{saved?.updated_at ? `Saved by ${saved.author?.name || 'Accounts'} · ${new Date(saved.updated_at).toLocaleString()}` : `${note.length}/5,000 characters`}</span>
      <Button size="sm" variant="outline" disabled={loading || saving || !saved || note === saved.note} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save note'}
      </Button>
    </div>
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
  </section>;
}
