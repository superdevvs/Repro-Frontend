import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { useToast } from '@/hooks/use-toast';
import { normalizeApiError } from '@/services/apiError';
import {
  type CompanyMatchResult,
  type StandingEditorNoteRow,
  createStandingEditorNote,
  deleteStandingEditorNote,
  listStandingEditorNotes,
  matchCompanyClients,
  updateStandingEditorNote,
} from '@/services/standingEditorNoteService';

const formatDate = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

interface EditorState {
  id: number | null;
  companyMatch: string;
  content: string;
}

/** Settings › Editing › Standing notes: every standing editor note in one list. */
export function StandingEditorNotesSettings({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<StandingEditorNoteRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<EditorState | null>(null);
  const [matches, setMatches] = React.useState<CompanyMatchResult | null>(null);
  const [busyId, setBusyId] = React.useState<number | 'new' | null>(null);

  const load = React.useCallback(async () => {
    try {
      setRows(await listStandingEditorNotes());
      setError(null);
    } catch (loadError) {
      setError(normalizeApiError(loadError).message);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const editingKeyword = editing?.companyMatch.trim() ?? '';
  const isBrokerageEdit = editing !== null
    && (editing.id === null || rows?.find((row) => row.id === editing.id)?.scope === 'brokerage');
  React.useEffect(() => {
    if (!isBrokerageEdit || editingKeyword.length < 2) { setMatches(null); return; }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      matchCompanyClients(editingKeyword).then((result) => { if (!cancelled) setMatches(result); }).catch(() => undefined);
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [editingKeyword, isBrokerageEdit]);

  const run = async (id: number | 'new', action: () => Promise<unknown>, success: string) => {
    setBusyId(id);
    try {
      await action();
      toast({ title: success });
      await load();
      return true;
    } catch (actionError) {
      toast({ title: 'Could not save', description: normalizeApiError(actionError).message, variant: 'destructive' });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const saveEditor = async () => {
    if (!editing) return;
    const content = editing.content.trim();
    const companyMatch = editing.companyMatch.trim();
    if (!content || (isBrokerageEdit && companyMatch.length < 2)) return;
    const ok = editing.id === null
      ? await run('new', () => createStandingEditorNote({ scope: 'brokerage', company_match: companyMatch, content }), 'Brokerage note added')
      : await run(editing.id, () => updateStandingEditorNote(editing.id as number, isBrokerageEdit
        ? { content, company_match: companyMatch } : { content }), 'Standing note updated');
    if (ok) setEditing(null);
  };

  const editorForm = editing && (
    <div className="space-y-3 rounded-lg border border-primary/50 bg-primary/[0.03] p-4" data-testid="standing-note-editor">
      {isBrokerageEdit && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Company name contains</span>
          <Input
            aria-label="Company name contains"
            className="h-8 w-48"
            value={editing.companyMatch}
            maxLength={120}
            onChange={(event) => setEditing({ ...editing, companyMatch: event.target.value })}
          />
          {matches && <Badge variant="secondary">{matches.count} {matches.count === 1 ? 'client matches' : 'clients match'}</Badge>}
        </div>
      )}
      {isBrokerageEdit && matches && matches.clients.length > 0 && (
        <div className="max-h-32 overflow-auto rounded-md border bg-background text-xs">
          {matches.clients.map((client) => (
            <div key={client.id} className="flex justify-between gap-3 border-b px-2.5 py-1.5 last:border-b-0">
              <span>{client.name}</span><span className="truncate text-muted-foreground">{client.company_name}</span>
            </div>
          ))}
        </div>
      )}
      <Textarea
        aria-label="Standing note for the editor"
        rows={3}
        maxLength={2000}
        value={editing.content}
        onChange={(event) => setEditing({ ...editing, content: event.target.value })}
        placeholder="e.g. All Weichert agents get 1 complimentary exterior green grass."
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
        <Button type="button" size="sm" onClick={() => void saveEditor()} disabled={busyId !== null || !editing.content.trim()}>
          {busyId !== null ? 'Saving…' : 'Save note'}
        </Button>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Standing editor notes</CardTitle>
          <CardDescription>
            Instructions editors see on every open shoot for a client or brokerage. Client notes are also editable from the client’s account.
          </CardDescription>
        </div>
        {canManage && !editing && (
          <Button type="button" size="sm" onClick={() => setEditing({ id: null, companyMatch: '', content: '' })}>
            + Add brokerage note
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {editing?.id === null && editorForm}
        {error ? <p className="text-sm text-destructive">{error}</p> : rows === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><InlineSpinner className="h-4 w-4" /> Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No standing notes yet. Add one here for a brokerage, or from a client’s account for a single client.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {rows.map((row) => (
              <div key={row.id} className="space-y-3 p-4" data-testid="standing-note-row">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={row.scope === 'brokerage' ? 'default' : 'secondary'}>
                        {row.scope === 'brokerage' ? 'Brokerage' : 'Client'}
                      </Badge>
                      <span className="text-sm font-semibold">
                        {row.scope === 'brokerage' ? `Company contains “${row.company_match}”` : row.client_name ?? 'Client'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.matched_count ?? 0} {row.matched_count === 1 ? 'client' : 'clients'}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm">{row.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {[row.updated_by_name, formatDate(row.updated_at)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={row.is_active}
                        disabled={!canManage || busyId !== null}
                        onCheckedChange={(checked) => void run(row.id, () => updateStandingEditorNote(row.id, { is_active: checked }), checked ? 'Note switched on' : 'Note switched off')}
                        aria-label={row.is_active ? 'Switch note off' : 'Switch note on'}
                      />
                      {row.is_active ? 'On' : 'Off'}
                    </label>
                    {canManage && (
                      <>
                        <Button type="button" variant="link" size="sm" className="h-auto p-0"
                          onClick={() => setEditing({ id: row.id, companyMatch: row.company_match ?? '', content: row.content })}>
                          Edit
                        </Button>
                        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-destructive"
                          disabled={busyId !== null}
                          onClick={() => {
                            if (window.confirm('Delete this standing note? Open shoots will stop showing it.')) {
                              void run(row.id, () => deleteStandingEditorNote(row.id), 'Standing note deleted');
                            }
                          }}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {editing?.id === row.id && editorForm}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
