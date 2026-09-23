import { useState, type ReactNode } from 'react';
import { ArrowLeft, CalendarClock, Eye, EyeOff, MoreHorizontal, Paperclip, Send, Trash2, X } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { EmailComposeViewProps } from './EmailComposeView';
import { bodyTextToHtml } from './emailComposeModel';

export function EmailComposeMobile({ scheduleDialog, ...props }: EmailComposeViewProps & { scheduleDialog: ReactNode }) {
  const {
    currentMode, draftAttachments, navigate, canSendExternal, setPreviewMode, previewMode,
    setShowScheduleDialog, resetCompose, handleSendNow, sendMutation, scheduleMutation,
    isMissingRequiredShootContext, isInternalReply, setPriority, priority, showCcBcc,
    setShowCcBcc, renderRecipientField, form, setFormValue, setTemplateCustomized, templates,
    setForm, applyTemplate, isLoadingContactShoots, contactShootOptions, channels, previewBodyHtml,
    originalMessage, fileInputRef, attachFiles, attachments, setAttachments, templateSuggestions,
    parsedVariables, variableJsonError, templatePreviewData,
  } = props;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const attachmentCount = attachments.length + draftAttachments.length;

  return (
      <DashboardLayout>
        <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
          <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border/70 px-1">
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="Back to inbox" onClick={() => navigate('/messaging/email/inbox')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <p className="min-w-0 flex-1 truncate text-base font-semibold">{currentMode.title}</p>
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
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          related_shoot_context_type: value,
                          related_shoot_id: prev.related_shoot_context_type === value ? prev.related_shoot_id : '',
                        }));
                      }}
                      className={cn(
                        'h-11 rounded-lg border text-sm font-medium',
                        form.related_shoot_context_type === value
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Select
                  value={form.related_shoot_id || '__none__'}
                  onValueChange={(value) => setFormValue('related_shoot_id', value === '__none__' ? '' : value)}
                  disabled={isInternalReply || !form.related_shoot_context_type || isLoadingContactShoots}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={isLoadingContactShoots ? 'Loading shoots...' : 'Select a shoot'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No shoot selected</SelectItem>
                    {contactShootOptions.map((shoot) => (
                      <SelectItem key={shoot.id} value={shoot.id}>
                        {shoot.dateLabel ? `${shoot.label} • ${shoot.dateLabel}` : shoot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {canSendExternal && (
              <div className="border-b border-border/70">
                <div className="flex items-start gap-3 px-4 py-2">
                  <span className="pt-2 text-sm text-muted-foreground">To</span>
                  {renderRecipientField('to', 'To', '', true)}
                  <button type="button" className="shrink-0 pt-2 text-sm font-medium text-primary" onClick={() => setShowCcBcc((open) => !open)}>
                    {showCcBcc ? 'Hide' : 'Cc'}
                  </button>
                </div>
                {showCcBcc && (
                  <div className="flex items-start gap-3 border-t border-border/50 px-4 py-2">
                    <span className="w-6 pt-2 text-sm text-muted-foreground">Cc</span>
                    {renderRecipientField('cc', 'Cc', '')}
                  </div>
                )}
                {showCcBcc && (
                  <div className="flex items-start gap-3 border-t border-border/50 px-4 py-2">
                    <span className="w-6 pt-2 text-sm text-muted-foreground">Bcc</span>
                    {renderRecipientField('bcc', 'Bcc', '')}
                  </div>
                )}
              </div>
            )}

            <div className="border-b border-border/70 px-4">
              <Input
                id="compose-subject"
                value={form.subject}
                onChange={(event) => {
                  setFormValue('subject', event.target.value);
                  setTemplateCustomized(true);
                }}
                placeholder="Subject"
                aria-label="Subject"
                className="h-12 border-0 px-0 shadow-none focus-visible:ring-0"
              />
            </div>

            {canSendExternal && (
              <div className="flex items-center gap-3 border-b border-border/70 px-4">
                <span className="shrink-0 text-sm text-muted-foreground">Template</span>
                <Select
                  value={form.template_id || '__none__'}
                  onValueChange={(value) => {
                    if (value === '__none__') {
                      setForm((prev) => ({ ...prev, template_id: '' }));
                      return;
                    }
                    applyTemplate(value);
                  }}
                >
                  <SelectTrigger aria-label="Template" className="h-12 flex-1 border-0 px-0 shadow-none focus:ring-0">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No template</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>{template.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {previewMode ? (
              <div className="min-h-[45vh] px-4 py-3">
                {previewBodyHtml ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: previewBodyHtml }} />
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                )}
              </div>
            ) : (
              <Textarea
                id="compose-body"
                value={form.body_text}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((prev) => ({
                    ...prev,
                    body_text: value,
                    body_html: bodyTextToHtml(value),
                  }));
                  setTemplateCustomized(true);
                }}
                placeholder="Write your message"
                aria-label="Message"
                className="min-h-[45vh] resize-none rounded-none border-0 px-4 py-3 shadow-none focus-visible:ring-0"
              />
            )}

            {(attachmentCount > 0 || originalMessage) && (
              <div className="space-y-2 px-4 pb-4">
                {attachments.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{file.name}</span>
                    <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments((prev) => prev.filter((item) => item !== file))}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {draftAttachments.map((file) => (
                  <p key={`draft-${file.name}-${file.size}`} className="text-sm text-amber-600">
                    {file.name} needs to be attached again
                  </p>
                ))}
                {originalMessage && (
                  <p className="text-sm text-muted-foreground">
                    Replying to {originalMessage.from_address || 'unknown sender'}
                    {originalMessage.subject ? `: ${originalMessage.subject}` : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 border-t border-border/70 px-2 py-1">
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="Attach files" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-5 w-5" />
            </Button>
            {attachmentCount > 0 && <span className="text-xs text-muted-foreground">{attachmentCount}</span>}
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={previewMode ? 'Edit message' : 'Preview message'} onClick={() => setPreviewMode((prev) => !prev)}>
              {previewMode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
            {canSendExternal && (
              <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="Schedule send" onClick={() => setShowScheduleDialog(true)}>
                <CalendarClock className="h-5 w-5" />
              </Button>
            )}
            <Button type="button" variant="ghost" className="h-11 px-3" aria-label="Templates and options" onClick={() => setOptionsOpen(true)}>
              <MoreHorizontal className="h-5 w-5" />
              Options
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
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                attachFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </div>
        </div>

        <Dialog open={optionsOpen} onOpenChange={setOptionsOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Message options</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {canSendExternal && (
                <div className="grid grid-cols-3 gap-2">
                  {(['normal', 'high', 'urgent'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setPriority(level)}
                      className={cn(
                        'h-11 rounded-lg border text-sm font-medium capitalize',
                        priority === level ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground',
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              )}
              {canSendExternal && (
                <Select
                  value={form.template_id || '__none__'}
                  onValueChange={(value) => {
                    if (value === '__none__') {
                      setForm((prev) => ({ ...prev, template_id: '' }));
                      return;
                    }
                    applyTemplate(value);
                  }}
                >
                  <SelectTrigger aria-label="Template"><SelectValue placeholder="Template" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No template</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>{template.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {canSendExternal && channels.length > 0 && (
                <Select value={form.channel_id} onValueChange={(value) => setFormValue('channel_id', value)}>
                  <SelectTrigger aria-label="Sender"><SelectValue placeholder="Sender" /></SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={String(channel.id)}>
                        {channel.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {canSendExternal && (
                <div className="space-y-2">
                  <Label htmlFor="compose-reply-to-mobile">Reply-To</Label>
                  <Input id="compose-reply-to-mobile" value={form.reply_to} onChange={(event) => setFormValue('reply_to', event.target.value)} placeholder="reply@company.com" />
                  <Label htmlFor="compose-shoot-id-mobile">Shoot ID</Label>
                  <Input id="compose-shoot-id-mobile" value={form.related_shoot_id} onChange={(event) => setFormValue('related_shoot_id', event.target.value)} placeholder="Enter shoot ID" />
                  <Label htmlFor="compose-account-id-mobile">Account ID</Label>
                  <Input id="compose-account-id-mobile" value={form.related_account_id} onChange={(event) => setFormValue('related_account_id', event.target.value)} placeholder="Enter account ID" />
                  <Label htmlFor="compose-invoice-id-mobile">Invoice ID</Label>
                  <Input id="compose-invoice-id-mobile" value={form.related_invoice_id} onChange={(event) => setFormValue('related_invoice_id', event.target.value)} placeholder="Enter invoice ID" />
                  {templateSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {templateSuggestions.map((entry) => (
                        <button
                          key={entry.name}
                          type="button"
                          className="rounded-full border border-border px-3 py-1.5 text-xs"
                          onClick={() => {
                            const current = parsedVariables ?? {};
                            const next = { ...current, [entry.name]: current[entry.name] ?? '' };
                            setFormValue('variables', JSON.stringify(next, null, 2));
                          }}
                        >
                          {`{{${entry.name}}}`}
                        </button>
                      ))}
                    </div>
                  )}
                  <Label htmlFor="compose-variables-mobile">Template variables</Label>
                  <Textarea id="compose-variables-mobile" value={form.variables} onChange={(event) => setFormValue('variables', event.target.value)} className="min-h-28" />
                  {variableJsonError && <p className="text-xs text-amber-600">{variableJsonError}</p>}
                  {templatePreviewData?.missing_variables?.length ? (
                    <p className="text-xs text-amber-600">
                      Missing: {templatePreviewData.missing_variables.join(', ')}
                    </p>
                  ) : null}
                </div>
              )}
              <Button type="button" variant="outline" className="w-full" onClick={() => { setOptionsOpen(false); resetCompose(); }}>
                <Trash2 className="mr-2 h-4 w-4" />
                Discard
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {scheduleDialog}
      </DashboardLayout>
    );
}
