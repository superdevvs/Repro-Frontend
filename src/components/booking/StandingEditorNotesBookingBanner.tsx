import React from 'react';
import { Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type StandingEditorNote, fetchClientStandingEditorNotes } from '@/services/standingEditorNoteService';

interface Props {
  clientId?: string | null;
  skip?: { enabled: boolean; skipped: boolean; setSkipped: (skipped: boolean) => void };
  className?: string;
}

/** Read-only notice in the booking form: these standing notes go to the editor automatically. */
export function StandingEditorNotesBookingBanner({ clientId, skip, className }: Props) {
  const [result, setResult] = React.useState<{ clientId: string; notes: StandingEditorNote[] } | null>(null);
  const notes = result?.clientId === clientId ? result?.notes ?? [] : [];

  React.useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    fetchClientStandingEditorNotes(clientId)
      .then((response) => { if (!cancelled) setResult({ clientId, notes: response.applicable }); })
      .catch(() => { if (!cancelled) setResult(null); });
    return () => { cancelled = true; };
  }, [clientId]);

  if (notes.length === 0) return null;
  const skipped = Boolean(skip?.enabled && skip.skipped);

  return (
    <div
      className={cn('rounded-lg border border-violet-500/25 bg-violet-500/[0.06] px-3 py-2', className)}
      data-testid="standing-editor-notes-banner"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-900 dark:text-violet-200">
          <Pin aria-hidden="true" className="size-3.5 shrink-0" /> Standing note for the editor
        </p>
        {skip?.enabled && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs">
            <input type="checkbox" checked={skip.skipped} onChange={(event) => skip.setSkipped(event.target.checked)} />
            Don’t apply on this shoot
          </label>
        )}
      </div>
      <ul className="mt-1 space-y-1">
        {notes.map((note) => (
          <li key={note.id} className={cn('whitespace-pre-wrap text-sm leading-snug [overflow-wrap:anywhere]', skipped && 'line-through text-muted-foreground')}>
            <span className="mr-1.5 text-xs font-medium text-muted-foreground">{note.label} ·</span>
            <span>{note.content}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
