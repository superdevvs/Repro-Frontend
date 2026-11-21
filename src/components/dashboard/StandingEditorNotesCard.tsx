import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
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
}

/** Pinned card at the top of a shoot's Notes tab. */
export function StandingEditorNotesCard({ shootId, clientId, value, canManage }: Props) {
  const { toast } = useToast();
  const [state, setState] = React.useState(value ?? null);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { setState(value ?? null); }, [value]);

  if (!state || state.notes.length === 0) return null;
  const hidden = state.hidden;

  const toggle = async () => {
    setSaving(true);
    try {
      const next = await setShootStandingEditorNotesHidden(shootId, !hidden);
      setState(next ?? { ...state, hidden: !hidden });
      toast({ title: hidden ? 'Standing note shown on this shoot' : 'Standing note hidden on this shoot' });
    } catch (error) {
      toast({ title: 'Could not update standing note', description: normalizeApiError(error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id="shoot-note-standing"
      data-testid="standing-editor-notes-card"
      className={cn(
        'rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10',
        hidden && 'opacity-70',
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">📌 Standing client note</h3>
        {hidden && <Badge variant="outline" className="border-amber-400 text-amber-900 dark:text-amber-200">Hidden on this shoot</Badge>}
      </div>
      <ul className="space-y-2">
        {state.notes.map((note) => (
          <li key={note.id} className={cn('space-y-1', hidden && 'line-through')}>
            <Badge variant="secondary">{note.label}</Badge>
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed [overflow-wrap:anywhere]">{note.content}</p>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900/80 dark:text-amber-200/80">
        <span>{state.frozen ? 'As it was when this shoot was delivered' : 'Set on the client account · applies to every shoot'}</span>
        {canManage && (
          <span className="flex items-center gap-3">
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void toggle()} disabled={saving}>
              {hidden ? 'Show on this shoot' : 'Hide on this shoot'}
            </Button>
            {clientId && (
              <Link className="font-medium text-primary underline-offset-4 hover:underline" to={`/accounts?account=${encodeURIComponent(String(clientId))}`}>
                Open client account ↗
              </Link>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
