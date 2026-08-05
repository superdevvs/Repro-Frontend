import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  Hash,
  Info,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toast } from '@/lib/sonner-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api';
import {
  composeEmail,
  getEmailComposeRecipients,
  getEmailMessages,
  getEmailSettings,
  getTemplates,
  previewTemplate,
  scheduleEmail,
} from '@/services/messaging';
import { canSendExternalEmail } from '@/utils/messagingRoles';
import type {
  ComposeEmailPayload,
  EmailComposeRecipient,
  MessagingJsonObject,
  MessagingJsonValue,
} from '@/types/messaging';
import { EmailComposeView } from './EmailComposeView';
import {
  bodyTextToHtml,
  buildShootOption,
  EMAIL_REGEX,
  EMPTY_FORM,
  EMPTY_INPUTS,
  EMPTY_RECIPIENTS,
  getComposeErrorMessage,
  isMessagingJsonObject,
  normalizeEmail,
  splitRecipientCandidates,
  variableLibrary,
  type ComposeDraft,
  type ComposeFormState,
  type ComposeRecipients,
  type ContactShootOption,
  type DraftAttachmentPlaceholder,
  type EmailComposeLocationState,
  type EmailComposeMode,
  type Priority,
  type RecipientErrors,
  type RecipientField,
  type RecipientInputs,
} from './emailComposeModel';

export default function EmailCompose() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, user } = useAuth();
  const composeState = (location.state as EmailComposeLocationState | null) ?? {};
  const composeMode: EmailComposeMode =
    composeState.mode === 'reply' || composeState.mode === 'forward' || composeState.mode === 'compose'
      ? composeState.mode
      : 'compose';
  const originalMessage = composeState.message;
  const isInternalReply = composeMode === 'reply' && originalMessage?.provider === 'INTERNAL';
  const canSendExternal = canSendExternalEmail(role) && !isInternalReply;

  const [form, setForm] = useState<ComposeFormState>(EMPTY_FORM);
  const [recipients, setRecipients] = useState<ComposeRecipients>(EMPTY_RECIPIENTS);
  const [recipientInputs, setRecipientInputs] = useState<RecipientInputs>(EMPTY_INPUTS);
  const [recipientErrors, setRecipientErrors] = useState<RecipientErrors>({});
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachmentPlaceholder[]>([]);
  const [priority, setPriority] = useState<Priority>('normal');
  const [previewMode, setPreviewMode] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [directoryField, setDirectoryField] = useState<RecipientField | null>(null);
  const [directorySearch, setDirectorySearch] = useState('');
  const [debouncedDirectorySearch, setDebouncedDirectorySearch] = useState('');
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftWasRestored, setDraftWasRestored] = useState(false);
  const [templateCustomized, setTemplateCustomized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const draftKey = `email-compose-draft:${user?.id ?? 'anonymous'}:${composeMode}:${originalMessage?.id ?? 'new'}`;

  const currentMode = useMemo(() => {
    if (composeMode === 'reply') {
      return {
        title: 'Reply',
        subtitle: 'Respond with context and clear next steps',
        sendLabel: 'Send Reply',
      };
    }

    if (composeMode === 'forward') {
      return {
        title: 'Forward',
        subtitle: 'Pass along the message with supporting context',
        sendLabel: 'Forward Email',
      };
    }

    return {
      title: canSendExternal ? 'Compose Email' : 'New Message',
      subtitle: canSendExternal ? 'Transactional outbound workspace' : 'Choose the shoot, add the details, and send it to the right internal team.',
      sendLabel: canSendExternal ? 'Send Email' : 'Send Message',
    };
  }, [canSendExternal, composeMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedDirectorySearch(directorySearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [directorySearch]);

  const { data: contactShootOptions = [], isLoading: isLoadingContactShoots } = useQuery({
    queryKey: ['contact-shoot-options', user?.id, form.related_shoot_context_type],
    enabled: !canSendExternal && !isInternalReply && Boolean(form.related_shoot_context_type),
    queryFn: async () => {
      const contextType = form.related_shoot_context_type;
      const tabs = contextType === 'previous_shoot' ? ['completed', 'delivered'] : ['scheduled'];
      const responses = await Promise.all(
        tabs.map((tab) =>
          apiClient.get('/shoots', {
            params: {
              tab,
              per_page: 100,
            },
          }),
        ),
      );

      const seen = new Set<string>();

      return responses
        .flatMap((response) => {
          const payload = response.data;
          const records = Array.isArray(payload?.data) ? payload.data : [];
          return records
            .map((record) => buildShootOption(record as Record<string, unknown>))
            .filter((record): record is ContactShootOption => Boolean(record));
        })
        .filter((record) => {
          if (seen.has(record.id)) {
            return false;
          }

          seen.add(record.id);
          return true;
        })
        .sort((left, right) => left.label.localeCompare(right.label));
    },
  });

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(draftKey);
      if (!rawDraft) {
        setDraftHydrated(true);
        return;
      }

      const parsedDraft = JSON.parse(rawDraft) as ComposeDraft;
      if (parsedDraft.version !== 1) {
        setDraftHydrated(true);
        return;
      }

      setForm((prev) => ({ ...prev, ...parsedDraft.form }));
      setRecipients(parsedDraft.recipients ?? EMPTY_RECIPIENTS);
      setShowCcBcc(Boolean(parsedDraft.showCcBcc));
      setPriority(parsedDraft.priority ?? 'normal');
      setPreviewMode(Boolean(parsedDraft.previewMode));
      setDraftAttachments(parsedDraft.attachments ?? []);
      setDraftWasRestored(true);
      setTemplateCustomized(Boolean(parsedDraft.form?.template_id));
    } catch {
      window.localStorage.removeItem(draftKey);
    } finally {
      setDraftHydrated(true);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!originalMessage || draftWasRestored) {
      return;
    }

    const baseSubject = originalMessage.subject || '';
    const prefix = composeMode === 'reply' ? 'Re: ' : composeMode === 'forward' ? 'Fwd: ' : '';
    const quotedBody = originalMessage.body_text
      ? `\n\n---- Original message ----\n${originalMessage.body_text}`
      : '';

    setForm((prev) => ({
      ...prev,
      subject: prev.subject || `${prefix}${baseSubject}`,
      body_text: prev.body_text || composeState.prefillBody || (composeMode === 'forward' ? quotedBody.trimStart() : ''),
      body_html: prev.body_html
        || (composeState.prefillBody ? bodyTextToHtml(composeState.prefillBody) : '')
        || (composeMode === 'forward' ? bodyTextToHtml(quotedBody.trimStart()) : ''),
      related_shoot_id: prev.related_shoot_id || (originalMessage.related_shoot_id ? String(originalMessage.related_shoot_id) : ''),
      related_shoot_context_type: prev.related_shoot_context_type || originalMessage.related_shoot_context_type || '',
      related_account_id: prev.related_account_id || (originalMessage.related_account_id ? String(originalMessage.related_account_id) : ''),
      related_invoice_id: prev.related_invoice_id || (originalMessage.related_invoice_id ? String(originalMessage.related_invoice_id) : ''),
    }));

    if (canSendExternal && originalMessage.from_address) {
      setRecipients((prev) => ({ ...prev, to: [normalizeEmail(originalMessage.from_address!)] }));
    }
  }, [canSendExternal, composeMode, composeState.prefillBody, draftWasRestored, originalMessage]);

  useEffect(() => {
    if (!draftHydrated) {
      return;
    }

    const timer = window.setTimeout(() => {
      const attachmentPlaceholders = [
        ...draftAttachments,
        ...attachments.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          needsReattach: true,
        })),
      ];

      const hasContent = Boolean(
        recipients.to.length
        || recipients.cc.length
        || recipients.bcc.length
        || form.subject.trim()
        || form.body_text.trim()
        || form.template_id
        || form.related_shoot_id
        || form.related_shoot_context_type
        || form.related_account_id
        || form.related_invoice_id
        || form.variables.trim()
        || attachments.length
        || draftAttachments.length,
      );

      if (!hasContent) {
        window.localStorage.removeItem(draftKey);
        return;
      }

      const draft: ComposeDraft = {
        version: 1,
        form,
        recipients,
        showCcBcc,
        priority,
        previewMode,
        attachments: attachmentPlaceholders,
      };

      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      setLastSaved(new Date());
    }, 700);

    return () => window.clearTimeout(timer);
  }, [attachments, draftAttachments, draftHydrated, draftKey, form, previewMode, priority, recipients, showCcBcc]);

  useEffect(() => {
    if (isInternalReply) {
      return;
    }

    if (!form.related_shoot_context_type) {
      if (form.related_shoot_id) {
        setForm((prev) => ({ ...prev, related_shoot_id: '' }));
      }
      return;
    }

    if (form.related_shoot_id && !contactShootOptions.some((option) => option.id === form.related_shoot_id)) {
      setForm((prev) => ({ ...prev, related_shoot_id: '' }));
    }
  }, [contactShootOptions, form.related_shoot_context_type, form.related_shoot_id, isInternalReply]);

  const { data: settingsData } = useQuery({
    queryKey: ['email-settings', canSendExternal],
    queryFn: getEmailSettings,
    enabled: canSendExternal,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => getTemplates({ channel: 'EMAIL', is_active: true }),
    enabled: canSendExternal,
  });

  const { data: recentMessagesData } = useQuery({
    queryKey: ['email-compose-recent-messages', canSendExternal],
    queryFn: () => getEmailMessages({ per_page: 50 }),
    enabled: canSendExternal,
  });

  const { data: directoryMatches = [] } = useQuery({
    queryKey: ['email-compose-recipients', debouncedDirectorySearch],
    queryFn: () => getEmailComposeRecipients({
      search: debouncedDirectorySearch || undefined,
      limit: 20,
    }),
    enabled: canSendExternal && directoryField !== null,
  });

  const parsedVariables = useMemo(() => {
    if (!form.variables.trim()) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(form.variables) as unknown;
      return isMessagingJsonObject(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }, [form.variables]);

  const variableJsonError = useMemo(() => {
    if (!form.variables.trim()) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(form.variables) as unknown;
      return isMessagingJsonObject(parsed) ? undefined : 'Variables must be a JSON object.';
    } catch {
      return 'Variables must be valid JSON.';
    }
  }, [form.variables]);

  const previewVariables = useMemo(() => {
    const merged: Record<string, MessagingJsonValue> = {
      ...(parsedVariables ?? {}),
    };

    if (form.related_shoot_id) merged.shoot_id = Number(form.related_shoot_id);
    if (form.related_account_id) merged.account_id = Number(form.related_account_id);
    if (form.related_invoice_id) merged.invoice_id = Number(form.related_invoice_id);

    return merged as MessagingJsonObject;
  }, [form.related_account_id, form.related_invoice_id, form.related_shoot_id, parsedVariables]);

  const { data: templatePreviewData } = useQuery({
    queryKey: ['email-template-preview', form.template_id, previewVariables],
    queryFn: () => previewTemplate(Number(form.template_id), previewVariables),
    enabled: canSendExternal && Boolean(form.template_id) && !variableJsonError,
  });

  const channels = useMemo(() => settingsData?.channels ?? [], [settingsData?.channels]);

  useEffect(() => {
    if (!canSendExternal || form.channel_id || channels.length === 0) {
      return;
    }

    const defaultChannel = channels.find((channel) => channel.is_default) ?? channels[0];
    if (defaultChannel?.id) {
      setForm((prev) => ({ ...prev, channel_id: String(defaultChannel.id) }));
    }
  }, [canSendExternal, channels, form.channel_id]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === Number(form.template_id)),
    [form.template_id, templates],
  );

  const recentRecipients = useMemo(() => {
    const recentList = recentMessagesData?.data ?? [];
    const uniqueRecipients = new Map<string, EmailComposeRecipient>();

    recentList
      .filter((message) => message.direction === 'OUTBOUND' && message.to_address)
      .forEach((message) => {
        const email = normalizeEmail(message.to_address);
        if (uniqueRecipients.has(email)) {
          return;
        }

        uniqueRecipients.set(email, {
          id: `local-recent-${message.id}`,
          email,
          name: message.thread?.contact?.name || message.to_address,
          kind: 'recent',
          subtitle: 'Recent recipient',
          related_user_id: message.thread?.contact?.id ? Number(message.thread?.contact?.id) : null,
          related_account_id: null,
        });
      });

    return Array.from(uniqueRecipients.values()).slice(0, 8);
  }, [recentMessagesData]);

  const filteredDirectoryMatches = useMemo(
    () => directoryMatches.filter((recipient) => recipient.kind !== 'recent'),
    [directoryMatches],
  );

  const groupedDirectoryMatches = useMemo(() => ({
    contacts: filteredDirectoryMatches.filter((recipient) => recipient.kind === 'contact'),
    clients: filteredDirectoryMatches.filter((recipient) => recipient.kind === 'client'),
    users: filteredDirectoryMatches.filter((recipient) => recipient.kind === 'user'),
  }), [filteredDirectoryMatches]);

  const templateSuggestions = useMemo(() => {
    const templateVars = (selectedTemplate?.variables_json ?? []).map((name) => ({
      name,
      label: name.replace(/_/g, ' '),
      source: 'template',
    }));

    const seen = new Set<string>();
    return [...variableLibrary, ...templateVars].filter((entry) => {
      if (seen.has(entry.name)) return false;
      seen.add(entry.name);
      return true;
    });
  }, [selectedTemplate?.variables_json]);

  const messageInfo = useMemo(() => {
    const totalRecipients = canSendExternal
      ? recipients.to.length + recipients.cc.length + recipients.bcc.length
      : (form.related_shoot_id ? 1 : 0);
    const previewText = form.body_text.trim() || templatePreviewData?.body_text?.trim() || '';

    return {
      recipients: totalRecipients,
      words: previewText ? previewText.split(/\s+/).filter(Boolean).length : 0,
      characters: previewText.length,
      attachments: attachments.length,
    };
  }, [attachments.length, canSendExternal, form.body_text, form.related_shoot_id, recipients.bcc.length, recipients.cc.length, recipients.to.length, templatePreviewData?.body_text]);

  const previewSubject = !templateCustomized && templatePreviewData?.subject
    ? templatePreviewData.subject
    : form.subject;
  const previewBodyHtml = !templateCustomized && templatePreviewData?.body_html
    ? templatePreviewData.body_html
    : form.body_html || bodyTextToHtml(form.body_text);
  const isMissingRequiredShootContext = !canSendExternal && !isInternalReply
    && (!form.related_shoot_context_type || !form.related_shoot_id);

  const sendMutation = useMutation({
    mutationFn: composeEmail,
    onSuccess: () => {
      window.localStorage.removeItem(draftKey);
      toast.success(canSendExternal ? 'Email sent successfully.' : 'Message sent successfully.');
      navigate('/messaging/email/inbox');
    },
    onError: (error) => {
      toast.error(getComposeErrorMessage(error, 'Failed to send email.'));
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: scheduleEmail,
    onSuccess: () => {
      window.localStorage.removeItem(draftKey);
      toast.success('Email scheduled successfully.');
      navigate('/messaging/email/inbox');
    },
    onError: (error) => {
      toast.error(getComposeErrorMessage(error, 'Failed to schedule email.'));
    },
  });

  const setFormValue = <K extends keyof ComposeFormState>(key: K, value: ComposeFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setRecipientInput = (field: RecipientField, value: string) => {
    setRecipientInputs((prev) => ({ ...prev, [field]: value }));
    setRecipientErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const addRecipient = (field: RecipientField, email: string) => {
    const normalized = normalizeEmail(email);
    if (!EMAIL_REGEX.test(normalized)) {
      setRecipientErrors((prev) => ({ ...prev, [field]: 'Enter a valid email address.' }));
      return;
    }

    setRecipients((prev) => {
      const cleared = {
        to: prev.to.filter((item) => item !== normalized),
        cc: prev.cc.filter((item) => item !== normalized),
        bcc: prev.bcc.filter((item) => item !== normalized),
      };

      if (field === 'to') {
        return { ...cleared, to: [normalized] };
      }

      return {
        ...cleared,
        [field]: [...cleared[field], normalized],
      };
    });

    setRecipientInputs((prev) => ({ ...prev, [field]: '' }));
    setRecipientErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const commitRecipientInput = (field: RecipientField) => {
    const rawValue = recipientInputs[field];
    if (!rawValue.trim()) {
      return;
    }

    const candidates = splitRecipientCandidates(rawValue);
    if (candidates.length === 0) {
      setRecipientInputs((prev) => ({ ...prev, [field]: '' }));
      return;
    }

    const valid = candidates.filter((candidate) => EMAIL_REGEX.test(candidate));
    const invalid = candidates.filter((candidate) => !EMAIL_REGEX.test(candidate));

    if (valid.length === 0) {
      setRecipientErrors((prev) => ({ ...prev, [field]: 'Enter a valid email address.' }));
      return;
    }

    if (field === 'to' && valid.length > 1) {
      setRecipientErrors((prev) => ({
        ...prev,
        [field]: 'The To field uses one primary recipient. Move extras to Cc or Bcc.',
      }));
    } else if (invalid.length > 0) {
      setRecipientErrors((prev) => ({
        ...prev,
        [field]: `Ignored invalid address${invalid.length > 1 ? 'es' : ''}: ${invalid.join(', ')}`,
      }));
    }

    if (field === 'to') {
      addRecipient(field, valid[0]);
      return;
    }

    valid.forEach((candidate) => addRecipient(field, candidate));
  };

  const removeRecipient = (field: RecipientField, email: string) => {
    setRecipients((prev) => ({
      ...prev,
      [field]: prev[field].filter((entry) => entry !== email),
    }));
  };

  const attachFiles = (files: FileList | null) => {
    const nextFiles = Array.from(files ?? []);
    if (nextFiles.length === 0) {
      return;
    }

    setAttachments((prev) => {
      const seen = new Set(prev.map((file) => `${file.name}-${file.size}`));
      return [
        ...prev,
        ...nextFiles.filter((file) => !seen.has(`${file.name}-${file.size}`)),
      ];
    });
  };

  const resetCompose = () => {
    setForm(EMPTY_FORM);
    setRecipients(EMPTY_RECIPIENTS);
    setRecipientInputs(EMPTY_INPUTS);
    setRecipientErrors({});
    setShowCcBcc(false);
    setAttachments([]);
    setDraftAttachments([]);
    setPriority('normal');
    setPreviewMode(false);
    setDirectoryField(null);
    setDirectorySearch('');
    setTemplateCustomized(false);
    window.localStorage.removeItem(draftKey);
    setLastSaved(null);
  };

  const ensureReadyToSend = (mode: 'send' | 'schedule') => {
    if (canSendExternal && variableJsonError) {
      toast.error(variableJsonError);
      return false;
    }

    if (canSendExternal && recipients.to.length === 0) {
      setRecipientErrors((prev) => ({ ...prev, to: 'Select or enter a recipient email.' }));
      toast.error('A primary recipient is required.');
      return false;
    }

    if (!form.body_text.trim() && !form.template_id) {
      toast.error('Add a message body or choose a template.');
      return false;
    }

    if (!canSendExternal && !isInternalReply && !form.related_shoot_context_type) {
      toast.error('Choose whether this is about a new shoot or a previous shoot.');
      return false;
    }

    if (!canSendExternal && !isInternalReply && !form.related_shoot_id) {
      toast.error('Select the shoot this message is about.');
      return false;
    }

    if (mode === 'schedule' && !form.scheduled_at) {
      toast.error('Choose a date and time for the scheduled send.');
      return false;
    }

    return true;
  };

  const buildPayload = (): ComposeEmailPayload => ({
    channel_id: canSendExternal && form.channel_id ? Number(form.channel_id) : undefined,
    to: canSendExternal ? recipients.to[0] : undefined,
    cc: canSendExternal && recipients.cc.length > 0 ? recipients.cc : undefined,
    bcc: canSendExternal && recipients.bcc.length > 0 ? recipients.bcc : undefined,
    reply_to: canSendExternal && form.reply_to ? form.reply_to : undefined,
    subject: form.subject || undefined,
    body_text: form.body_text || undefined,
    body_html: form.body_html || bodyTextToHtml(form.body_text) || undefined,
    template_id: form.template_id ? Number(form.template_id) : undefined,
    related_shoot_id: form.related_shoot_id ? Number(form.related_shoot_id) : undefined,
    related_shoot_context_type: form.related_shoot_context_type || undefined,
    related_account_id: canSendExternal && form.related_account_id ? Number(form.related_account_id) : undefined,
    related_invoice_id: canSendExternal && form.related_invoice_id ? Number(form.related_invoice_id) : undefined,
    in_reply_to_message_id: isInternalReply ? originalMessage?.id : undefined,
    variables: canSendExternal ? previewVariables : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  const handleSendNow = () => {
    if (!ensureReadyToSend('send')) {
      return;
    }

    if (draftAttachments.length > 0 && attachments.length === 0) {
      toast.warning('Draft attachments need to be reattached before they will be included.');
    }

    sendMutation.mutate(buildPayload());
  };

  const handleSchedule = () => {
    if (!ensureReadyToSend('schedule')) {
      return;
    }

    scheduleMutation.mutate({
      ...buildPayload(),
      scheduled_at: form.scheduled_at,
    });
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find((entry) => entry.id === Number(templateId));
    if (!template) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      template_id: templateId,
      subject: template.subject ?? prev.subject,
      body_text: template.body_text ?? prev.body_text,
      body_html: template.body_html ?? bodyTextToHtml(template.body_text ?? prev.body_text),
    }));
    setTemplateCustomized(false);
  };

  const openDirectory = (field: RecipientField) => {
    setDirectoryField(field);
    setDirectorySearch('');
  };

  const closeDirectory = () => {
    setDirectoryField(null);
    setDirectorySearch('');
  };

  const renderDirectoryContent = (field: RecipientField) => {
    const selectedEmails = new Set([
      ...recipients.to,
      ...recipients.cc,
      ...recipients.bcc,
    ]);

    return (
      <Popover open={directoryField === field} onOpenChange={(open) => (open ? openDirectory(field) : closeDirectory())}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-9 px-3" disabled={!canSendExternal}>
            <Users className="mr-2 h-4 w-4" />
            Browse
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="end">
          <Command>
            <CommandInput
              placeholder="Search contacts, clients, and users..."
              value={directorySearch}
              onValueChange={setDirectorySearch}
            />
            <CommandList>
              <CommandEmpty>No matching recipients found.</CommandEmpty>
              {recentRecipients.length > 0 && (
                <CommandGroup heading="Recent recipients">
                  {recentRecipients.map((recipient) => (
                    <CommandItem
                      key={recipient.id}
                      value={`${recipient.name ?? ''} ${recipient.email}`}
                      onSelect={() => {
                        addRecipient(field, recipient.email);
                        if (field === 'to') closeDirectory();
                      }}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{recipient.name || recipient.email}</span>
                        <span className="truncate text-xs text-muted-foreground">{recipient.email}</span>
                      </div>
                      {selectedEmails.has(recipient.email) && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {recentRecipients.length > 0 && filteredDirectoryMatches.length > 0 && <CommandSeparator />}
              {groupedDirectoryMatches.contacts.length > 0 && (
                <CommandGroup heading="Contacts">
                  {groupedDirectoryMatches.contacts.map((recipient) => (
                    <CommandItem
                      key={recipient.id}
                      value={`${recipient.name ?? ''} ${recipient.email} ${recipient.subtitle ?? ''}`}
                      onSelect={() => {
                        addRecipient(field, recipient.email);
                        if (field === 'to') closeDirectory();
                      }}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{recipient.name || recipient.email}</span>
                        <span className="truncate text-xs text-muted-foreground">{recipient.subtitle || recipient.email}</span>
                      </div>
                      {selectedEmails.has(recipient.email) && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {groupedDirectoryMatches.clients.length > 0 && (
                <CommandGroup heading="Clients">
                  {groupedDirectoryMatches.clients.map((recipient) => (
                    <CommandItem
                      key={recipient.id}
                      value={`${recipient.name ?? ''} ${recipient.email} ${recipient.subtitle ?? ''}`}
                      onSelect={() => {
                        addRecipient(field, recipient.email);
                        if (field === 'to') closeDirectory();
                      }}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{recipient.name || recipient.email}</span>
                        <span className="truncate text-xs text-muted-foreground">{recipient.subtitle || recipient.email}</span>
                      </div>
                      {selectedEmails.has(recipient.email) && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {groupedDirectoryMatches.users.length > 0 && (
                <CommandGroup heading="Users">
                  {groupedDirectoryMatches.users.map((recipient) => (
                    <CommandItem
                      key={recipient.id}
                      value={`${recipient.name ?? ''} ${recipient.email} ${recipient.subtitle ?? ''}`}
                      onSelect={() => {
                        addRecipient(field, recipient.email);
                        if (field === 'to') closeDirectory();
                      }}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{recipient.name || recipient.email}</span>
                        <span className="truncate text-xs text-muted-foreground">{recipient.subtitle || recipient.email}</span>
                      </div>
                      {selectedEmails.has(recipient.email) && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const renderRecipientField = (
    field: RecipientField,
    label: string,
    description: string,
    singleRecipient = false,
  ) => {
    const selected = recipients[field];
    const canType = !singleRecipient || selected.length === 0;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-medium">{label}</Label>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          {canSendExternal && renderDirectoryContent(field)}
        </div>

        <div className="rounded-xl border border-border/70 bg-background p-3">
          <div className="flex flex-wrap gap-2">
            {selected.map((email) => (
              <Badge key={email} variant="secondary" className="gap-1 rounded-full px-3 py-1 text-xs">
                {email}
                <button type="button" onClick={() => removeRecipient(field, email)} aria-label={`Remove ${email}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {canType && (
              <Input
                value={recipientInputs[field]}
                onChange={(event) => setRecipientInput(field, event.target.value)}
                onBlur={() => commitRecipientInput(field)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
                    event.preventDefault();
                    commitRecipientInput(field);
                  }
                }}
                placeholder={singleRecipient ? 'recipient@example.com' : 'Add addresses and press Enter'}
                className="h-9 min-w-[220px] flex-1 border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            )}
          </div>
          {recipientErrors[field] && (
            <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{recipientErrors[field]}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

return (
    <EmailComposeView
      {...{
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
      }}
    />
  );
}
