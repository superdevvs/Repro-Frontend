import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { crmApi } from '../../api';
import { useCrmMeta, useCrmMutation, useCrmQuery } from '../../hooks';
import { when } from '../../format';
import type { Signature } from '../../types';
import { Field, TextInput } from '../../ui/fields';
import { Card, Chip, Empty, Loading, Note } from '../../ui/primitives';

interface Mine { latest: Signature | null; approved: Signature | null; send_blocker: string | null; defaults: { name: string; email: string; phone: string | null }; sender_domain: string }

/** Your signature, and (for the super admin) signatures waiting for approval. Frame 09. */
export function SignaturesTab() {
  const { data: meta } = useCrmMeta();
  const mine = useCrmQuery<Mine>(['crm', 'signature', 'me'], '/signatures/me');
  const pending = useCrmQuery<{ data: (Signature & { change?: string[] })[] }>(['crm', 'signatures', 'pending'], '/signatures/pending', undefined, Boolean(meta?.can.approve_signatures));
  const [form, setForm] = useState({ name: '', title: '', phone: '', sender_email: '' });
  const [comment, setComment] = useState<Record<number, string>>({});

  useEffect(() => {
    const d = mine.data;
    if (!d) return;
    const f = d.latest?.fields ?? {};
    setForm({ name: f.name ?? d.defaults.name, title: f.title ?? '', phone: f.phone ?? d.defaults.phone ?? '', sender_email: d.latest?.sender_email ?? (d.defaults.email.endsWith(`@${d.sender_domain}`) ? d.defaults.email : '') });
  }, [mine.data]);

  const submit = useCrmMutation(() => crmApi.post('/signatures/me', form), { success: 'Sent for approval' });
  const approve = useCrmMutation((id: number) => crmApi.post(`/signatures/${id}/approve`), { success: 'Signature approved' });
  const reject = useCrmMutation((id: number) => crmApi.post(`/signatures/${id}/reject`, { comment: comment[id] }), { success: 'Sent back' });

  if (mine.isLoading) return <Loading />;
  const d = mine.data;
  const domain = d?.sender_domain ?? 'reprophotos.com';
  const validSender = form.sender_email.toLowerCase().endsWith(`@${domain}`);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Your signature" actions={d?.latest ? <Chip tone={d.latest.status === 'approved' ? 'green' : d.latest.status === 'rejected' ? 'red' : 'amber'}>{d.latest.status === 'approved' ? 'Approved' : d.latest.status === 'rejected' ? 'Changes requested' : 'Waiting for approval'}</Chip> : undefined}>
        <div className="flex flex-col gap-3">
          {d?.send_blocker && <Note tone="warn">{d.send_blocker}</Note>}
          {d?.latest?.status === 'rejected' && d.latest.review_comment && <Note tone="bad">{d.latest.reviewed_by?.name}: {d.latest.review_comment}</Note>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required>{(id) => <TextInput id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label="Title">{(id) => <TextInput id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Account manager" />}</Field>
            <Field label="Phone">{(id) => <TextInput id={id} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}</Field>
            <Field label="Send from" required error={form.sender_email && !validSender ? `Must be an @${domain} address.` : null}>{(id, desc) => <TextInput id={id} aria-describedby={desc} type="email" value={form.sender_email} onChange={(e) => setForm({ ...form, sender_email: e.target.value })} placeholder={`you@${domain}`} />}</Field>
          </div>
          <p className="text-xs text-muted-foreground">The super admin approves every signature and every change. You can keep sending from your approved one while a change waits.</p>
          <Button className="self-start" size="sm" disabled={!form.name.trim() || !validSender || submit.isPending} onClick={() => submit.mutate(undefined)}>Submit for approval</Button>
          {(d?.approved ?? d?.latest) && (
            <div className="rounded-[10px] border p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{d?.approved ? 'Approved signature' : 'Submitted signature'}</p>
              <div className="rounded-lg bg-white p-3 text-[#0f1a26]" dangerouslySetInnerHTML={{ __html: (d.approved ?? d.latest)!.html }} />
            </div>
          )}
        </div>
      </Card>

      {meta?.can.approve_signatures && (
        <Card title="Waiting for your approval" bodyClassName="p-0">
          {pending.isLoading && <Loading />}
          {pending.data?.data.length === 0 && <Empty title="No signatures waiting." />}
          <ul className="divide-y">
            {pending.data?.data.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 p-4">
                <p className="text-[13px]"><b>{s.user?.name}</b> · {s.sender_email} · v{s.version} · {when(s.submitted_at)}</p>
                {s.change && s.change.length > 0 && <p className="text-xs text-muted-foreground">Changed: {s.change.join(', ')}</p>}
                <div className="rounded-lg border bg-white p-3 text-[#0f1a26]" dangerouslySetInnerHTML={{ __html: s.html }} />
                <div className="flex flex-wrap gap-2">
                  <TextInput aria-label={`Comment for ${s.user?.name}`} className="min-w-[200px] flex-1" placeholder="Comment (needed to send back)" value={comment[s.id] ?? ''} onChange={(e) => setComment({ ...comment, [s.id]: e.target.value })} />
                  <Button size="sm" variant="outline" className="h-8" disabled={!comment[s.id]?.trim() || reject.isPending} onClick={() => reject.mutate(s.id)}><X className="mr-1 h-3.5 w-3.5" />Send back</Button>
                  <Button size="sm" className="h-8" disabled={approve.isPending} onClick={() => approve.mutate(s.id)}><Check className="mr-1 h-3.5 w-3.5" />Approve</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
