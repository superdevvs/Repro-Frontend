import React from 'react';
import { ChevronDown, Pin } from 'lucide-react';
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
    const keyword = companyMatch.trim();
    setMatches(null);
    if (scope !== 'brokerage' || keyword.length < 2) { setMatching(false); return; }
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

  const preview = ownNote?.is_active ? ownNote : brokerageNotes[0] ?? ownNote;
  const status = !loaded ? (loadError ? 'Could not load' : 'Loading…')
    : preview ? (preview === ownNote && !ownNote?.is_active ? 'Off' : preview.label)
    : 'No note';

  return (
    <details
      className="group rounded-lg border border-violet-500/25 bg-violet-500/[0.04]"
      data-testid="standing-editor-note-section"
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-violet-500/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <Pin aria-hidden="true" className="size-3.5 shrink-0 text-violet-700 dark:text-violet-300" />
        <span className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-2.5">
          <span className="block shrink-0 font-medium">Standing editor note</span>
          {preview && <span className="block truncate text-xs text-muted-foreground group-open:hidden">{preview.content}</span>}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{status}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-2.5 border-t border-violet-500/15 px-3 py-2.5">
        {loadError ? (
          <p role="alert" className="text-sm text-destructive">{loadError}</p>
        ) : !loaded ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><InlineSpinner className="size-4" /> Loading standing note…</p>
        ) : (
          <>
            <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_minmax(15rem,32%)]">
              <Textarea
                aria-label="Standing note for the editor"
                className="min-h-[4rem]"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Add an instruction for the editor…"
                rows={2}
                maxLength={2000}
                disabled={!canManage}
              />
              <fieldset className="space-y-1.5" disabled={!canManage}>
                <legend className="mb-1 text-xs font-medium text-muted-foreground">Apply to</legend>
                <div className="grid grid-cols-2 gap-1 rounded-md bg-muted/70 p-0.5">
                  <label className={cn('flex min-h-8 cursor-pointer items-center gap-1.5 rounded px-1.5 text-xs', scope === 'client' && 'bg-background font-medium shadow-sm')}>
                    <input type="radio" name="standing-note-scope" checked={scope === 'client'} onChange={() => setScope('client')} />
                    This client
                  </label>
                  <label className={cn('flex min-h-8 cursor-pointer items-center gap-1.5 rounded px-1.5 text-xs', scope === 'brokerage' && 'bg-background font-medium shadow-sm')}>
                    <input type="radio" name="standing-note-scope" checked={scope === 'brokerage'} onChange={() => setScope('brokerage')} />
                    Brokerage
                  </label>
                </div>
                {scope === 'brokerage' && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Input aria-label="Company name contains" placeholder="Company name contains…" className="h-8 min-w-[8rem] flex-1 px-2 text-xs" value={companyMatch} maxLength={120} onChange={(event) => setCompanyMatch(event.target.value)} />
                    {matching ? <InlineSpinner className="size-3.5" /> : matches && (
                      <details className="relative text-xs">
                        <summary className="cursor-pointer whitespace-nowrap text-primary underline-offset-4 hover:underline">
                          {matches.count} {matches.count === 1 ? 'client matches' : 'clients match'}
                        </summary>
                        <ul className="mt-1 max-h-28 min-w-24 space-y-1 overflow-auto rounded-md border bg-background p-2">
                          {matches.clients.map((client) => <li key={client.id}>{client.name}</li>)}
                          {matches.count > matches.clients.length && <li>+ {matches.count - matches.clients.length} more</li>}
                          {matches.count === 0 && <li>No matching clients yet.</li>}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </fieldset>
            </div>

            {otherBrokerage.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-muted-foreground">
                  {otherBrokerage.length} additional brokerage {otherBrokerage.length === 1 ? 'note applies' : 'notes apply'}
                </summary>
                <ul className="mt-1.5 space-y-1 pl-3">
                  {otherBrokerage.map((note) => <li key={note.id}><span className="font-medium">{note.label}</span> · {note.content}</li>)}
                </ul>
              </details>
            )}

            {canManage && (
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                {ownNote ? (
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch checked={ownNote.is_active} onCheckedChange={(checked) => void toggleOwnActive(checked)} disabled={saving} />
                    {ownNote.is_active ? 'Client note on' : 'Client note off'}
                  </label>
                ) : <span className="text-xs text-muted-foreground">Applies to open and future shoots.</span>}
                <div className="ml-auto flex gap-1.5">
                  {ownNote && scope === 'client' && (
                    <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => void removeClientNote()} disabled={saving}>Remove</Button>
                  )}
                  <Button type="button" size="sm" className="h-8" onClick={() => void save()} disabled={!canSave}>
                    {saving ? 'Saving…' : 'Save note'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}
