import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ShootData, ShootFileData } from '@/types/shoots';

type SourceRecord = {
  scheduled_date?: string;
  completed_date?: string;
  source_record?: Record<string, string>;
  links?: Array<{ text?: string; url?: string }>;
};

const safeUrl = (value?: string) => value && /^https?:\/\//i.test(value) ? value : undefined;
const fileUrl = (file: ShootFileData) => safeUrl(file.url || file.original_url || file.original);

/** Historical facts are shown verbatim, without creating live billing/workflow actions. */
export function PrivateImportReview({ shoot, isOpen, onClose, onCloseAutoFocus }: { shoot: ShootData; isOpen: boolean; onClose: () => void; onCloseAutoFocus?: (event: Event) => void }) {
  const payload = shoot.external_booking_payload ?? {};
  const source = (payload.source_record ?? {}) as SourceRecord;
  const fields = source.source_record ?? {};
  const files = shoot.files ?? [];
  const photos = files.filter(file => file.media_type === 'edited').sort((a, b) => Number(a.metadata?.source_order ?? 0) - Number(b.metadata?.source_order ?? 0));
  const other = files.filter(file => file.media_type !== 'edited');
  const summaryFields = ['CLIENT', 'CLIENT EMAIL', 'CLIENT PHONE', 'CLIENT COMPANY', 'PHOTOGRAPHER', 'SERVICES', 'BASE QUOTE', 'TAX AMOUNT', 'TOTAL QUOTE', 'TOTAL PAID', 'LAST PAYMENT DATE', 'LAST PAYMENT TYPE'];
  return <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
    <DialogContent onCloseAutoFocus={onCloseAutoFocus} className="flex max-h-[94vh] max-w-6xl flex-col overflow-hidden">
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">Private import draft</Badge><Badge variant="outline">Notifications disabled</Badge></div>
        <DialogTitle className="pt-2">{fields['FULL ADDRESS'] || shoot.location?.fullAddress || shoot.location?.address}</DialogTitle>
        <DialogDescription>Historical source details and media, available only for staff review. No invoice, payment, delivery or publication was created by this import.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 space-y-6 overflow-y-auto pr-2">
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Scheduled · New York calendar date</p><p className="font-medium">{source.scheduled_date || 'Not supplied'}</p></div>
          <div><p className="text-xs text-muted-foreground">Completed · New York calendar date</p><p className="font-medium">{source.completed_date || 'Not supplied'}</p></div>
          <div><p className="text-xs text-muted-foreground">Source snapshot</p><p className="break-all text-sm">{String(payload.source_snapshot_at ?? '')}</p></div>
        </div>
        <section aria-label="Original client, services and payment details">
          <h3 className="mb-3 font-semibold">Original client, services and payment details</h3>
          <p className="mb-3 text-sm text-muted-foreground">Amounts below are the original dashboard's historical figures. They do not represent a new charge or an outstanding invoice here.</p>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{summaryFields.map(name => <div key={name}><dt className="text-xs text-muted-foreground">{name.replaceAll('_', ' ')}</dt><dd className="whitespace-pre-wrap break-words text-sm">{fields[name] || 'Not supplied'}</dd></div>)}</dl>
        </section>
        <section aria-label="Imported photos">
          <h3 className="mb-3 font-semibold">Photos ({photos.length})</h3>
          <p className="mb-3 text-sm text-muted-foreground">One image per source photo, in original archive order. Open a photo for its full-size file; the small variant is used below.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{photos.map(file => <a key={file.id} href={fileUrl(file)} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-lg border bg-muted/20">
            <img src={safeUrl(file.web_url || file.thumbnail_url || file.thumb_url) || fileUrl(file)} alt={file.filename} loading="lazy" className="aspect-[3/2] w-full object-cover" />
            <p className="truncate p-2 text-xs" title={file.filename}>{file.filename}</p>
          </a>)}</div>
        </section>
        {other.length > 0 && <section aria-label="Videos, floor plans and documents"><h3 className="mb-3 font-semibold">Videos, floor plans and documents ({other.length})</h3><div className="grid gap-4 sm:grid-cols-2">{other.map(file => <div key={file.id} className="rounded-lg border p-3">
          <p className="mb-2 text-xs uppercase text-muted-foreground">{file.media_type}</p>
          {file.media_type === 'video' && <video src={fileUrl(file)} controls preload="metadata" className="mb-2 max-h-80 w-full rounded" />}
          <a href={fileUrl(file)} target="_blank" rel="noopener noreferrer" className="break-words text-sm text-primary underline">{file.filename}</a>
        </div>)}</div></section>}
        <details className="rounded-lg border p-4"><summary className="cursor-pointer font-medium">Every original source field</summary><dl className="mt-4 space-y-3">{Object.entries(fields).map(([name, value]) => <div key={name}><dt className="text-xs text-muted-foreground">{name}</dt><dd className="whitespace-pre-wrap break-words text-sm">{value || '—'}</dd></div>)}</dl></details>
        <details className="rounded-lg border p-4"><summary className="cursor-pointer font-medium">Original tour and additional links</summary><ul className="mt-3 space-y-2">{(source.links ?? []).filter(link => safeUrl(link.url)).map((link, index) => <li key={index}><a href={safeUrl(link.url)} target="_blank" rel="noopener noreferrer" className="break-words text-sm text-primary underline">{link.text || 'Source link'}</a></li>)}</ul></details>
      </div>
      <div className="flex justify-end border-t pt-3"><Button variant="outline" onClick={onClose}>Close review</Button></div>
    </DialogContent>
  </Dialog>;
}
