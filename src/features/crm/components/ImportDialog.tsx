import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { crmApi } from '../api';
import { useCrmMeta, useCrmMutation } from '../hooks';
import { Field, Select } from '../ui/fields';
import { Chip, Note } from '../ui/primitives';

interface PreviewRow { row: number; data: Record<string, string | null>; status: 'ready' | 'duplicate' | 'name_match' | 'invalid'; reason: string | null; match: { type: string; contact?: { name: string; stage_label: string; assigned_rep: { name: string } | null } | null } | null }
interface Preview { headers: string[]; mapping: Record<string, number | null>; fields: string[]; counts: Record<'total' | 'ready' | 'duplicate' | 'name_match' | 'invalid', number>; rows: PreviewRow[]; assign_locked: boolean }

const FIELD_LABELS: Record<string, string> = { name: 'Name', company: 'Company', title: 'Title', email: 'Email', phone: 'Phone', address: 'Address', website: 'Website', market_state: 'State', market_city: 'City', segment: 'Segment', lead_source: 'Lead source' };
const STATUS: Record<PreviewRow['status'], [string, 'green' | 'red' | 'amber' | 'line']> = { ready: ['Ready', 'green'], duplicate: ['Duplicate', 'red'], name_match: ['Same name', 'amber'], invalid: ['Fix needed', 'line'] };

/** CSV import (frame 17): upload, match columns, review duplicates, import. Duplicates are never imported. */
export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: meta } = useCrmMeta();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Record<string, number | null> | null>(null);
  const [segment, setSegment] = useState('');
  const [source, setSource] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [allowName, setAllowName] = useState<number[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  useEffect(() => {
    if (open) { setCsv(''); setFileName(''); setMapping(null); setPreview(null); setResult(null); setAllowName([]); setSegment(''); setSource(''); setAssignTo(''); }
  }, [open]);

  const body = (m = mapping) => ({ csv, mapping: m ?? undefined, default_segment: segment || undefined, lead_source: source || undefined, allow_name_rows: allowName, assign_to: assignTo ? Number(assignTo) : undefined });
  const runPreview = useCrmMutation((m: Record<string, number | null> | null) => crmApi.post<Preview>('/imports/preview', body(m)), { invalidate: [] });
  const commit = useCrmMutation(() => crmApi.post<{ created: number; skipped: number }>('/imports/commit', body()), { success: (r) => `${r.created} contacts imported` });

  const load = async (file: File) => {
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setMapping(null);
    runPreview.mutate(null, { onSuccess: (p) => { setPreview(p); setMapping(p.mapping); } });
  };
  const remap = (field: string, value: string) => {
    const next = { ...(mapping ?? {}), [field]: value === '' ? null : Number(value) };
    setMapping(next);
    runPreview.mutate(next, { onSuccess: setPreview });
  };
  const refresh = () => runPreview.mutate(mapping, { onSuccess: setPreview });

  const step = result ? 3 : preview ? 2 : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="crm-root max-h-[92dvh] overflow-y-auto sm:max-w-[880px]">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            <span className={cn(step === 1 && 'font-semibold text-foreground')}>1 Upload</span> · <span className={cn(step === 2 && 'font-semibold text-foreground')}>2 Match and review</span> · <span className={cn(step === 3 && 'font-semibold text-foreground')}>3 Done</span>
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center hover:bg-secondary/50">
            <FileUp className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">{runPreview.isPending ? 'Reading…' : 'Choose a CSV file'}</span>
            <span className="text-xs text-muted-foreground">Up to 5 MB. The first row should be the column names.</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} />
          </label>
        )}

        {step === 2 && preview && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">{fileName} · {preview.counts.total} rows</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {preview.fields.map((f) => (
                <Field key={f} label={FIELD_LABELS[f] ?? f}>{(id) => (
                  <Select id={id} value={mapping?.[f] === null || mapping?.[f] === undefined ? '' : String(mapping[f])} onChange={(e) => remap(f, e.target.value)} placeholder="— not in file —"
                    options={preview.headers.map((h, i) => ({ value: String(i), label: h || `Column ${i + 1}` }))} />
                )}</Field>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Segment when empty">{(id) => <Select id={id} value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Leave empty (row needs one)" options={(meta?.segments ?? []).map((s) => ({ value: s.key, label: s.label }))} />}</Field>
              <Field label="Lead source">{(id) => <Select id={id} value={source} onChange={(e) => setSource(e.target.value)} placeholder="From the file / Other" options={(meta?.lead_sources ?? []).map((s) => ({ value: s.key, label: s.label }))} />}</Field>
              <Field label="Assign to" hint={preview.assign_locked ? 'Imported contacts are yours.' : undefined}>{(id, d) => preview.assign_locked
                ? <Select id={id} aria-describedby={d} disabled value="" options={[]} placeholder={meta?.me.name ?? 'Me'} />
                : <Select id={id} value={assignTo} onChange={(e) => setAssignTo(e.target.value)} placeholder="Unassigned queue" options={(meta?.reps ?? []).map((r) => ({ value: String(r.id), label: r.name }))} />}
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Chip tone="green">{preview.counts.ready} ready</Chip>
              {preview.counts.duplicate > 0 && <Chip tone="red">{preview.counts.duplicate} duplicates (skipped)</Chip>}
              {preview.counts.name_match > 0 && <Chip tone="amber">{preview.counts.name_match} same name</Chip>}
              {preview.counts.invalid > 0 && <Chip tone="line">{preview.counts.invalid} need fixing</Chip>}
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={refresh} disabled={runPreview.isPending}>Recheck</Button>
            </div>
            <div className="max-h-[320px] overflow-auto rounded-[10px] border">
              <table className="crm-table text-[12.5px]">
                <thead><tr><th>Row</th><th>Name</th><th>Company</th><th>Email</th><th>Segment</th><th>Status</th></tr></thead>
                <tbody>
                  {preview.rows.slice(0, 200).map((r) => (
                    <tr key={r.row}>
                      <td className="text-muted-foreground tabular-nums">{r.row}</td>
                      <td className="font-medium">{r.data.name ?? '—'}</td>
                      <td>{r.data.company ?? '—'}</td>
                      <td>{r.data.email ?? '—'}</td>
                      <td>{r.data.segment ?? '—'}</td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Chip tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Chip>
                          {r.reason && <span className="text-muted-foreground">{r.reason}{r.match?.contact ? ` · ${r.match.contact.name} (${r.match.contact.assigned_rep?.name ?? 'Unassigned'})` : ''}</span>}
                          {r.status === 'name_match' && meta?.can.assign && (
                            <label className="flex items-center gap-1"><input type="checkbox" checked={allowName.includes(r.row)} onChange={(e) => setAllowName(e.target.checked ? [...allowName, r.row] : allowName.filter((n) => n !== r.row))} />Different person</label>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > 200 && <p className="text-xs text-muted-foreground">Showing the first 200 rows.</p>}
          </div>
        )}

        {step === 3 && result && (
          <Note tone="ok" icon={<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}>
            <p className="font-medium">{result.created} contacts imported.</p>
            {result.skipped > 0 && <p>{result.skipped} rows were skipped (duplicates or rows that need fixing).</p>}
          </Note>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{step === 3 ? 'Close' : 'Cancel'}</Button>
          {step === 2 && preview && (
            <Button disabled={commit.isPending || preview.counts.ready === 0} onClick={() => commit.mutate(undefined, { onSuccess: setResult })}>
              {commit.isPending ? 'Importing…' : `Import ${preview.counts.ready} contacts`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
