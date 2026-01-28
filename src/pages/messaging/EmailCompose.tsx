import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Send, Clock, FileText, Paperclip, Users, X, 
  Pencil, Reply, Forward, ChevronDown, Check, 
  Bold, Italic, List, Link2, Smile, Hash,
  AlertCircle, Zap, Lightbulb, Info
} from 'lucide-react';
import { getEmailSettings, getTemplates, composeEmail, scheduleEmail, getEmailRecipients, getEmailMessages } from '@/services/messaging';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Message } from '@/types/messaging';

type Priority = 'normal' | 'high' | 'urgent';

export default function EmailCompose() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, user } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const canUseTemplates = isAdmin || role === 'salesRep';
  const composeMode: 'compose' | 'reply' | 'forward' = (location.state as any)?.mode || 'compose';
  const originalMessage: Message | undefined = (location.state as any)?.message;
  const composeLabel =
    composeMode === 'reply' ? 'Send Reply' : composeMode === 'forward' ? 'Forward Message' : isAdmin ? 'Compose Email' : 'Compose Message';
  const sendLabel = composeMode === 'reply' ? 'Send Reply' : composeMode === 'forward' ? 'Forward' : isAdmin ? 'Send Now' : 'Send Message';
  const inboxRecipientLabel = 'To';
  const [formData, setFormData] = useState({
    channel_id: '',
    to: '',
    cc: '',
    bcc: '',
    reply_to: '',
    subject: '',
    body_html: '',
    body_text: '',
    template_id: '',
    related_shoot_id: '',
    related_account_id: '',
    related_invoice_id: '',
    variables: '',
  });
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode-aware styling
  const modeConfig = {
    compose: { 
      icon: Pencil, 
      color: 'bg-muted', 
      accent: 'text-foreground',
      buttonClass: '',
      title: 'Compose Message',
      subtitle: 'NEW OUTBOUND COMMUNICATION'
    },
    reply: { 
      icon: Reply, 
      color: 'bg-blue-500/10', 
      accent: 'text-blue-600',
      buttonClass: 'bg-blue-600 hover:bg-blue-700',
      title: 'Reply',
      subtitle: 'REPLYING TO MESSAGE'
    },
    forward: { 
      icon: Forward, 
      color: 'bg-orange-500/10', 
      accent: 'text-orange-600',
      buttonClass: 'bg-orange-600 hover:bg-orange-700',
      title: 'Forward',
      subtitle: 'FORWARDING MESSAGE'
    },
  };
  const currentMode = modeConfig[composeMode];
  const ModeIcon = currentMode.icon;

  // Priority colors
  const priorityConfig = {
    normal: { label: 'Normal', class: 'bg-muted hover:bg-muted/80' },
    high: { label: 'High', class: 'bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30' },
    urgent: { label: 'Urgent', class: 'bg-red-500/20 text-red-700 hover:bg-red-500/30' },
  };

  // Autosave simulation
  useEffect(() => {
    if (formData.body_text || formData.subject) {
      const timer = setTimeout(() => setLastSaved(new Date()), 2000);
      return () => clearTimeout(timer);
    }
  }, [formData.body_text, formData.subject]);

  // Character/word count
  const charCount = formData.body_text.length;
  const wordCount = formData.body_text.trim() ? formData.body_text.trim().split(/\s+/).length : 0;
  const recipientCount = formData.to ? formData.to.split(',').filter(Boolean).length : 0;

  // Insert variable helper
  const insertVariable = useCallback((variable: string) => {
    setFormData(prev => ({
      ...prev,
      body_text: prev.body_text + `{{${variable}}}`,
      body_html: prev.body_html + `{{${variable}}}`,
    }));
  }, []);

  const parsedVariables = useMemo(() => {
    if (!formData.variables) {
      return undefined;
    }

    try {
      return JSON.parse(formData.variables) as Record<string, any>;
    } catch (error) {
      return undefined;
    }
  }, [formData.variables]);

  // Fetch channels
  const { data: settingsData } = useQuery({
    queryKey: ['email-settings'],
    queryFn: getEmailSettings,
    enabled: isAdmin,
  });

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ['templates', 'EMAIL'],
    queryFn: () => getTemplates({ channel: 'EMAIL', is_active: true }),
    enabled: canUseTemplates,
  });

  // Fetch recipients (admins only)
  const { data: recipientsData = [] } = useQuery({
    queryKey: ['email-recipients'],
    queryFn: getEmailRecipients,
    enabled: isAdmin,
  });

  const { data: recentMessagesData } = useQuery({
    queryKey: ['email-recent-messages'],
    queryFn: () => getEmailMessages({ per_page: 50 }),
    enabled: !isAdmin,
  });

  const channels = isAdmin ? settingsData?.channels || [] : [];
  const recipients = recipientsData;
  const recentRecipients = useMemo(() => {
    const messages = recentMessagesData?.data ?? [];
    const emails = new Map<string, { name?: string; email: string }>();
    messages
      .filter((message) => message.direction === 'OUTBOUND' && message.to_address)
      .forEach((message) => {
        if (!emails.has(message.to_address)) {
          emails.set(message.to_address, {
            name: message.sender_display_name,
            email: message.to_address,
          });
        }
      });
    return Array.from(emails.values()).map((entry, index) => ({
      id: index + 1,
      name: entry.name,
      email: entry.email,
    }));
  }, [recentMessagesData]);

  const recipientOptions = isAdmin ? recipients : recentRecipients;
  const recipientLabel = isAdmin ? 'Select' : 'Recent Recipients';
  const recipientPlaceholder = isAdmin ? 'Search contacts...' : 'Search recent recipients...';
  const recipientEmptyLabel = isAdmin
    ? 'No contacts found.'
    : 'No recent recipients. Type an email in the To field.';
  const recipientHeading = isAdmin
    ? `Contacts (${recipientOptions.length})`
    : `Recent Recipients (${recipientOptions.length})`;

  // Prefill when replying/forwarding
  useEffect(() => {
    if (!originalMessage) return;
    const baseSubject = originalMessage.subject || '';
    const newSubject = composeMode === 'reply' ? `Re: ${baseSubject}` : composeMode === 'forward' ? `Fwd: ${baseSubject}` : baseSubject;
    const quotedBody = originalMessage.body_text
      ? `\n\n---- Original message ----\n${originalMessage.body_text}`
      : '';

    setFormData((prev) => ({
      ...prev,
      subject: newSubject,
      to: composeMode === 'reply' ? originalMessage.from_address || prev.to : prev.to,
      body_text: composeMode === 'forward' ? quotedBody : prev.body_text,
      body_html: composeMode === 'forward' && quotedBody ? `<p>${quotedBody.replace(/\n/g, '</p><p>')}</p>` : prev.body_html,
      related_shoot_id: originalMessage.related_shoot_id?.toString() || prev.related_shoot_id,
      related_account_id: originalMessage.related_account_id?.toString() || prev.related_account_id,
      related_invoice_id: originalMessage.related_invoice_id?.toString() || prev.related_invoice_id,
    }));
  }, [composeMode, originalMessage]);

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: composeEmail,
    onSuccess: () => {
      toast.success(isAdmin ? 'Email sent successfully' : 'Message sent to admin inbox');
      navigate('/messaging/email/inbox');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send email');
    },
  });

  // Schedule email mutation
  const scheduleMutation = useMutation({
    mutationFn: scheduleEmail,
    onSuccess: () => {
      toast.success('Email scheduled successfully');
      navigate('/messaging/email/inbox');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to schedule email');
    },
  });

  const handleSendNow = () => {
    if (isAdmin && !formData.to) {
      toast.error('Recipient email is required');
      return;
    }

    if (!formData.body_html && !formData.body_text && !formData.template_id) {
      toast.error('Message body is required');
      return;
    }

    sendMutation.mutate({
      channel_id: isAdmin && formData.channel_id ? parseInt(formData.channel_id) : undefined,
      to: isAdmin ? formData.to : undefined,
      subject: formData.subject,
      body_html: formData.body_html,
      body_text: formData.body_text,
      reply_to: isAdmin ? formData.reply_to || undefined : undefined,
      template_id: formData.template_id ? parseInt(formData.template_id) : undefined,
      related_shoot_id: formData.related_shoot_id ? parseInt(formData.related_shoot_id) : undefined,
      related_account_id: formData.related_account_id ? parseInt(formData.related_account_id) : undefined,
      related_invoice_id: formData.related_invoice_id ? parseInt(formData.related_invoice_id) : undefined,
      variables: parsedVariables,
      cc: formData.cc ? formData.cc.split(',').map((v) => v.trim()).filter(Boolean) : undefined,
      bcc: formData.bcc ? formData.bcc.split(',').map((v) => v.trim()).filter(Boolean) : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  };

  const handleSchedule = () => {
    if (!formData.to || !scheduledAt) {
      toast.error('Recipient and schedule time are required');
      return;
    }

    scheduleMutation.mutate({
      channel_id: formData.channel_id ? parseInt(formData.channel_id) : undefined,
      to: formData.to,
      subject: formData.subject,
      body_html: formData.body_html,
      body_text: formData.body_text,
      reply_to: formData.reply_to || undefined,
      template_id: formData.template_id ? parseInt(formData.template_id) : undefined,
      related_shoot_id: formData.related_shoot_id ? parseInt(formData.related_shoot_id) : undefined,
      related_account_id: formData.related_account_id ? parseInt(formData.related_account_id) : undefined,
      related_invoice_id: formData.related_invoice_id ? parseInt(formData.related_invoice_id) : undefined,
      variables: parsedVariables,
      scheduled_at: scheduledAt,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates?.find((t) => t.id === parseInt(templateId));
    if (template) {
      setFormData({
        ...formData,
        template_id: templateId,
        subject: template.subject || formData.subject,
        body_html: template.body_html || formData.body_html,
        body_text: template.body_text || formData.body_text,
      });
    }
  };

  return (
    <DashboardLayout>
      <EmailNavigation />
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Mode-aware Header */}
        <div className={cn("px-6 py-4 border-b flex items-center justify-between", currentMode.color)}>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", currentMode.color)}>
              <ModeIcon className={cn("h-5 w-5", currentMode.accent)} />
            </div>
            <div>
              <h1 className={cn("text-xl font-semibold", currentMode.accent)}>{currentMode.title}</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{currentMode.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastSaved && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Saved {Math.round((Date.now() - lastSaved.getTime()) / 1000)}s ago
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Content with Sidebars */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-72 border-r bg-muted/30 p-4 space-y-6 overflow-y-auto">
            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Priority</Label>
              <div className="flex gap-1">
                {(['normal', 'high', 'urgent'] as Priority[]).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant="ghost"
                    className={cn("flex-1 text-xs", priority === p ? priorityConfig[p].class : 'bg-background')}
                    onClick={() => setPriority(p)}
                  >
                    {priority === p && <Check className="h-3 w-3 mr-1" />}
                    {priorityConfig[p].label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Link Shoot */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Link Shoot ID</Label>
              <div className="relative">
                <Hash className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter shoot ID"
                  className="pl-8 h-9"
                  value={formData.related_shoot_id}
                  onChange={(e) => setFormData({ ...formData, related_shoot_id: e.target.value })}
                />
              </div>
            </div>

            {/* Quick Contacts */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Quick Contacts</Label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {recipientOptions.slice(0, 5).map((contact) => (
                  <button
                    key={contact.id}
                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left text-sm"
                    onClick={() => {
                      const current = formData.to ? formData.to.split(',').map((v) => v.trim()).filter(Boolean) : [];
                      if (!current.includes(contact.email)) {
                        setFormData({ ...formData, to: [...current, contact.email].join(', ') });
                      }
                    }}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">{(contact.name || contact.email).charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="truncate">
                      <p className="font-medium text-xs truncate">{contact.name || contact.email}</p>
                    </div>
                  </button>
                ))}
                {recipientOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">No contacts available</p>
                )}
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Attachments</Label>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Add Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length) setAttachments((prev) => [...prev, ...files]);
                }}
              />
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-background rounded text-xs">
                      <span className="truncate">{file.name}</span>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Templates */}
            {canUseTemplates && templates && templates.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Templates</Label>
                <div className="space-y-1">
                  {templates.slice(0, 5).map((template) => (
                    <button
                      key={template.id}
                      className={cn(
                        "w-full text-left p-2 rounded-md text-xs hover:bg-muted border",
                        formData.template_id === template.id.toString() ? 'border-primary bg-primary/5' : 'border-transparent'
                      )}
                      onClick={() => handleTemplateSelect(template.id.toString())}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate font-medium">{template.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center - Compose Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* From */}
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-sm text-muted-foreground">From</Label>
                  <Select value={formData.channel_id} onValueChange={(value) => setFormData({ ...formData, channel_id: value })}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select email account" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id.toString()}>
                          {channel.display_name} ({channel.from_email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* To */}
              <div className="flex items-center gap-2">
                <Label className="w-16 text-sm text-muted-foreground">To</Label>
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="recipient@example.com"
                    value={formData.to}
                    onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                    className="flex-1"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Users className="h-4 w-4 mr-1" />
                        {recipientLabel}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0">
                      <Command>
                        <CommandInput placeholder={recipientPlaceholder} value={recipientSearch} onValueChange={setRecipientSearch} />
                        <CommandList>
                          <CommandEmpty>{recipientEmptyLabel}</CommandEmpty>
                          <CommandGroup heading={recipientHeading}>
                            {recipientOptions.map((contact) => (
                              <CommandItem
                                key={contact.id}
                                value={contact.email}
                                onSelect={(val) => {
                                  const current = formData.to ? formData.to.split(',').map((v) => v.trim()).filter(Boolean) : [];
                                  if (!current.includes(val)) setFormData({ ...formData, to: [...current, val].join(', ') });
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{contact.name || contact.email}</span>
                                  <span className="text-xs text-muted-foreground">{contact.email}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button variant="ghost" size="sm" onClick={() => setShowCcBcc((v) => !v)}>
                    {showCcBcc ? 'Hide' : '+Cc/Bcc'}
                  </Button>
                </div>
              </div>

              {/* Recipient badges */}
              {formData.to && (
                <div className="flex flex-wrap gap-1 ml-16">
                  {formData.to.split(',').map((addr) => addr.trim()).filter(Boolean).map((addr) => (
                    <Badge key={addr} variant="secondary" className="flex items-center gap-1 text-xs">
                      {addr}
                      <button type="button" onClick={() => {
                        const remaining = formData.to.split(',').map((v) => v.trim()).filter(Boolean).filter((v) => v !== addr);
                        setFormData({ ...formData, to: remaining.join(', ') });
                      }}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* CC / BCC */}
              {showCcBcc && (
                <div className="space-y-2 ml-16">
                  <div className="flex items-center gap-2">
                    <Label className="w-8 text-sm text-muted-foreground">Cc</Label>
                    <Input placeholder="cc@example.com" value={formData.cc} onChange={(e) => setFormData({ ...formData, cc: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-8 text-sm text-muted-foreground">Bcc</Label>
                    <Input placeholder="bcc@example.com" value={formData.bcc} onChange={(e) => setFormData({ ...formData, bcc: e.target.value })} />
                  </div>
                </div>
              )}

              {/* Subject */}
              <div className="flex items-center gap-2">
                <Label className="w-16 text-sm text-muted-foreground">Subject</Label>
                <Input placeholder="Email subject" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="flex-1" />
              </div>

              {/* Body */}
              <div className="flex-1 flex flex-col">
                <Textarea
                  placeholder={composeMode === 'reply' ? 'Type your reply...' : composeMode === 'forward' ? 'Add a message (optional)...' : 'Write your message here...'}
                  className="flex-1 min-h-[200px] resize-none"
                  value={formData.body_text}
                  onChange={(e) => setFormData({ ...formData, body_text: e.target.value, body_html: `<p>${e.target.value.replace(/\n/g, '</p><p>')}</p>` })}
                />
              </div>

              {/* Original message context */}
              {originalMessage && (
                <Card className="p-4 bg-muted/50 border-dashed">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Original Message</p>
                      <p className="font-medium text-sm">{originalMessage.subject || '(No Subject)'}</p>
                    </div>
                    <Badge variant="outline" className={composeMode === 'reply' ? 'bg-blue-500/10' : 'bg-orange-500/10'}>
                      {composeMode === 'reply' ? 'Reply' : 'Forward'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">From: {originalMessage.from_address}</p>
                  {originalMessage.body_text && (
                    <pre className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground max-h-32 overflow-y-auto">
                      {originalMessage.body_text.substring(0, 500)}...
                    </pre>
                  )}
                </Card>
              )}
            </div>

            {/* Footer with formatting toolbar */}
            <div className="border-t p-4 flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Bold className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Italic className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><List className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Link2 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Smile className="h-4 w-4" /></Button>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Clock className="h-4 w-4 mr-1" />
                        Schedule
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Schedule Email</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div><Label>Date & Time</Label><Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></div>
                        <Button onClick={() => { handleSchedule(); setShowScheduleDialog(false); }} disabled={scheduleMutation.isPending} className="w-full">Schedule Send</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                <Button onClick={handleSendNow} disabled={sendMutation.isPending} className={cn(currentMode.buttonClass)}>
                  <Send className="h-4 w-4 mr-1" />
                  {sendLabel}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-64 border-l bg-muted/30 p-4 space-y-6 overflow-y-auto hidden lg:block">
            {/* Insert Variables */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" /> Insert Variables
              </Label>
              <div className="flex flex-wrap gap-1">
                {['client_name', 'shoot_date', 'shoot_time', 'shoot_address', 'company_name'].map((v) => (
                  <Button key={v} variant="outline" size="sm" className="text-xs h-7" onClick={() => insertVariable(v)}>
                    {`{{${v}}}`}
                  </Button>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Lightbulb className="h-3 w-3" /> Tips
              </Label>
              <div className="text-xs text-muted-foreground space-y-2">
                <p>• Use variables for personalization</p>
                <p>• Keep subject lines under 50 chars</p>
                <p>• Preview before sending</p>
              </div>
            </div>

            {/* Message Info */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" /> Message Info
              </Label>
              <div className="text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Characters</span><span>{charCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Words</span><span>{wordCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Recipients</span><span>{recipientCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Attachments</span><span>{attachments.length}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

