import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { crmApi, toApiError } from '../api';
import { useCrmMutation, useCrmQuery } from '../hooks';
import type { ApiError, ContentCheck, EmailTemplate, Proposal, Signature } from '../types';
import { Field, Select, TextInput } from '../ui/fields';
import { Note } from '../ui/primitives';
import { EmailFrame, RichText } from './RichText';

interface ComposeOptions { blocker: string | null; signature: Signature | null; templates: EmailTemplate[]; transport: string }

/**
 * One-off email from an approved template (frame R3). The layout, footer and
 * signature are locked; the subject and body can be adjusted, and edited
 * wording must pass the content check before it can be sent.
 */
export function ComposeEmailDialog({ open, onOpenChange, contactId, contactName, initialTemplateId }: {
  open: boolean; onOpenChange: (open: boolean) => void; contactId: number; contactName: string; initialTemplateId?: number;
}) {
  const options = useCrmQuery<ComposeOptions>(['crm', 'contact', contactId, 'compose'], `/contacts/${contactId}/emails/compose`, undefined, open);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [instruction, setInstruction] = useState('');
  const [preview, setPreview] = useState<{ subject: string; html: string; content_check: ContentCheck | null } | null>(null);
  const [check, setCheck] = useState<ContentCheck | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());

  const template = useMemo(() => options.data?.templates.find((t) => String(t.id) === templateId), [options.data, templateId]);

  useEffect(() => {
    if (!open) { setPreview(null); setCheck(null); setDraftNote(null); setInstruction(''); return; }
    if (options.data && !templateId) {
      const first = options.data.templates.find((t) => t.id === initialTemplateId) ?? options.data.templates[0];
      if (first) setTemplateId(String(first.id));
    }
  }, [open, options.data, templateId, initialTemplateId]);

  useEffect(() => {
    if (template?.approved) { setSubject(template.approved.subject); setBody(template.approved.body_html); setPreview(null); setCheck(null); }
  }, [template]);

  const payload = () => ({ template_id: Number(templateId), subject, body_html: body, idempotency_key: key });

  const runPreview = useCrmMutation(() => crmApi.post<{ subject: string; html: string; content_check: ContentCheck | null }>(`/contacts/${contactId}/emails/preview`, payload()), { invalidate: [] });
  const send = useCrmMutation(() => crmApi.post<{ send: { status: string } }>(`/contacts/${contactId}/emails`, payload()), {
    success: ({ send: result }) => {
      if (result.status === 'logged') return 'Preview recorded. No email was delivered.';
      if (result.status === 'sent') return `Email sent to ${contactName}`;
      return `Delivery status: ${result.status}. Check the contact’s Emails tab.`;
    },
    silentErrors: true,
  });

  const draft = async () => {
    setDrafting(true);
    setDraftNote(null);
    try {
      const res = await crmApi.post<{ drafted: boolean; proposal: Proposal }>(`/robbie/contacts/${contactId}/draft-email`, { template_id: Number(templateId), instruction: instruction || null });
      const p = res.proposal.payload as { subject?: string; body_html?: string };
      if (p.subject) setSubject(p.subject);
      if (p.body_html) setBody(p.body_html);
      setDraftNote(res.drafted ? 'Robbie adjusted the wording for this contact. Review it before sending.' : 'Robbie couldn’t draft right now; the template is unchanged.');
      void crmApi.post(`/robbie/proposals/${res.proposal.id}/dismiss`).catch(() => undefined);
      setPreview(null);
    } catch (e) {
      setDraftNote(toApiError(e).message);
    } finally {
      setDrafting(false);
    }
  };

  const blocker = options.data?.blocker;
  const edited = template?.approved ? subject !== template.approved.subject || body.trim() !== template.approved.body_html.trim() : false;
  const issues = (check ?? preview?.content_check)?.issues ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="crm-root max-h-[94dvh] overflow-y-auto sm:max-w-[960px]">
        <DialogHeader>
          <DialogTitle>Email {contactName}</DialogTitle>
          <DialogDescription>
            {options.data?.signature ? `From ${options.data.signature.fields.name ?? ''} <${options.data.signature.sender_email}>` : 'Sent from your approved signature.'}
            {options.data?.transport === 'log' && ' · Test mode: emails are recorded, not delivered.'}
          </DialogDescription>
        </DialogHeader>

        {blocker && <Note tone="bad" icon={<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}>{blocker}</Note>}
        {options.data && options.data.templates.length === 0 && <Note tone="info">No approved templates yet. An admin approves them under Email → Templates.</Note>}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <Field label="Template">{(id) => <Select id={id} value={templateId} onChange={(e) => setTemplateId(e.target.value)} options={(options.data?.templates ?? []).map((t) => ({ value: String(t.id), label: t.name }))} />}</Field>
            <Field label="Subject">{(id) => <TextInput id={id} value={subject} onChange={(e) => { setSubject(e.target.value); setPreview(null); }} />}</Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">Message</span>
              <RichText label="Message" value={body} onChange={(html) => { setBody(html); setPreview(null); }} />
            </div>
            <div className="rounded-[10px] border crm-bg-thead p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><Sparkles className="h-3.5 w-3.5 text-primary" />Draft with Robbie</p>
              <div className="flex gap-2">
                <TextInput aria-label="What should Robbie mention?" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. mention spring listings and twilight shoots" />
                <Button variant="outline" size="sm" className="h-8 shrink-0" disabled={drafting || !templateId} onClick={() => void draft()}>{drafting ? 'Drafting…' : 'Draft'}</Button>
              </div>
              {draftNote && <p className="mt-2 text-xs text-muted-foreground">{draftNote}</p>}
            </div>
            {edited && <p className="text-xs text-muted-foreground">You changed the template’s wording, so it is checked for claims before sending.</p>}
            {issues.length > 0 && (
              <Note tone="warn" icon={<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}>
                <p className="font-medium">Fix this wording before sending:</p>
                <ul className="mt-1 list-disc pl-4">{issues.map((i, n) => <li key={n}>{i.quote ? <>“{i.quote}”: </> : null}{i.message}</li>)}</ul>
              </Note>
            )}
            {send.error && !send.error.content_check && <Note tone="bad">{send.error.message}</Note>}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Preview</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={!templateId || runPreview.isPending} onClick={() => runPreview.mutate(undefined, { onSuccess: (p) => { setPreview(p); setCheck(p.content_check); } })}>
                <Eye className="mr-1 h-3.5 w-3.5" />{runPreview.isPending ? 'Rendering…' : preview ? 'Refresh' : 'Show preview'}
              </Button>
            </div>
            {preview ? <EmailFrame html={preview.html} title="Email preview" /> : (
              <div className="flex h-[520px] items-center justify-center rounded-[10px] border border-dashed text-center text-xs text-muted-foreground">Preview shows the locked layout, your signature and the unsubscribe footer.</div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={Boolean(blocker) || !templateId || send.isPending} onClick={() => send.mutate(undefined, {
            onSuccess: () => { setKey(crypto.randomUUID()); setTemplateId(''); onOpenChange(false); },
            onError: (e: ApiError) => { if (e.content_check) setCheck(e.content_check); },
          })}>
            <Send className="mr-1.5 h-3.5 w-3.5" />{send.isPending ? 'Working…' : options.data?.transport === 'log' ? 'Record preview' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
