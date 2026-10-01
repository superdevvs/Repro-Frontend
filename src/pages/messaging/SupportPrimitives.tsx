import { useRef, useState } from 'react';
import { Download, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadSupportAttachment, supportStatusLabel, supportTime, type TicketMessage } from '@/services/supportTickets';

export function SupportStatusBadge({ status }: { status: string }) {
  const tone = status === 'resolved' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : status === 'waiting' ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
      : status === 'in_progress' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'bg-muted text-muted-foreground';
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{supportStatusLabel(status)}</span>;
}

export function SupportFiles({ files, onChange, disabled, id }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean; id: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  return <div className="min-w-0 space-y-1">
    <input ref={input} id={id} className="sr-only" type="file" multiple disabled={disabled} aria-label="Attach files" onChange={event => {
      const next = [...files, ...Array.from(event.target.files || [])];
      event.target.value = '';
      if (next.length > 5 || next.some(file => file.size > 10 * 1024 * 1024)) { setError('Attach up to 5 files, each 10 MB or smaller.'); return; }
      setError(''); onChange(next);
    }} />
    <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" disabled={disabled} onClick={() => input.current?.click()}><Paperclip className="mr-1.5 h-4 w-4" />Attach files <span className="ml-1 text-xs">(up to 10 MB each)</span></Button>
    {files.length > 0 && <ul className="flex max-h-20 flex-wrap gap-1 overflow-y-auto" aria-label="Files to attach">{files.map((file, index) => <li key={`${index}:${file.name}`} className="flex max-w-full items-center gap-1 rounded-md border px-2 text-xs"><span className="truncate">{file.name}</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`Remove ${file.name}`} disabled={disabled} onClick={() => { setError(''); onChange(files.filter((_, position) => position !== index)); }}><X className="h-3 w-3" /></Button></li>)}</ul>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}

export function SupportMessage({ ticketId, item, own }: { ticketId: number; item: TicketMessage; own: boolean }) {
  const [downloading, setDownloading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const download = async (index: number, name: string) => {
    setError(''); setDownloading(index);
    try { await downloadSupportAttachment(ticketId, item.id, index, name); }
    catch { setError('This attachment could not be downloaded. Please try again.'); }
    finally { setDownloading(null); }
  };
  return <article className={`max-w-[95%] rounded-2xl border px-3.5 py-3 sm:max-w-[88%] ${item.internal ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100' : item.kind === 'event' ? 'mx-auto border-dashed text-muted-foreground' : own ? 'ml-auto border-primary/10 bg-primary/5' : 'border-border bg-card'}`}>
    <header className="mb-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">{item.author?.name || 'Support'}{item.internal ? ' · Internal note' : ''}</span><time dateTime={item.created_at}>{supportTime(item.created_at)}</time></header>
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.body}</p>
    {Boolean(item.attachments?.length) && <ul className="mt-2 space-y-1" aria-label="Message attachments">{item.attachments!.map(file => <li key={file.index}><Button type="button" variant="outline" size="sm" className="h-auto min-h-9 max-w-full justify-start gap-2 whitespace-normal text-left" disabled={downloading !== null} onClick={() => void download(file.index, file.name)}><Download className="h-3.5 w-3.5 shrink-0" /><span className="break-all">{downloading === file.index ? 'Downloading…' : file.name}</span></Button></li>)}</ul>}
    {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
  </article>;
}
