import { useState, type ReactNode } from 'react';
import { ArrowLeft, CalendarClock, Eye, EyeOff, Send, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { EmailComposeViewProps } from './EmailComposeView';
import { bodyTextToHtml } from './emailComposeModel';
import { ComposeFiles, ComposeRobbie, ComposeVariables } from './composeDeskParts';

export function EmailComposeMobile({ scheduleDialog, ...props }: EmailComposeViewProps & { scheduleDialog: ReactNode }) {
  const {
    currentMode, navigate, canSendExternal, setPreviewMode, previewMode, setShowScheduleDialog,
    resetCompose, handleSendNow, sendMutation, scheduleMutation, isMissingRequiredShootContext,
    isInternalReply, setPriority, priority, showCcBcc, setShowCcBcc, renderRecipientField, form,
    setFormValue, setTemplateCustomized, templates, setForm, applyTemplate, isLoadingContactShoots,
    contactShootOptions, channels, previewBodyHtml, originalMessage, fileInputRef, attachFiles,
    attachments, setAttachments, draftAttachments, setDraftAttachments, templateSuggestions,
    parsedVariables, variableJsonError, templatePreviewData, messageInfo,
  } = props;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const writeBody = (value: string) => {
    setForm((prev) => ({ ...prev, body_text: value, body_html: bodyTextToHtml(value) }));
    setTemplateCustomized(true);
  };

  return (
    <DashboardLayout>
      <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
        <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border/70 px-1">
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="Back to inbox" onClick={() => navigate('/messaging/email/inbox')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <p className="min-w-0 flex-1 truncate text-base font-semibold">{currentMode.title}</p>
          <Button type="button" variant="ghost" className="h-11" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(true)}>Details</Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!canSendExternal && (
            <div className="space-y-3 border-b border-border/70 px-4 py-3">
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
                    className={cn('h-11 rounded-lg border text-sm font-medium', form.related_shoot_context_type === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')}
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
            </div>
          )}

          {canSendExternal && (
            <div className="border-b border-border/70">
              <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-2 px-4 py-2">
                <span className="text-sm text-muted-foreground">To</span>
                {renderRecipientField('to', 'To', '', true)}
                <span />
                <button type="button" className="h-11 justify-self-end text-sm font-medium text-primary" onClick={() => setShowCcBcc((open) => !open)}>
                  {showCcBcc ? 'Hide Cc / Bcc' : 'Add Cc / Bcc'}
                </button>
              </div>
              {showCcBcc && (
                <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2 border-t border-border/50 px-4 py-2">
                  <span className="text-sm text-muted-foreground">Cc</span>
                  {renderRecipientField('cc', 'Cc', '')}
                </div>
              )}
              {showCcBcc && (
                <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2 border-t border-border/50 px-4 py-2">
                  <span className="text-sm text-muted-foreground">Bcc</span>
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
              className="h-14 border-0 px-0 text-lg shadow-none focus-visible:ring-0"
            />
          </div>

          {previewMode ? (
            <div className="min-h-[40vh] px-4 py-3">
              {previewBodyHtml ? <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: previewBodyHtml }} /> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}
            </div>
          ) : (
            <Textarea
              id="compose-body"
              aria-label="Message"
              value={form.body_text}
              onChange={(event) => writeBody(event.target.value)}
              placeholder="Write your message"
              className="min-h-[40vh] resize-none rounded-none border-0 px-4 py-3 text-base shadow-none focus-visible:ring-0"
            />
          )}

          {originalMessage && (
            <p className="px-4 py-2 text-sm text-muted-foreground">
              Original · {originalMessage.from_address || 'unknown sender'}
              {originalMessage.subject ? ` · ${originalMessage.subject}` : ''}
            </p>
          )}
        </div>

        {canSendExternal && (
          <ComposeRobbie
            body={form.body_text}
            subject={form.subject}
            variables={parsedVariables}
            onBody={writeBody}
            onSubject={(value) => { setFormValue('subject', value); setTemplateCustomized(true); }}
          />
        )}

        <div className="flex shrink-0 items-center gap-1 border-t border-border/70 px-2 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          {canSendExternal && (
            <Button type="button" variant="ghost" className="h-11 px-2" aria-label={previewMode ? 'Edit message' : 'Preview message'} onClick={() => setPreviewMode((value) => !value)}>
              {previewMode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
          )}
          {canSendExternal && (
            <Button type="button" variant="ghost" className="h-11 px-2" aria-label="Schedule send" onClick={() => setShowScheduleDialog(true)}>
              <CalendarClock className="h-5 w-5" />
            </Button>
          )}
          <Button type="button" variant="ghost" className="h-11 px-2" aria-label="Discard" onClick={resetCompose}>
            <Trash2 className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            className="ml-auto h-11 rounded-full px-4"
            aria-label={currentMode.sendLabel}
            onClick={handleSendNow}
            disabled={sendMutation.isPending || scheduleMutation.isPending || isMissingRequiredShootContext}
          >
            <Send className="h-4 w-4" />
            {sendMutation.isPending ? 'Sending' : 'Send'}
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { attachFiles(event.target.files); event.target.value = ''; }} />
        </div>
      </div>

      {detailsOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Details</h2>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setDetailsOpen(false)}>Done</Button>
          </div>
          <div className="space-y-6">
            {canSendExternal && (
              <div className="grid grid-cols-3 gap-2">
                {(['normal', 'high', 'urgent'] as const).map((level) => (
                  <button key={level} type="button" onClick={() => setPriority(level)} className={cn('h-11 rounded-lg border text-sm font-medium capitalize', priority === level ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')}>{level}</button>
                ))}
              </div>
            )}
            {canSendExternal && (
              <Select value={form.template_id || '__none__'} onValueChange={(value) => value === '__none__' ? setForm((prev) => ({ ...prev, template_id: '' })) : applyTemplate(value)}>
                <SelectTrigger aria-label="Template" className="h-11"><SelectValue placeholder="Template" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No template</SelectItem>
                  {templates.map((template) => <SelectItem key={template.id} value={String(template.id)}>{template.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {canSendExternal && templatePreviewData?.missing_variables?.length ? (
              <p className="text-sm text-amber-600">{templatePreviewData.missing_variables.length} variables still empty</p>
            ) : null}
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
                  writeBody(form.body_text.slice(0, start) + token + form.body_text.slice(endIndex(field, start)));
                  setDetailsOpen(false);
                }}
              />
            )}
            {canSendExternal && channels.length > 0 && (
              <div className="space-y-2">
                <Label>Sender</Label>
                <Select value={form.channel_id} onValueChange={(value) => setFormValue('channel_id', value)}>
                  <SelectTrigger aria-label="Sender" className="h-11"><SelectValue placeholder="Sender" /></SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => <SelectItem key={channel.id} value={String(channel.id)}>{channel.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Label htmlFor="compose-reply-to-mobile">Reply-To</Label>
                <Input id="compose-reply-to-mobile" className="h-11" value={form.reply_to} onChange={(event) => setFormValue('reply_to', event.target.value)} placeholder="reply@company.com" />
              </div>
            )}
            {canSendExternal && (
              <div className="space-y-2">
                <Label htmlFor="compose-shoot-id-mobile">Shoot ID</Label>
                <Input id="compose-shoot-id-mobile" className="h-11" value={form.related_shoot_id} onChange={(event) => setFormValue('related_shoot_id', event.target.value)} />
                <Label htmlFor="compose-account-id-mobile">Account ID</Label>
                <Input id="compose-account-id-mobile" className="h-11" value={form.related_account_id} onChange={(event) => setFormValue('related_account_id', event.target.value)} />
                <Label htmlFor="compose-invoice-id-mobile">Invoice ID</Label>
                <Input id="compose-invoice-id-mobile" className="h-11" value={form.related_invoice_id} onChange={(event) => setFormValue('related_invoice_id', event.target.value)} />
              </div>
            )}
            <ComposeFiles
              attachments={attachments}
              draftAttachments={draftAttachments}
              onAdd={() => fileInputRef.current?.click()}
              onRemove={(file) => setAttachments((prev) => prev.filter((item) => item !== file))}
              onRemoveDraft={(file) => setDraftAttachments((prev) => prev.filter((item) => item !== file))}
            />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p>Recipients <span className="font-medium">{messageInfo.recipients}</span></p>
              <p>Attachments <span className="font-medium">{messageInfo.attachments}</span></p>
              <p>Words <span className="font-medium">{messageInfo.words}</span></p>
              <p>Characters <span className="font-medium">{messageInfo.characters}</span></p>
            </div>
          </div>
        </div>
      )}
      {scheduleDialog}
    </DashboardLayout>
  );
}

function endIndex(field: HTMLTextAreaElement | null, start: number) {
  return field?.selectionEnd ?? start;
}
