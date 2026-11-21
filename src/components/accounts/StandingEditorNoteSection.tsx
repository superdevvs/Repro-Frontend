import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { normalizeApiError } from '@/services/apiError';
import {
  type ClientStandingEditorNotes,
  type CompanyMatchResult,
  type StandingEditorNote,
  type StandingEditorNoteScope,
  createStandingEditorNote,
  deleteStandingEditorNote,
  fetchClientStandingEditorNotes,
  matchCompanyClients,
  suggestCompanyKeyword,
  updateStandingEditorNote,
} from '@/services/standingEditorNoteService';

const sameMatch = (a?: string | null, b?: string | null) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

interface Props {
  clientId: number | string;
  clientName: string;
  companyName?: string | null;
  canManage: boolean;
}

/**
 * The client account's standing note for the editor. Saved on its own (the
 * account form keeps its existing save flow); applies to this client or to
 * every client whose company name contains a brokerage keyword.
 */
export function StandingEditorNoteSection({ clientId, clientName, companyName, canManage }: Props) {
  const { toast } = useToast();
  const [loaded, setLoaded] = React.useState<ClientStandingEditorNotes | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<StandingEditorNoteScope>('client');
  const [content, setContent] = React.useState('');
  const [companyMatch, setCompanyMatch] = React.useState(() => suggestCompanyKeyword(companyName));
  const [matches, setMatches] = React.useState<CompanyMatchResult | null>(null);
  const [matching, setMatching] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const result = await fetchClientStandingEditorNotes(clientId);
      setLoaded(result);
      setLoadError(null);
      const own = result.client_note;
      const brokerage = result.applicable.find((note) => note.scope === 'brokerage');
      if (own && own.is_active) {
        setScope('client');
        setContent(own.content);
      } else if (brokerage) {
        setScope('brokerage');
        setContent(brokerage.content);
        setCompanyMatch(brokerage.company_match ?? '');
      } else if (own) {
        setScope('client');
        setContent(own.content);
      }
    } catch (error) {
      setLoadError(normalizeApiError(error).message);
    }
  }, [clientId]);

  React.useEffect(() => { void load(); }, [load]);

  React.useEffect(() => {
    if (scope !== 'brokerage') return;
    const keyword = companyMatch.trim();
    if (keyword.length < 2) { setMatches(null); return; }
    let cancelled = false;
    setMatching(true);
    const timer = window.setTimeout(() => {
      matchCompanyClients(keyword)
        .then((result) => { if (!cancelled) setMatches(result); })
        .catch(() => { if (!cancelled) setMatches(null); })
        .finally(() => { if (!cancelled) setMatching(false); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [companyMatch, scope]);

  const ownNote = loaded?.client_note ?? null;
  const brokerageNotes = (loaded?.applicable ?? []).filter((note) => note.scope === 'brokerage');
  const existingBrokerage: StandingEditorNote | undefined = scope === 'brokerage'
    ? brokerageNotes.find((note) => sameMatch(note.company_match, companyMatch))
    : undefined;
  const otherBrokerage = brokerageNotes.filter((note) => note !== existingBrokerage);
  const trimmed = content.trim();
  const canSave = canManage && !saving && trimmed.length > 0
    && (scope === 'client' || companyMatch.trim().length >= 2);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (scope === 'client') {
        await createStandingEditorNote({ scope: 'client', client_id: Number(clientId), content: trimmed, is_active: true });
      } else if (existingBrokerage) {
        await updateStandingEditorNote(existingBrokerage.id, { content: trimmed, company_match: companyMatch.trim(), is_active: true });
      } else {
        await createStandingEditorNote({ scope: 'brokerage', company_match: companyMatch.trim(), content: trimmed });
      }
      toast({
        title: 'Standing note saved',
        description: scope === 'client'
          ? `Editors will see it on every open shoot for ${clientName}.`
          : `Editors will see it on every open shoot for clients at “${companyMatch.trim()}”.`,
      });
      await load();
    } catch (error) {
      toast({ title: 'Standing note not saved', description: normalizeApiError(error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const removeClientNote = async () => {
    if (!ownNote || !canManage) return;
    setSaving(true);
    try {
      await deleteStandingEditorNote(ownNote.id);
      setContent('');
      toast({ title: 'Standing note removed', description: `${clientName}'s own standing note no longer appears on open shoots.` });
      await load();
    } catch (error) {
      toast({ title: 'Could not remove note', description: normalizeApiError(error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleOwnActive = async (active: boolean) => {
    if (!ownNote || !canManage) return;
    setSaving(true);
    try {
      await updateStandingEditorNote(ownNote.id, { is_active: active });
      await load();
    } catch (error) {
      toast({ title: 'Could not update note', description: normalizeApiError(error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby="standing-editor-note-heading"
      className="space-y-3 rounded-xl border-2 border-primary/60 bg-primary/[0.03] p-4"
      data-testid="standing-editor-note-section"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="standing-editor-note-heading" className="text-sm font-semibold">Standing note for the editor</h3>
        <Badge variant="secondary" className="bg-purple-500/15 text-purple-700 dark:text-purple-300">
          Editors only · never shown to client
        </Badge>
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : !loaded ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><InlineSpinner className="h-4 w-4" /> Loading standing note…</p>
      ) : (
        <>
          <Textarea
            aria-label="Standing note for the editor"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="e.g. All Weichert agents get 1 complimentary exterior green grass."
            rows={3}
            maxLength={2000}
            disabled={!canManage}
          />

          <fieldset className="space-y-2" disabled={!canManage}>
            <legend className="mb-1 text-xs font-semibold text-muted-foreground">Apply to</legend>
            <label className={cn('flex cursor-pointer gap-3 rounded-lg border p-3', scope === 'client' && 'border-primary bg-primary/5')}>
              <input type="radio" name="standing-note-scope" className="mt-1" checked={scope === 'client'} onChange={() => setScope('client')} />
              <span>
                <span className="block text-sm font-semibold">Only {clientName}</span>
                <span className="block text-xs text-muted-foreground">Every shoot booked for this client.</span>
              </span>
            </label>
            <label className={cn('flex cursor-pointer gap-3 rounded-lg border p-3', scope === 'brokerage' && 'border-primary bg-primary/5')}>
              <input type="radio" name="standing-note-scope" className="mt-1" checked={scope === 'brokerage'} onChange={() => setScope('brokerage')} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Everyone at this brokerage</span>
                {scope === 'brokerage' && (
                  <span className="mt-2 block space-y-2">
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      Company name contains
                      <Input
                        aria-label="Company name contains"
                        className="h-8 w-40"
                        value={companyMatch}
                        maxLength={120}
                        onChange={(event) => setCompanyMatch(event.target.value)}
                      />
                      {matching ? <InlineSpinner className="h-3.5 w-3.5" /> : matches && (
                        <Badge variant="secondary">{matches.count} {matches.count === 1 ? 'client matches' : 'clients match'}</Badge>
                      )}
                    </span>
                    {matches && matches.clients.length > 0 && (
                      <span className="block max-h-36 overflow-auto rounded-md border bg-background text-xs">
                        {matches.clients.map((client) => (
                          <span key={client.id} className="flex justify-between gap-3 border-b px-2.5 py-1.5 last:border-b-0">
                            <span>{client.name}</span>
                            <span className="truncate text-muted-foreground">{client.company_name}</span>
                          </span>
                        ))}
                        {matches.count > matches.clients.length && (
                          <span className="block px-2.5 py-1.5 text-muted-foreground">+ {matches.count - matches.clients.length} more…</span>
                        )}
                      </span>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      New agents whose company contains this keyword are picked up automatically.
                    </span>
                  </span>
                )}
              </span>
            </label>
          </fieldset>

          {otherBrokerage.length > 0 && (
            <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <p className="font-semibold">Also applies to this client</p>
              {otherBrokerage.map((note) => (
                <p key={note.id}><span className="font-medium">{note.label}:</span> {note.content}</p>
              ))}
              <p className="text-amber-800/80 dark:text-amber-200/80">Change brokerage notes in Settings › Editing › Standing notes.</p>
            </div>
          )}

          <p className="rounded-md border-l-4 border-primary bg-primary/5 px-3 py-2 text-xs">
            Shows on <b>new shoots and any shoot not yet delivered</b>. Delivered shoots keep whatever note they had.
          </p>

          {canManage && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {ownNote ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={ownNote.is_active} onCheckedChange={(checked) => void toggleOwnActive(checked)} disabled={saving} />
                  {ownNote.is_active ? 'Client note on' : 'Client note off'}
                </label>
              ) : <span />}
              <div className="flex gap-2">
                {ownNote && scope === 'client' && (
                  <Button type="button" variant="outline" size="sm" onClick={() => void removeClientNote()} disabled={saving}>
                    Remove
                  </Button>
                )}
                <Button type="button" size="sm" onClick={() => void save()} disabled={!canSave}>
                  {saving ? 'Saving…' : 'Save note'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
