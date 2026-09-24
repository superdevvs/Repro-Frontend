import type { ReactNode } from 'react';
import { ArrowLeft, CalendarClock, Eye, EyeOff, Send, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { EmailComposeViewProps } from './EmailComposeView';
import { bodyTextToHtml } from './emailComposeModel';
import { ComposeFiles, ComposeRobbie, ComposeVariables } from './composeDeskParts';

export function EmailComposeDesk({ scheduleDialog, ...props }: EmailComposeViewProps & { scheduleDialog: ReactNode }) {
  const {
    lastSaved, draftAttachments, templatePreviewData, navigate, canSendExternal, setPreviewMode, previewMode,
    setShowScheduleDialog, resetCompose, handleSendNow, sendMutation, scheduleMutation, isMissingRequiredShootContext,
    setPriority, priority, showCcBcc, setShowCcBcc, renderRecipientField, form, setFormValue,
    setTemplateCustomized, templates, setForm, applyTemplate, isLoadingContactShoots, contactShootOptions, channels,
    selectedTemplate, previewBodyHtml, originalMessage, fileInputRef, attachFiles, attachments, setAttachments,
    setDraftAttachments, templateSuggestions, parsedVariables, variableJsonError, messageInfo, currentMode,
  } = props;

  const writeBody = (value: string) => {
    setForm((prev) => ({ ...prev, body_text: value, body_html: bodyTextToHtml(value) }));
    setTemplateCustomized(true);
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col bg-background">
        <EmailNavigation />
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_26rem]">
          <div className="flex min-h-0 min-w-0 flex-col border-r border-border/70">
            <div className="flex items-center justify-between px-4 py-2 text-sm text-muted-foreground">
              <Button type="button" variant="ghost" className="h-11 px-2" aria-label="Back to inbox" onClick={() => navigate('/messaging/email/inbox')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Inbox
              </Button>
              <span>Draft {lastSaved ? `saved ${lastSaved.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'not saved yet'}</span>
            </div>
            {!canSendExternal && (
              <div className="space-y-3 border-b border-border/70 px-4 py-3">
                <ShootContext {...props} />
              </div>
            )}
            {canSendExternal && (
              <div className="border-b border-border/70">
                <div className="flex items-center gap-3 px-4 py-2">
                  <span className="w-14 text-sm text-muted-foreground">To</span>
                  {renderRecipientField('to', 'To', '', true)}
                  <button type="button" className="h-11 shrink-0 text-sm text-muted-foreground" onClick={() => setShowCcBcc((open) => !open)}>
                    {showCcBcc ? 'Hide Cc / Bcc' : 'Add Cc / Bcc'}
                  </button>
                </div>
                {showCcBcc && (
                  <div className="flex items-center gap-3 border-t border-border/50 px-4 py-2">
                    <span className="w-14 text-sm text-muted-foreground">Cc</span>
                    {renderRecipientField('cc', 'Cc', '')}
                  </div>
                )}
                {showCcBcc && (
                  <div className="flex items-center gap-3 border-t border-border/50 px-4 py-2">
                    <span className="w-14 text-sm text-muted-foreground">Bcc</span>
                    {renderRecipientField('bcc', 'Bcc', '')}
                  </div>
                )}
              </div>
            )}
            <div className="border-b border-border/70 px-4">
              <Input
                id="compose-subject"
                aria-label="Subject"
                value={form.subject}
                onChange={(event) => { setFormValue('subject', event.target.value); setTemplateCustomized(true); }}
                placeholder="Subject"
                className="h-16 border-0 px-0 text-xl shadow-none focus-visible:ring-0"
              />
            </div>
            {previewMode ? (
              <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
                {previewBodyHtml ? <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: previewBodyHtml }} /> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}
              </div>
            ) : (
              <Textarea
                id="compose-body"
                aria-label="Message"
                value={form.body_text}
                onChange={(event) => writeBody(event.target.value)}
                placeholder="Write your message"
                className="min-h-0 flex-1 resize-none rounded-none border-0 px-4 py-3 shadow-none focus-visible:ring-0"
              />
            )}
            {originalMessage && (
              <p className="px-4 py-2 text-xs text-muted-foreground">
                Original message · {originalMessage.from_address || 'unknown sender'}
                {originalMessage.subject ? ` · ${originalMessage.subject}` : ''}
              </p>
            )}
            {canSendExternal && (
              <ComposeRobbie
                body={form.body_text}
                subject={form.subject}
                variables={parsedVariables}
                onBody={writeBody}
                onSubject={(value) => { setFormValue('subject', value); setTemplateCustomized(true); }}
              />
            )}
            <div className="flex items-center gap-1 border-t border-border/70 px-3 py-2">
              {canSendExternal && (
                <Button type="button" variant="ghost" onClick={() => setPreviewMode((value) => !value)}>
                  {previewMode ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                  {previewMode ? 'Edit' : 'Preview'}
                </Button>
              )}
              {canSendExternal && (
                <Button type="button" variant="ghost" onClick={() => setShowScheduleDialog(true)}>
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Schedule
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={resetCompose}>
                <Trash2 className="mr-2 h-4 w-4" />
                Discard
              </Button>
              <Button type="button" className="ml-auto rounded-full" aria-label={currentMode.sendLabel} onClick={handleSendNow} disabled={sendMutation.isPending || scheduleMutation.isPending || isMissingRequiredShootContext}>
                <Send className="mr-2 h-4 w-4" />
                {sendMutation.isPending ? 'Sending' : 'Send'}
              </Button>
            </div>
          </div>
          <aside className="min-h-0 space-y-5 overflow-y-auto px-4 py-4">
            {canSendExternal && (
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Priority</h3>
                <div className="inline-flex rounded-full border border-border/70 p-1">
                  {(['normal', 'high', 'urgent'] as const).map((level) => (
                    <button key={level} type="button" onClick={() => setPriority(level)} className={cn('rounded-full px-3 py-1 text-xs capitalize', priority === level ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{level}</button>
                  ))}
                </div>
              </div>
            )}
            {canSendExternal && (
              <div className="space-y-2">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Template</h3>
                <Select value={form.template_id || '__none__'} onValueChange={(value) => value === '__none__' ? setForm((prev) => ({ ...prev, template_id: '' })) : applyTemplate(value)}>
                  <SelectTrigger aria-label="Template"><SelectValue placeholder="No template" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No template</SelectItem>
                    {templates.map((template) => <SelectItem key={template.id} value={String(template.id)}>{template.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {selectedTemplate?.description ? <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p> : null}
                {templatePreviewData?.missing_variables?.length ? <p className="text-xs text-amber-600">{templatePreviewData.missing_variables.length} variables still empty</p> : null}
              </div>
            )}
            {canSendExternal && (
              <ComposeVariables
                suggestions={templateSuggestions}
                variables={parsedVariables}
                missing={templatePreviewData?.missing_variables ?? []}
                json={form.variables}
                jsonError={variableJsonError}
                onJson={(value) => setFormValue('variables', value)}
                onInsert={(name) => {
                  const token = `{{${name}}}`;
                  const field = document.getElementById('compose-body') as HTMLTextAreaElement | null;
                  const start = field?.selectionStart ?? form.body_text.length;
                  const end = field?.selectionEnd ?? start;
                  writeBody(form.body_text.slice(0, start) + token + form.body_text.slice(end));
                }}
              />
            )}
            {canSendExternal && (
              <div className="space-y-2">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Sender channel</h3>
                <Select value={form.channel_id} onValueChange={(value) => setFormValue('channel_id', value)}>
                  <SelectTrigger aria-label="Sender channel"><SelectValue placeholder="Select sender" /></SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={String(channel.id)}>{channel.display_name}{channel.from_email ? ` · ${channel.from_email}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label htmlFor="compose-reply-to">Reply-To</Label>
                <Input id="compose-reply-to" value={form.reply_to} onChange={(event) => setFormValue('reply_to', event.target.value)} placeholder="reply@company.com" />
              </div>
            )}
            {canSendExternal && (
              <div className="grid grid-cols-3 gap-2">
                <Field label="Shoot ID" id="compose-shoot-id" value={form.related_shoot_id} onChange={(value) => setFormValue('related_shoot_id', value)} />
                <Field label="Account ID" id="compose-account-id" value={form.related_account_id} onChange={(value) => setFormValue('related_account_id', value)} />
                <Field label="Invoice ID" id="compose-invoice-id" value={form.related_invoice_id} onChange={(value) => setFormValue('related_invoice_id', value)} />
              </div>
            )}
            <ComposeFiles
              attachments={attachments}
              draftAttachments={draftAttachments}
              onAdd={() => fileInputRef.current?.click()}
              onRemove={(file) => setAttachments((prev) => prev.filter((item) => item !== file))}
              onRemoveDraft={(file) => setDraftAttachments((prev) => prev.filter((item) => item !== file))}
            />
            <div className="space-y-2">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Send summary</h3>
              <div className="grid grid-cols-4 gap-2">
                <Stat label="Recipients" value={messageInfo.recipients} />
                <Stat label="Attachments" value={messageInfo.attachments} />
                <Stat label="Words" value={messageInfo.words} />
                <Stat label="Characters" value={messageInfo.characters} />
              </div>
            </div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { attachFiles(event.target.files); event.target.value = ''; }} />
          </aside>
        </div>
      </div>
      {scheduleDialog}
    </DashboardLayout>
  );
}

function Field({ label, id, value, onChange }: { label: string; id: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 text-xs text-muted-foreground" htmlFor={id}>
      {label}
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1" />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-medium">{value}</p>
    </div>
  );
}

function ShootContext({ form, setForm, setFormValue, isInternalReply, isLoadingContactShoots, contactShootOptions }: EmailComposeViewProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {([
          ['new_shoot', 'New shoot'],
          ['previous_shoot', 'Previous'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={isInternalReply}
            onClick={() => setForm((prev) => ({ ...prev, related_shoot_context_type: value, related_shoot_id: prev.related_shoot_context_type === value ? prev.related_shoot_id : '' }))}
            className={cn('h-11 rounded-lg border text-sm', form.related_shoot_context_type === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')}
          >
            {label}
          </button>
        ))}
      </div>
      <Select value={form.related_shoot_id || '__none__'} onValueChange={(value) => setFormValue('related_shoot_id', value === '__none__' ? '' : value)} disabled={isInternalReply || !form.related_shoot_context_type || isLoadingContactShoots}>
        <SelectTrigger className="h-11"><SelectValue placeholder={isLoadingContactShoots ? 'Loading shoots...' : 'Select a shoot'} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">No shoot selected</SelectItem>
          {contactShootOptions.map((shoot) => <SelectItem key={shoot.id} value={shoot.id}>{shoot.dateLabel ? `${shoot.label} • ${shoot.dateLabel}` : shoot.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </>
  );
}
