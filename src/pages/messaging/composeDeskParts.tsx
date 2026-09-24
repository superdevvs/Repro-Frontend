import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { MessagingJsonObject } from '@/types/messaging';
import { formatFileSize, type DraftAttachmentPlaceholder } from './emailComposeModel';

type Suggestion = { name: string; label: string };

function valueOf(variables: MessagingJsonObject | undefined, name: string) {
  const value = variables?.[name];
  return value == null ? '' : String(value);
}

export function ComposeVariables({
  suggestions,
  variables,
  missing,
  json,
  jsonError,
  onJson,
  onInsert,
}: {
  suggestions: Suggestion[];
  variables?: MessagingJsonObject;
  missing: string[];
  json: string;
  jsonError?: string;
  onJson: (value: string) => void;
  onInsert: (name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [showInsert, setShowInsert] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const empty = useMemo(() => {
    const names = new Set<string>([...missing, ...suggestions.filter((entry) => !valueOf(variables, entry.name)).map((entry) => entry.name)]);
    return [...names];
  }, [missing, suggestions, variables]);
  const filtered = suggestions.filter((entry) => {
    const hay = `${entry.name} ${entry.label} ${valueOf(variables, entry.name)}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  const writeValue = (name: string, next: string) => {
    const current = { ...(variables ?? {}) };
    current[name] = next;
    onJson(JSON.stringify(current, null, 2));
  };

  return (
    <section className="relative space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Variables</h3>
        <span className="text-xs text-muted-foreground">{empty.length ? `${empty.length} empty of ${suggestions.length || empty.length}` : `All ${suggestions.length} filled`}</span>
      </div>
      <div className="grid max-h-40 grid-cols-2 gap-2 overflow-auto sm:max-h-44">
        {empty.map((name) => (
          <label key={name} className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-border/70 bg-muted/20 px-2 py-1.5">
            <span className="truncate text-[11px] text-muted-foreground">{name.replace(/_/g, ' ')}</span>
            <input
              value={valueOf(variables, name)}
              placeholder="Value"
              aria-label={name}
              className="w-full bg-transparent text-sm outline-none"
              onChange={(event) => writeValue(name, event.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        <button type="button" className="text-sm text-primary" onClick={() => { setShowJson(false); setShowInsert((open) => !open); }}>Insert variable</button>
        <button type="button" className="text-sm text-primary" onClick={() => { setShowInsert(false); setShowJson((open) => !open); }}>Edit JSON</button>
      </div>
      {showInsert && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-xl border border-border bg-popover p-2 shadow-lg">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${suggestions.length} variables`} aria-label="Search variables" className="mb-1 h-9" />
          {filtered.map((entry) => (
            <button key={entry.name} type="button" className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => { onInsert(entry.name); setShowInsert(false); }}>
              <span>{`{{${entry.name}}}`}</span>
              <span className="truncate text-xs text-muted-foreground">{valueOf(variables, entry.name) || 'Empty'}</span>
            </button>
          ))}
        </div>
      )}
      {showJson && (
        <div className="space-y-1">
          <Textarea aria-label="Variables JSON" value={json} onChange={(event) => onJson(event.target.value)} className="min-h-32 font-mono text-xs" />
          {jsonError ? <p className="text-xs text-amber-600">{jsonError}</p> : null}
        </div>
      )}
    </section>
  );
}

export function ComposeFiles({
  attachments,
  draftAttachments,
  onAdd,
  onRemove,
  onRemoveDraft,
}: {
  attachments: File[];
  draftAttachments: DraftAttachmentPlaceholder[];
  onAdd: () => void;
  onRemove: (file: File) => void;
  onRemoveDraft: (file: DraftAttachmentPlaceholder) => void;
}) {
  const count = attachments.length + draftAttachments.length;
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Files</h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/70">
        <button type="button" className="w-full border-b border-border/70 px-3 py-2.5 text-left text-sm text-primary" onClick={onAdd}>Add files</button>
        <div className="max-h-60 overflow-auto">
          {attachments.map((file) => (
            <div key={`${file.name}-${file.size}`} className="grid grid-cols-[2.2rem_minmax(0,1fr)_1.75rem] items-center gap-2 border-b border-border/50 px-2 py-2 last:border-0">
              <span className="grid h-6 place-items-center rounded-md bg-muted text-[9px] tracking-wide text-muted-foreground">{extensionOf(file.name)}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm">{file.name}</span>
                <span className="block text-[11px] text-muted-foreground">{formatFileSize(file.size)}</span>
              </span>
              <button type="button" aria-label={`Remove ${file.name}`} className="text-muted-foreground" onClick={() => onRemove(file)}><X className="h-4 w-4" /></button>
            </div>
          ))}
          {draftAttachments.map((file) => (
            <div key={`draft-${file.name}-${file.size}`} className="grid grid-cols-[2.2rem_minmax(0,1fr)_1.75rem] items-center gap-2 border-b border-border/50 px-2 py-2 last:border-0">
              <span className="grid h-6 place-items-center rounded-md bg-amber-500/10 text-[9px] text-amber-600">{extensionOf(file.name)}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm">{file.name}</span>
                <span className="block text-[11px] text-amber-600">Needs reattach</span>
              </span>
              <button type="button" aria-label={`Remove ${file.name}`} className="text-muted-foreground" onClick={() => onRemoveDraft(file)}><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function extensionOf(name: string) {
  const part = name.split('.').pop();
  return (part && part !== name ? part : 'FILE').slice(0, 4).toUpperCase();
}

export function ComposeRobbie({
  body,
  subject,
  variables,
  onBody,
  onSubject,
}: {
  body: string;
  subject: string;
  variables?: MessagingJsonObject;
  onBody: (value: string) => void;
  onSubject: (value: string) => void;
}) {
  const [ask, setAsk] = useState('');
  const [note, setNote] = useState('Uses the details already on this email.');
  const [undo, setUndo] = useState<{ body: string; subject: string } | null>(null);

  const remember = () => setUndo({ body, subject });
  const applyBody = (next: string, message: string) => {
    remember();
    onBody(next);
    setNote(message);
  };

  const fromShoot = () => {
    const name = String(variables?.client_name || 'there');
    const address = String(variables?.shoot_address || 'the property');
    const when = [variables?.shoot_date, variables?.shoot_time].filter(Boolean).join(' at ') || 'the scheduled time';
    applyBody(`Hi ${name},\n\nYour shoot at ${address} is ${when}. Reply if anything needs to change.`, 'Drafted from the shoot details on this email.');
  };

  return (
    <div className="shrink-0 border-t border-border/70 bg-muted/20 px-3 py-2">
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-border/70 bg-background px-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Robbie</span>
        <input
          value={ask}
          aria-label="Ask Robbie"
          placeholder="Ask Robbie"
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
          onChange={(event) => setAsk(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || !ask.trim()) return;
            applyBody(`Hi ${String(variables?.client_name || 'there')},\n\n${ask.trim()}\n\nReply if anything needs to change.`, 'Wrote from your note.');
            setAsk('');
          }}
        />
        <button type="button" className="text-sm text-primary" onClick={() => {
          if (!ask.trim()) return;
          applyBody(`Hi ${String(variables?.client_name || 'there')},\n\n${ask.trim()}\n\nReply if anything needs to change.`, 'Wrote from your note.');
          setAsk('');
        }}>Write</button>
      </div>
      <p className="mt-1 truncate px-1 text-xs text-muted-foreground">{note}</p>
      <div className="flex items-center gap-1 overflow-x-auto">
        <button type="button" className="h-11 shrink-0 whitespace-nowrap rounded-lg px-2 text-sm text-muted-foreground" onClick={fromShoot}>From shoot</button>
        <button type="button" className="h-11 shrink-0 whitespace-nowrap rounded-lg px-2 text-sm text-muted-foreground" onClick={() => applyBody(body.split(/\n{2,}/).map((part) => part.split(/(?<=[.!?])\s/)[0] || part).join('\n\n'), 'Shortened the letter.')}>Shorter</button>
        <button type="button" className="h-11 shrink-0 whitespace-nowrap rounded-lg px-2 text-sm text-muted-foreground" onClick={() => applyBody(body.includes('Hope you') ? body : body.replace(/\n\n/, '\n\nHope you are well.\n\n'), 'Warmed the tone.')}>Warmer</button>
        <button type="button" className="h-11 shrink-0 whitespace-nowrap rounded-lg px-2 text-sm text-muted-foreground" onClick={() => applyBody(body.replace(/[ \t]{2,}/g, ' ').trim(), 'Cleared extra spacing.')}>Clearer</button>
        <button type="button" className="h-11 shrink-0 whitespace-nowrap rounded-lg px-2 text-sm text-muted-foreground" onClick={() => {
          remember();
          const next = [variables?.shoot_time, variables?.shoot_address].filter(Boolean).join(' — ');
          if (next) onSubject(String(next));
          setNote(next ? 'Subject now leads with the shoot.' : 'Add a shoot time or address first.');
        }}>Subject</button>
        {undo && (
          <button type="button" className="h-11 shrink-0 whitespace-nowrap rounded-lg px-2 text-sm text-primary" onClick={() => { onBody(undo.body); onSubject(undo.subject); setUndo(null); setNote('Restored the previous letter.'); }}>Undo</button>
        )}
      </div>
    </div>
  );
}
