import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type StandingEditorNote, fetchClientStandingEditorNotes } from '@/services/standingEditorNoteService';

interface Props {
  clientId?: string | null;
  skip?: { enabled: boolean; skipped: boolean; setSkipped: (skipped: boolean) => void };
  className?: string;
}

/** Read-only notice in the booking form: these standing notes go to the editor automatically. */
export function StandingEditorNotesBookingBanner({ clientId, skip, className }: Props) {
  const [notes, setNotes] = React.useState<StandingEditorNote[]>([]);

  React.useEffect(() => {
    if (!clientId) { setNotes([]); return; }
    let cancelled = false;
    fetchClientStandingEditorNotes(clientId)
      .then((result) => { if (!cancelled) setNotes(result.applicable); })
      .catch(() => { if (!cancelled) setNotes([]); });
    return () => { cancelled = true; };
  }, [clientId]);

  if (notes.length === 0) return null;
  const skipped = Boolean(skip?.enabled && skip.skipped);

  return (
    <div
      className={cn('rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10', className)}
      data-testid="standing-editor-notes-banner"
    >
      <p className="text-xs font-bold text-amber-900 dark:text-amber-200">📌 Standing note — goes to the editor automatically</p>
      <ul className="mt-1.5 space-y-1">
        {notes.map((note) => (
          <li key={note.id} className={cn('flex flex-wrap items-start gap-2', skipped && 'line-through opacity-50')}>
            <Badge variant="secondary" className="shrink-0">{note.label}</Badge>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{note.content}</span>
          </li>
        ))}
      </ul>
      {skip?.enabled && (
        <label className="mt-2 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
          <input type="checkbox" checked={skip.skipped} onChange={(event) => skip.setSkipped(event.target.checked)} />
          Don’t apply on this shoot
        </label>
      )}
    </div>
  );
}
