import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarPlus, Download, FileUp, Mail, MoreHorizontal, Plane, Star, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiClient } from '@/services/api';
import { cn } from '@/lib/utils';
import { crmApi, toApiError } from '../../api';
import { useCrmMutation, useCrmQuery } from '../../hooks';
import { ago, day, when } from '../../format';
import { useRobbieWhere } from '../../robbie/useCrmRobbie';
import { Field, Select, TextArea, TextInput } from '../../ui/fields';
import { Card, Chip, CrmPage, ErrorNote, KeyValues, Loading, Note, TabBar } from '../../ui/primitives';
import { RichText } from '../../components/RichText';
import { useEventTypes } from '../../components/eventTypes';
import { type Applicant, FILE_LABEL, type RecruitMeta, ROLE_LABEL, SCORE_LABEL, SOURCE_LABEL, stageTone } from './recruitingShared';

type Tab = 'notes' | 'files' | 'interviews' | 'emails' | 'history';
type Dialogs = 'exit' | 'hire' | 'interview' | 'email' | null;

/** Applicant record (frame 11). Never deleted; "not moving forward" can be reopened. */
export default function ApplicantPage() {
  const { id } = useParams();
  const meta = useCrmQuery<RecruitMeta>(['crm', 'recruit-meta'], '/recruiting/meta');
  const q = useCrmQuery<{ applicant: Applicant }>(['crm', 'applicant', id], `/recruiting/applicants/${id}`);
  const a = q.data?.applicant;
  useRobbieWhere({ page: 'applicant', label: a?.name });
  const [tab, setTab] = useState<Tab>('notes');
  const [dialog, setDialog] = useState<Dialogs>(null);
  const move = useCrmMutation((stage: string) => crmApi.post(`/recruiting/applicants/${id}/stage`, { stage }), { success: 'Stage updated' });
  const reopen = useCrmMutation(() => crmApi.post(`/recruiting/applicants/${id}/reopen`), { success: 'Reopened' });

  if (q.isLoading) return <CrmPage title="Applicant"><Loading /></CrmPage>;
  if (q.error || !a) return <CrmPage title="Applicant" crumbs={[{ label: 'Recruiting', to: '/crm/recruiting' }]}><ErrorNote error={q.error} /></CrmPage>;
  const can = meta.data?.can;
  const open = !['hired', 'not_moving_forward'].includes(a.stage);
  const flow = ['applied', 'screened', 'interview', 'trial', 'offer'];
  const next = flow[flow.indexOf(a.stage) + 1];

  return (
    <CrmPage
      crumbs={[{ label: 'Recruiting', to: '/crm/recruiting' }, { label: ROLE_LABEL[a.role] + 's', to: '/crm/recruiting' }]}
      title={<span className="flex flex-wrap items-center gap-2">{a.name}<Chip tone={stageTone(a.stage)}>{a.stage_label}</Chip>{a.score !== null && <Chip tone="amber"><Star className="h-3 w-3 fill-current" />{a.score.toFixed(1)}</Chip>}</span>}
      description={[ROLE_LABEL[a.role], [a.city, a.state].filter(Boolean).join(', '), a.posting?.title].filter(Boolean).join(' · ')}
      actions={can?.manage ? <>
        {a.email && <Button variant="outline" size="sm" className="h-8" onClick={() => setDialog('email')}><Mail className="mr-1.5 h-3.5 w-3.5" />Email</Button>}
        {open && <Button variant="outline" size="sm" className="h-8" onClick={() => setDialog('interview')}><CalendarPlus className="mr-1.5 h-3.5 w-3.5" />Interview</Button>}
        {open && next && <Button size="sm" className="h-8" disabled={move.isPending} onClick={() => move.mutate(next)}>Move to {meta.data?.stages.find((s) => s.key === next)?.label}</Button>}
        {a.stage === 'offer' && <Button size="sm" className="h-8" onClick={() => setDialog('hire')}><UserPlus className="mr-1.5 h-3.5 w-3.5" />Hire</Button>}
        {a.stage === 'not_moving_forward' && <Button size="sm" className="h-8" onClick={() => reopen.mutate(undefined)}>Reopen</Button>}
        {open && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" aria-label="More"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="crm-root">
              {flow.filter((s) => s !== a.stage).map((s) => <DropdownMenuItem key={s} onSelect={() => move.mutate(s)}>Move to {meta.data?.stages.find((x) => x.key === s)?.label}</DropdownMenuItem>)}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-rose-600" onSelect={() => setDialog('exit')}>Not moving forward</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </> : undefined}
      tabs={<TabBar<Tab> value={tab} onChange={setTab} tabs={[{ key: 'notes', label: 'Notes and feedback', count: a.notes.length }, { key: 'files', label: 'Documents', count: a.file_count }, { key: 'interviews', label: 'Interviews', count: a.events.length }, { key: 'emails', label: 'Emails', count: a.emails.length }, { key: 'history', label: 'History' }]} />}
    >
      {a.stage === 'not_moving_forward' && <Note tone="bad">Not moving forward: {a.exit_reason}. Their record stays; reopen it any time.</Note>}
      {a.stage === 'hired' && a.hired_user && <Note tone="ok">Hired. Account: {a.hired_user.name}{a.roster?.states.length ? ` · covers ${a.roster.states.join(', ')}` : ''}.</Note>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {tab === 'notes' && <NotesTab applicant={a} canManage={Boolean(can?.manage)} scoreKeys={meta.data?.score_keys ?? []} />}
          {tab === 'files' && <FilesTab applicant={a} canSee={Boolean(can?.documents)} kinds={meta.data?.file_kinds ?? []} />}
          {tab === 'interviews' && (
            <div className="flex flex-col gap-2">
              {a.events.length === 0 && <p className="text-[13px] text-muted-foreground">No interviews scheduled.</p>}
              {a.events.map((e) => <div key={e.id} className="rounded-[10px] border p-3 text-[13px]"><b>{e.type?.label}</b> · {when(e.starts_at)} · <Chip tone={e.status === 'done' ? 'green' : e.status === 'planned' ? 'blue' : 'line'}>{e.status}</Chip>{e.note && <p className="mt-1 text-muted-foreground">{e.note}</p>}{e.outcome_note && <p className="mt-1">{e.outcome_note}</p>}</div>)}
            </div>
          )}
          {tab === 'emails' && (
            <ul className="divide-y rounded-[10px] border">
              {a.emails.length === 0 && <li className="p-3 text-[13px] text-muted-foreground">No emails yet.</li>}
              {a.emails.map((m) => <li key={m.id} className="flex items-center gap-3 p-3 text-[13px]"><span className="min-w-0 flex-1 truncate font-medium">{m.subject}</span><Chip tone={m.status === 'failed' ? 'red' : 'green'}>{m.status === 'logged' ? 'Recorded' : m.status}</Chip><span className="text-xs text-muted-foreground">{ago(m.sent_at ?? m.created_at)}</span></li>)}
            </ul>
          )}
          {tab === 'history' && (
            <ol className="flex flex-col gap-2">
              {[...a.stages].reverse().map((s, i) => <li key={i} className="text-[13px]"><b>{meta.data?.stages.find((x) => x.key === s.to)?.label ?? s.to}</b>{s.reason ? ` · ${s.reason}` : ''} <span className="text-xs text-muted-foreground">· {s.by?.name ?? 'System'} · {when(s.at)}</span></li>)}
            </ol>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <Card title="Details">
            <KeyValues rows={[
              ['Email', a.email ? <a href={`mailto:${a.email}`} className="hover:underline">{a.email}</a> : null],
              ['Phone', a.phone ? <a href={`tel:${a.phone}`} className="hover:underline">{a.phone}</a> : null],
              ['Source', SOURCE_LABEL[a.source] ?? a.source],
              ['Markets', [a.states.join(', '), a.metros].filter(Boolean).join(' · ') || null],
              ['Travel', a.travel_radius ? `${a.travel_radius} miles` : null],
              ['Portfolio', a.portfolio_url ? <a href={a.portfolio_url} target="_blank" rel="noreferrer" className="break-all hover:underline">{a.portfolio_url.replace(/^https?:\/\//, '')}</a> : null],
              ...(a.role === 'photographer' ? [
                ['Specialty', a.specialty ? <span className="capitalize">{a.specialty}</span> : null] as [string, React.ReactNode],
                ['Drone', a.flies_drone ? <span className="flex items-center gap-1"><Plane className="h-3 w-3" />Part 107 {a.part107_number ?? ''}</span> : 'No'] as [string, React.ReactNode],
                ['Licence expires', a.part107_expiry ? day(a.part107_expiry) : null] as [string, React.ReactNode],
                ['Insurance expires', a.insurance_expiry ? day(a.insurance_expiry) : null] as [string, React.ReactNode],
                ['Gear', a.gear.length ? a.gear.join(', ') : null] as [string, React.ReactNode],
              ] : [['Experience', a.sales_experience] as [string, React.ReactNode]]),
              ['Applied', day(a.created_at)],
            ]} />
          </Card>
          {Object.keys(a.scores).length > 0 && (
            <Card title="Average scores">
              <ul className="flex flex-col gap-2">{Object.entries(a.scores).map(([k, v]) => <li key={k} className="flex items-center gap-2 text-[13px]"><span className="w-[110px] text-muted-foreground">{SCORE_LABEL[k] ?? k}</span><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${(v / 5) * 100}%` }} /></span><span className="w-8 text-right tabular-nums">{v.toFixed(1)}</span></li>)}</ul>
            </Card>
          )}
        </div>
      </div>
      <ApplicantDialogs applicant={a} kind={dialog} onClose={() => setDialog(null)} />
    </CrmPage>
  );
}

function NotesTab({ applicant, canManage, scoreKeys }: { applicant: Applicant; canManage: boolean; scoreKeys: string[] }) {
  const [body, setBody] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState(false);
  const add = useCrmMutation(() => crmApi.post(`/recruiting/applicants/${applicant.id}/notes`, { body, scores: feedback ? scores : undefined }), { success: 'Saved' });
  return (
    <div className="flex flex-col gap-3">
      {canManage && (
        <div className="flex flex-col gap-2 rounded-[10px] border p-3">
          <TextArea aria-label="Note" value={body} onChange={(e) => setBody(e.target.value)} placeholder={feedback ? 'How did the interview or trial go?' : 'Add a note'} />
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={feedback} onChange={(e) => setFeedback(e.target.checked)} />Interview feedback with scores</label>
          {feedback && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {scoreKeys.map((k) => (
                <div key={k} className="flex flex-col gap-1" role="radiogroup" aria-label={SCORE_LABEL[k] ?? k}>
                  <span className="text-xs text-muted-foreground">{SCORE_LABEL[k] ?? k}</span>
                  <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={scores[k] === n} aria-label={`${n} of 5`} onClick={() => setScores({ ...scores, [k]: n })}>
                      <Star className={cn('h-4 w-4', (scores[k] ?? 0) >= n ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
                    </button>
                  ))}</div>
                </div>
              ))}
            </div>
          )}
          <Button size="sm" className="self-end" disabled={!body.trim() || add.isPending} onClick={() => add.mutate(undefined, { onSuccess: () => { setBody(''); setScores({}); setFeedback(false); } })}>Save</Button>
        </div>
      )}
      {applicant.notes.map((n) => (
        <article key={n.id} className="rounded-[10px] border p-3">
          <header className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{n.author?.name ?? 'System'}</span>· {when(n.created_at)}{n.kind === 'feedback' && <Chip tone="amber">Feedback</Chip>}</header>
          <p className="whitespace-pre-wrap text-[13px]">{n.body}</p>
          {n.scores && <p className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">{Object.entries(n.scores).map(([k, v]) => <span key={k}>{SCORE_LABEL[k] ?? k}: <b className="text-foreground">{v}</b></span>)}</p>}
        </article>
      ))}
    </div>
  );
}

function FilesTab({ applicant, canSee, kinds }: { applicant: Applicant; canSee: boolean; kinds: string[] }) {
  const [kind, setKind] = useState('resume');
  const [error, setError] = useState<string | null>(null);
  const upload = useCrmMutation((file: File) => { const form = new FormData(); form.append('file', file); form.append('kind', kind); return crmApi.upload(`/recruiting/applicants/${applicant.id}/files`, form); }, { success: 'Uploaded' });
  const open = async (url: string, name: string) => {
    setError(null);
    try {
      const res = await apiClient.get(url.replace(/^\/api/, ''), { responseType: 'blob' });
      const href = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = href; link.download = name; link.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch (e) { setError(toApiError(e).message); }
  };
  if (!canSee) return <Note tone="info">{applicant.file_count} document{applicant.file_count === 1 ? '' : 's'} on file. Ask the super admin for document access to open them.</Note>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Kind">{(fid) => <Select id={fid} value={kind} onChange={(e) => setKind(e.target.value)} options={kinds.map((k) => ({ value: k, label: FILE_LABEL[k] ?? k }))} />}</Field>
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium hover:bg-secondary"><FileUp className="h-3.5 w-3.5" />{upload.isPending ? 'Uploading…' : 'Upload'}
          <input type="file" className="sr-only" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.webp" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
        </label>
        <span className="text-xs text-muted-foreground">Stored privately. Up to 20 MB.</span>
      </div>
      {error && <Note tone="bad">{error}</Note>}
      <ul className="divide-y rounded-[10px] border">
        {(applicant.files ?? []).length === 0 && <li className="p-3 text-[13px] text-muted-foreground">No documents yet.</li>}
        {(applicant.files ?? []).map((f) => (
          <li key={f.id} className="flex items-center gap-3 p-3 text-[13px]">
            <Chip tone="line">{FILE_LABEL[f.kind] ?? f.kind}</Chip>
            <span className="min-w-0 flex-1 truncate">{f.name}</span>
            <span className="text-xs text-muted-foreground">{Math.max(1, Math.round(f.size / 1024))} KB · {ago(f.created_at)}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Download ${f.name}`} onClick={() => void open(f.url, f.name)}><Download className="h-3.5 w-3.5" /></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ApplicantDialogs({ applicant, kind, onClose }: { applicant: Applicant; kind: Dialogs; onClose: () => void }) {
  const { data: types } = useEventTypes();
  const [reason, setReason] = useState('');
  const [when_, setWhen] = useState('');
  const [note, setNote] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('<p>Hi {{first_name}},</p><p></p>');
  const [invite, setInvite] = useState(true);
  const [linkExisting, setLinkExisting] = useState(false);
  const run = useCrmMutation(() => {
    switch (kind) {
      case 'exit': return crmApi.post(`/recruiting/applicants/${applicant.id}/exit`, { reason });
      case 'hire': return crmApi.post(`/recruiting/applicants/${applicant.id}/hire`, { send_invite: invite, link_existing: linkExisting });
      case 'interview': return crmApi.post(`/recruiting/applicants/${applicant.id}/events`, { type_id: types?.data.find((t) => t.key === 'interview')?.id, starts_at: new Date(when_).toISOString(), duration_min: 30, note: note || null });
      case 'email': return crmApi.post(`/recruiting/applicants/${applicant.id}/email`, { subject, body_html: body });
      default: return Promise.resolve(null);
    }
  }, { success: kind === 'hire' ? 'Hired; the account is set up' : 'Done' });
  const titles: Record<Exclude<Dialogs, null>, [string, string]> = {
    exit: ['Not moving forward', 'Their record stays. You can reopen it later.'],
    hire: [`Hire ${applicant.name}`, applicant.role === 'sales_rep' ? 'Creates a sales rep account with access to the CRM.' : 'Creates a photographer account with their states as service areas, their gear pending verification, and licence and insurance dates for reminders.'],
    interview: ['Schedule interview', 'Adds it to your follow-ups and moves them to Interview.'],
    email: [`Email ${applicant.name}`, 'Sent from your approved signature.'],
  };
  const valid = kind === 'exit' ? Boolean(reason.trim()) : kind === 'interview' ? Boolean(when_) : kind === 'email' ? Boolean(subject.trim()) : true;
  return (
    <Dialog open={kind !== null} onOpenChange={(o) => !o && onClose()}>
      {kind && (
        <DialogContent className={cn('crm-root', kind === 'email' ? 'sm:max-w-[640px]' : 'sm:max-w-[460px]')}>
          <DialogHeader><DialogTitle>{titles[kind][0]}</DialogTitle><DialogDescription>{titles[kind][1]}</DialogDescription></DialogHeader>
          {kind === 'exit' && <Field label="Reason" required>{(id) => <TextInput id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Took another job, portfolio not a fit…" />}</Field>}
          {kind === 'interview' && <div className="flex flex-col gap-3"><Field label="When" required>{(id) => <TextInput id={id} type="datetime-local" value={when_} onChange={(e) => setWhen(e.target.value)} />}</Field><Field label="Note">{(id) => <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Video call, portfolio review" />}</Field></div>}
          {kind === 'hire' && (
            <div className="flex flex-col gap-2 text-[13px]">
              {!applicant.email && <Note tone="bad">Add an email address first; it becomes their sign-in.</Note>}
              <label className="flex items-center gap-2"><input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} />Email them a link to set their password</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={linkExisting} onChange={(e) => setLinkExisting(e.target.checked)} />If an account with this email exists, link it</label>
            </div>
          )}
          {kind === 'email' && <div className="flex flex-col gap-3"><Field label="Subject" required>{(id) => <TextInput id={id} value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field><RichText label="Message" value={body} onChange={setBody} /></div>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant={kind === 'exit' ? 'destructive' : 'default'} disabled={!valid || run.isPending || (kind === 'hire' && !applicant.email)} onClick={() => run.mutate(undefined, { onSuccess: onClose })}>{run.isPending ? 'Working…' : kind === 'exit' ? 'Confirm' : kind === 'hire' ? 'Hire' : kind === 'interview' ? 'Schedule' : 'Send'}</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
