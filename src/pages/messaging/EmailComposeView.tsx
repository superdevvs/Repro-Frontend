import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import {
  AlertCircle, ArrowLeft, CalendarClock, Eye, EyeOff, Hash, Info, Paperclip, Send, Sparkles, Trash2, X,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type {
  Message, MessageChannelConfig, MessageTemplate, MessagingJsonObject, TemplatePreviewResult,
} from '@/types/messaging';
import {
  bodyTextToHtml, formatFileSize, type ComposeFormState, type ComposeRecipients,
  type ContactShootOption, type DraftAttachmentPlaceholder, type Priority, type RecipientField,
} from './emailComposeModel';

type TemplateSuggestion = { name: string; label: string; source: string };
type MessageInfo = { recipients: number; words: number; characters: number; attachments: number };

export interface EmailComposeViewProps {
  currentMode: { title: string; subtitle: string; sendLabel: string };
  lastSaved: Date | null;
  draftAttachments: DraftAttachmentPlaceholder[];
  templatePreviewData?: TemplatePreviewResult;
  navigate: (to: string) => void;
  canSendExternal: boolean;
  setPreviewMode: Dispatch<SetStateAction<boolean>>;
  previewMode: boolean;
  setShowScheduleDialog: Dispatch<SetStateAction<boolean>>;
  resetCompose: () => void;
  handleSendNow: () => void;
  sendMutation: { isPending: boolean };
  scheduleMutation: { isPending: boolean };
  isMissingRequiredShootContext: boolean;
  isInternalReply: boolean;
  setPriority: Dispatch<SetStateAction<Priority>>;
  priority: Priority;
  showCcBcc: boolean;
  recipients: ComposeRecipients;
  setShowCcBcc: Dispatch<SetStateAction<boolean>>;
  renderRecipientField: (field: RecipientField, label: string, description: string, singleRecipient?: boolean) => ReactNode;
  form: ComposeFormState;
  setFormValue: <K extends keyof ComposeFormState>(key: K, value: ComposeFormState[K]) => void;
  setTemplateCustomized: Dispatch<SetStateAction<boolean>>;
  templates: MessageTemplate[];
  setForm: Dispatch<SetStateAction<ComposeFormState>>;
  applyTemplate: (templateId: string) => void;
  isLoadingContactShoots: boolean;
  contactShootOptions: ContactShootOption[];
  channels: MessageChannelConfig[];
  selectedTemplate?: MessageTemplate;
  previewSubject: string;
  previewBodyHtml: string;
  originalMessage?: Message;
  fileInputRef: RefObject<HTMLInputElement | null>;
  attachFiles: (files: FileList | null) => void;
  attachments: File[];
  setAttachments: Dispatch<SetStateAction<File[]>>;
  setDraftAttachments: Dispatch<SetStateAction<DraftAttachmentPlaceholder[]>>;
  templateSuggestions: TemplateSuggestion[];
  parsedVariables?: MessagingJsonObject;
  variableJsonError?: string;
  messageInfo: MessageInfo;
  showScheduleDialog: boolean;
  handleSchedule: () => void;
}

export function EmailComposeView(props: EmailComposeViewProps) {
  const {
    currentMode,
    lastSaved,
    draftAttachments,
    templatePreviewData,
    navigate,
    canSendExternal,
    setPreviewMode,
    previewMode,
    setShowScheduleDialog,
    resetCompose,
    handleSendNow,
    sendMutation,
    scheduleMutation,
    isMissingRequiredShootContext,
    isInternalReply,
    setPriority,
    priority,
    showCcBcc,
    recipients,
    setShowCcBcc,
    renderRecipientField,
    form,
    setFormValue,
    setTemplateCustomized,
    templates,
    setForm,
    applyTemplate,
    isLoadingContactShoots,
    contactShootOptions,
    channels,
    selectedTemplate,
    previewSubject,
    previewBodyHtml,
    originalMessage,
    fileInputRef,
    attachFiles,
    attachments,
    setAttachments,
    setDraftAttachments,
    templateSuggestions,
    parsedVariables,
    variableJsonError,
    messageInfo,
    showScheduleDialog,
    handleSchedule,
  } = props;

  return (
      <DashboardLayout>
        <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
          <EmailNavigation />
          <ScrollArea className="flex-1">
            <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 rounded-[28px] border border-border/60 bg-gradient-to-br from-background via-background to-muted/20 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.8)] lg:flex-row lg:items-start lg:justify-between lg:p-6">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">{currentMode.title}</h1>
                    <p className="max-w-2xl text-sm text-muted-foreground">{currentMode.subtitle}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border/70 px-2.5 py-1">
                      Draft {lastSaved ? `saved ${lastSaved.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'not saved yet'}
                    </span>
                    {draftAttachments.length > 0 && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-600 dark:text-amber-300">
                        Reattach {draftAttachments.length} saved file{draftAttachments.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {templatePreviewData?.missing_variables?.length ? (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-600 dark:text-amber-300">
                        {templatePreviewData.missing_variables.length} variable{templatePreviewData.missing_variables.length > 1 ? 's' : ''} still missing
                      </span>
                    ) : null}
                  </div>
                </div>
  
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Button type="button" variant="ghost" onClick={() => navigate('/messaging/email/inbox')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  {canSendExternal && (
                    <Button type="button" variant="outline" onClick={() => setPreviewMode((prev) => !prev)}>
                      {previewMode ? (
                        <>
                          <EyeOff className="mr-2 h-4 w-4" />
                          Edit
                        </>
                      ) : (
                        <>
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </>
                      )}
                    </Button>
                  )}
                  {canSendExternal && (
                    <Button type="button" variant="outline" onClick={() => setShowScheduleDialog(true)}>
                      <CalendarClock className="mr-2 h-4 w-4" />
                      Schedule
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={resetCompose}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Discard
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSendNow}
                    disabled={sendMutation.isPending || scheduleMutation.isPending || isMissingRequiredShootContext}
                    className="min-w-[140px]"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {sendMutation.isPending ? 'Sending...' : currentMode.sendLabel}
                  </Button>
                </div>
              </div>
  
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-6">
                  {!canSendExternal && (
                    <div className="rounded-[24px] border border-primary/15 bg-primary/5 p-4">
                      <div className="flex items-start gap-3">
                        <Info className="mt-0.5 h-4 w-4 text-primary" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {isInternalReply
                              ? 'Your reply will stay in this dashboard conversation.'
                              : 'Your message will reach the internal team with the right shoot attached.'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {isInternalReply
                              ? 'The recipient will get a separate email alert with a short preview and a secure link back here.'
                              : 'Choose whether this is about a new or previous shoot, then pick the shoot so admins, editing managers, and the right sales rep can see it.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
  
                  <div className="rounded-[28px] border border-border/60 bg-card shadow-[0_30px_80px_-55px_rgba(15,23,42,0.95)]">
                    <div className="border-b border-border/60 px-5 py-4 sm:px-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h2 className="text-lg font-semibold">Compose</h2>
                          <p className="text-sm text-muted-foreground">
                            {canSendExternal
                              ? 'Build the message, lock the right context, and send with confidence.'
                              : 'Keep it simple: pick the shoot, add the details, and send it through.'}
                          </p>
                        </div>
                        {canSendExternal && (
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="inline-flex rounded-full border border-border/60 bg-muted/40 p-1">
                              {(['normal', 'high', 'urgent'] as const).map((level) => (
                                <button
                                  key={level}
                                  type="button"
                                  onClick={() => setPriority(level)}
                                  className={cn(
                                    'rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                                    priority === level
                                      ? 'bg-primary text-primary-foreground shadow-sm'
                                      : 'text-muted-foreground hover:text-foreground',
                                  )}
                                >
                                  {level}
                                </button>
                              ))}
                            </div>
                            {(showCcBcc || recipients.cc.length > 0 || recipients.bcc.length > 0) ? (
                              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCcBcc(false)}>
                                Hide Cc/Bcc
                              </Button>
                            ) : (
                              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCcBcc(true)}>
                                Add Cc / Bcc
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
  
                    <div className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
                      {canSendExternal && (
                        <div className="space-y-4">
                          {renderRecipientField('to', 'To', 'Choose one primary recipient or enter an email.', true)}
                          {(showCcBcc || recipients.cc.length > 0) && renderRecipientField('cc', 'Cc', 'Add visible copy recipients.')}
                          {(showCcBcc || recipients.bcc.length > 0) && renderRecipientField('bcc', 'Bcc', 'Keep these recipients hidden from others.')}
                        </div>
                      )}
  
                      <div className={cn('grid gap-4', canSendExternal ? 'lg:grid-cols-[minmax(0,1fr)_280px]' : 'lg:grid-cols-[minmax(0,1fr)_360px]')}>
                        <div className="space-y-2">
                          <Label htmlFor="compose-subject">Subject</Label>
                          <Input
                            id="compose-subject"
                            value={form.subject}
                            onChange={(event) => {
                              setFormValue('subject', event.target.value);
                              setTemplateCustomized(true);
                            }}
                            placeholder={canSendExternal ? 'Email subject' : 'Short internal summary'}
                            className="h-11 rounded-xl"
                          />
                        </div>
  
                        {canSendExternal ? (
                          <div className="space-y-2">
                            <Label>Template</Label>
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
                              <SelectTrigger className="h-11 rounded-xl">
                                <SelectValue placeholder="Choose a template" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">No template</SelectItem>
                                {templates.map((template) => (
                                  <SelectItem key={template.id} value={String(template.id)}>
                                    {template.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label>Regarding</Label>
                            <div className="inline-flex h-11 w-full rounded-xl border border-border/70 bg-muted/30 p-1">
                              {([
                                ['new_shoot', 'New Shoot'],
                                ['previous_shoot', 'Previous Shoot'],
                              ] as const).map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  disabled={isInternalReply}
                                  onClick={() => {
                                    setForm((prev) => ({
                                      ...prev,
                                      related_shoot_context_type: prev.related_shoot_context_type === value ? prev.related_shoot_context_type : value,
                                      related_shoot_id: prev.related_shoot_context_type === value ? prev.related_shoot_id : '',
                                    }));
                                  }}
                                  className={cn(
                                    'flex-1 rounded-lg px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70',
                                    form.related_shoot_context_type === value
                                      ? 'bg-primary text-primary-foreground shadow-sm'
                                      : 'text-muted-foreground hover:text-foreground',
                                  )}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
  
                      {!canSendExternal && (
                        <div className="space-y-2">
                          <Label>Select shoot</Label>
                          <Select
                            value={form.related_shoot_id || '__none__'}
                            onValueChange={(value) => setFormValue('related_shoot_id', value === '__none__' ? '' : value)}
                            disabled={isInternalReply || !form.related_shoot_context_type || isLoadingContactShoots}
                          >
                            <SelectTrigger className="h-11 rounded-xl">
                              <SelectValue
                                placeholder={
                                  !form.related_shoot_context_type
                                    ? 'Choose new or previous shoot first'
                                    : isLoadingContactShoots
                                      ? 'Loading shoots...'
                                      : 'Select a shoot'
                                }
                              />
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
                          {!isLoadingContactShoots && form.related_shoot_context_type && contactShootOptions.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No shoots are available for this selection yet.
                            </p>
                          ) : null}
                        </div>
                      )}
  
                      {canSendExternal && (
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
                          <div className="space-y-2">
                            <Label>Sender channel</Label>
                            <Select value={form.channel_id} onValueChange={(value) => setFormValue('channel_id', value)}>
                              <SelectTrigger className="h-11 rounded-xl">
                                <SelectValue placeholder="Select sender channel" />
                              </SelectTrigger>
                              <SelectContent>
                                {channels.map((channel) => (
                                  <SelectItem key={channel.id} value={String(channel.id)}>
                                    {channel.display_name}
                                    {channel.from_email ? ` • ${channel.from_email}` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="compose-reply-to">Reply-To</Label>
                            <Input
                              id="compose-reply-to"
                              value={form.reply_to}
                              onChange={(event) => setFormValue('reply_to', event.target.value)}
                              placeholder="reply@company.com"
                              className="h-11 rounded-xl"
                            />
                          </div>
                        </div>
                      )}
  
                      {selectedTemplate && (
                        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                          <div className="flex items-start gap-3">
                            <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                            <div className="space-y-1">
                              <p className="text-sm font-medium">{selectedTemplate.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {selectedTemplate.description || 'Template copy is loaded and ready for personalization.'}
                              </p>
                            </div>
                          </div>
                          {templatePreviewData?.missing_variables?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {templatePreviewData.missing_variables.map((item) => (
                                <Badge key={item} variant="outline" className="rounded-full border-amber-500/40 text-amber-600 dark:text-amber-300">
                                  Missing: {item}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Variable coverage looks good for this template preview.
                            </p>
                          )}
                        </div>
                      )}
  
                      <div className="space-y-2">
                        <Label htmlFor="compose-body">{previewMode ? 'Preview' : 'Message body'}</Label>
                        {previewMode ? (
                          <div className="min-h-[360px] rounded-[24px] border border-border/60 bg-background px-5 py-4">
                            {previewSubject ? <p className="mb-4 text-sm font-medium text-foreground/80">Subject: {previewSubject}</p> : null}
                            {previewBodyHtml ? (
                              <div
                                className="prose prose-sm max-w-none dark:prose-invert"
                                dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground">Start typing to preview the rendered message.</p>
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
                            placeholder={isInternalReply ? 'Write your dashboard reply...' : 'Tell us what you need help with and any shoot details the team should know...'}
                            className="min-h-[360px] rounded-[24px] border-border/70 bg-background px-4 py-3"
                          />
                        )}
                      </div>
  
                      {originalMessage && (
                        <>
                          <Separator />
                          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                            <p className="text-sm font-medium">Original message context</p>
                            <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                              <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">From</p>
                                <p className="mt-1 text-foreground">{originalMessage.from_address || 'Unknown sender'}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">Subject</p>
                                <p className="mt-1 text-foreground">{originalMessage.subject || 'No subject'}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">Received</p>
                                <p className="mt-1 text-foreground">{new Date(originalMessage.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
  
                <div className="space-y-6">
                  {canSendExternal && (
                    <div className="rounded-[28px] border border-border/60 bg-card p-5 shadow-[0_24px_60px_-50px_rgba(15,23,42,0.95)]">
                      <div className="flex items-start gap-3">
                        <Hash className="mt-1 h-4 w-4 text-primary" />
                        <div>
                          <h3 className="text-base font-semibold">Linked context</h3>
                          <p className="text-sm text-muted-foreground">Tie this message to the exact records that should travel with it.</p>
                        </div>
                      </div>
  
                      <div className="mt-5 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="compose-shoot-id">Shoot ID</Label>
                          <Input
                            id="compose-shoot-id"
                            value={form.related_shoot_id}
                            onChange={(event) => setFormValue('related_shoot_id', event.target.value)}
                            placeholder="Enter shoot ID"
                            className="h-11 rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="compose-account-id">Account ID</Label>
                          <Input
                            id="compose-account-id"
                            value={form.related_account_id}
                            onChange={(event) => setFormValue('related_account_id', event.target.value)}
                            placeholder="Enter account ID"
                            className="h-11 rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="compose-invoice-id">Invoice ID</Label>
                          <Input
                            id="compose-invoice-id"
                            value={form.related_invoice_id}
                            onChange={(event) => setFormValue('related_invoice_id', event.target.value)}
                            placeholder="Enter invoice ID"
                            className="h-11 rounded-xl"
                          />
                        </div>
                      </div>
                    </div>
                  )}
  
                  <div className="rounded-[28px] border border-border/60 bg-card p-5 shadow-[0_24px_60px_-50px_rgba(15,23,42,0.95)]">
                    <div className="flex items-start gap-3">
                      <Paperclip className="mt-1 h-4 w-4 text-primary" />
                      <div>
                        <h3 className="text-base font-semibold">Attachments</h3>
                        <p className="text-sm text-muted-foreground">Add files now, and reattach any files restored from drafts.</p>
                      </div>
                    </div>
  
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
  
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Paperclip className="mr-2 h-4 w-4" />
                        Add files
                      </Button>
                      {draftAttachments.length > 0 && (
                        <Badge variant="outline" className="rounded-full border-amber-500/40 text-amber-600 dark:text-amber-300">
                          {draftAttachments.length} draft attachment{draftAttachments.length > 1 ? 's' : ''} need reattach
                        </Badge>
                      )}
                    </div>
  
                    <div className="mt-4 space-y-3">
                      {attachments.length === 0 && draftAttachments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No files attached yet.</p>
                      ) : null}
  
                      {attachments.map((file) => (
                        <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {file.type || 'Unknown type'} • {formatFileSize(file.size)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setAttachments((prev) => prev.filter((item) => item !== file))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
  
                      {draftAttachments.map((file) => (
                        <div key={`draft-${file.name}-${file.size}`} className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-amber-500/35 bg-amber-500/5 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {file.type || 'Unknown type'} • {formatFileSize(file.size)} • reattach required
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setDraftAttachments((prev) => prev.filter((item) => item !== file))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
  
                  {canSendExternal && (
                    <div className="rounded-[28px] border border-border/60 bg-card p-5 shadow-[0_24px_60px_-50px_rgba(15,23,42,0.95)]">
                      <div className="flex items-start gap-3">
                        <Sparkles className="mt-1 h-4 w-4 text-primary" />
                        <div>
                          <h3 className="text-base font-semibold">Variables</h3>
                          <p className="text-sm text-muted-foreground">Blend template variables with live context before you send.</p>
                        </div>
                      </div>
  
                      <div className="mt-5 flex flex-wrap gap-2">
                        {templateSuggestions.map((entry) => (
                          <button
                            key={entry.name}
                            type="button"
                            className="rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                            onClick={() => {
                              const current = parsedVariables ?? {};
                              const next = {
                                ...current,
                                [entry.name]: current[entry.name] ?? '',
                              } as MessagingJsonObject;
                              setFormValue('variables', JSON.stringify(next, null, 2));
                            }}
                          >
                            {`{{${entry.name}}}`}
                          </button>
                        ))}
                      </div>
  
                      <div className="mt-4 space-y-2">
                        <Label htmlFor="compose-variables">Variables JSON</Label>
                        <Textarea
                          id="compose-variables"
                          value={form.variables}
                          onChange={(event) => setFormValue('variables', event.target.value)}
                          placeholder={`{\n  "client_name": "Jamie",\n  "shoot_date": "2026-04-05"\n}`}
                          className="min-h-[180px] rounded-2xl"
                        />
                        {variableJsonError ? (
                          <div className="flex items-center gap-2 text-xs text-amber-600">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>{variableJsonError}</span>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            JSON keys merge with linked IDs and template variables during preview/send.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
  
                  <div className="rounded-[28px] border border-border/60 bg-card p-5 shadow-[0_24px_60px_-50px_rgba(15,23,42,0.95)]">
                    <div className="flex items-start gap-3">
                      <Info className="mt-1 h-4 w-4 text-primary" />
                      <div>
                        <h3 className="text-base font-semibold">Send summary</h3>
                        <p className="text-sm text-muted-foreground">Quick confidence check before you send or schedule.</p>
                      </div>
                    </div>
  
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <Card className="rounded-2xl border-border/60 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recipients</p>
                        <p className="mt-2 text-2xl font-semibold">{messageInfo.recipients}</p>
                      </Card>
                      <Card className="rounded-2xl border-border/60 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Attachments</p>
                        <p className="mt-2 text-2xl font-semibold">{messageInfo.attachments}</p>
                      </Card>
                      <Card className="rounded-2xl border-border/60 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Words</p>
                        <p className="mt-2 text-2xl font-semibold">{messageInfo.words}</p>
                      </Card>
                      <Card className="rounded-2xl border-border/60 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Characters</p>
                        <p className="mt-2 text-2xl font-semibold">{messageInfo.characters}</p>
                      </Card>
                    </div>
  
                    <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                      {canSendExternal ? (
                        <p>
                          From {channels.find((channel) => String(channel.id) === form.channel_id)?.from_email || 'your default channel'}
                          {recipients.to[0] ? ` to ${recipients.to[0]}` : ' to a primary recipient'}.
                        </p>
                      ) : (
                        <p>
                          {isInternalReply
                            ? 'This reply stays in the dashboard; the recipient receives a notification email only.'
                            : form.related_shoot_id
                              ? `This message will be tied to shoot #${form.related_shoot_id} and routed for follow-up.`
                              : 'Pick a shoot and this message will be routed for follow-up.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
  
        <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Schedule this message</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="compose-scheduled-at">Send at</Label>
                <Input
                  id="compose-scheduled-at"
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(event) => setFormValue('scheduled_at', event.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
  
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                <p>{previewSubject || 'No subject yet'}</p>
                <p className="mt-2">
                  {messageInfo.recipients} recipient{messageInfo.recipients === 1 ? '' : 's'} • {messageInfo.attachments} attachment{messageInfo.attachments === 1 ? '' : 's'}
                </p>
              </div>
  
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowScheduleDialog(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSchedule}
                  disabled={scheduleMutation.isPending}
                >
                  <CalendarClock className="mr-2 h-4 w-4" />
                  {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule send'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
}

