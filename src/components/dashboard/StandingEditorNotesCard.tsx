import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Pin } from 'lucide-react';
import { triggerShootDetailRefresh } from '@/realtime/realtimeRefreshBus';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { normalizeApiError } from '@/services/apiError';
import {
  type ShootStandingEditorNotes,
  setShootStandingEditorNotesHidden,
} from '@/services/standingEditorNoteService';

interface Props {
  shootId: number | string;
  clientId?: number | string | null;
  value: ShootStandingEditorNotes | null | undefined;
  /** Admins, superadmins and sales reps may hide the note on this shoot. */
  canManage: boolean;
  overview?: boolean;
}

/** Standing instructions on Shoot Notes and Overview. */
export function StandingEditorNotesCard({ shootId, clientId, value, canManage, overview = false }: Props) {
  const { toast } = useToast();
  const [state, setState] = React.useState(value ?? null);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { setState(value ?? null); }, [value]);

  if (!state || state.notes.length === 0 || (overview && state.hidden)) return null;
  const hidden = state.hidden;

  const toggle = async () => {
    setSaving(true);
    try {
      const next = await setShootStandingEditorNotesHidden(shootId, !hidden);
      setState(next ?? { ...state, hidden: !hidden });
      triggerShootDetailRefresh(shootId);
      toast({ title: hidden ? 'Standing note shown on this shoot' : 'Standing note hidden on this shoot' });
    } catch (error) {
      toast({ title: 'Could not update standing note', description: normalizeApiError(error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id={overview ? undefined : 'shoot-note-standing'}
      data-testid={overview ? 'standing-editor-notes-overview' : 'standing-editor-notes-card'}
      className={cn(
        'rounded-lg border border-violet-500/25 bg-violet-500/[0.06] px-3 py-2',
        hidden && 'opacity-75',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-violet-900 dark:text-violet-200">
          <Pin aria-hidden="true" className="size-3.5 shrink-0" /> Standing client note
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {hidden && <span className="text-muted-foreground">Hidden on this shoot</span>}
          {state.frozen && <span className="text-muted-foreground">Saved at delivery</span>}
          {canManage && (
            <>
              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void toggle()} disabled={saving}>
                {hidden ? 'Show on this shoot' : 'Hide on this shoot'}
              </Button>
              {clientId && (
                <Link className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline" to={`/accounts?account=${encodeURIComponent(String(clientId))}`}>
                  Open client account <ArrowUpRight aria-hidden="true" className="size-3" />
                </Link>
              )}
            </>
          )}
        </div>
      </div>
      <ul className="mt-1 space-y-1">
        {state.notes.map((note) => (
          <li key={note.id} className={cn('whitespace-pre-wrap text-sm leading-snug [overflow-wrap:anywhere]', hidden && 'line-through')}>
            <span className="mr-1.5 text-xs font-medium text-muted-foreground">{note.label} ·</span>
            {note.content}
          </li>
        ))}
      </ul>
    </div>
  );
}
