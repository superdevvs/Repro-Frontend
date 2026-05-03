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
  Message,
  MessagingJsonObject,
  MessagingJsonValue,
  RelatedShootContextType,
} from '@/types/messaging';

type Priority = 'normal' | 'high' | 'urgent';
type EmailComposeMode = 'compose' | 'reply' | 'forward';
type RecipientField = 'to' | 'cc' | 'bcc';

type EmailComposeLocationState = {
  mode?: EmailComposeMode;
  message?: Message;
};

type ComposeRecipients = Record<RecipientField, string[]>;
type RecipientInputs = Record<RecipientField, string>;
type RecipientErrors = Partial<Record<RecipientField, string>>;

type DraftAttachmentPlaceholder = {
  name: string;
  size: number;
  type: string;
  needsReattach: boolean;
};

type ContactShootOption = {
  id: string;
  label: string;
  dateLabel?: string;
};

type ComposeDraft = {
  version: 1;
  form: ComposeFormState;
  recipients: ComposeRecipients;
  showCcBcc: boolean;
  priority: Priority;
  previewMode: boolean;
  attachments: DraftAttachmentPlaceholder[];
};

type ComposeFormState = {
  channel_id: string;
  subject: string;
  body_text: string;
  body_html: string;
  template_id: string;
  related_shoot_id: string;
  related_shoot_context_type: '' | RelatedShootContextType;
  related_account_id: string;
  related_invoice_id: string;
  variables: string;
  reply_to: string;
  scheduled_at: string;
};

const EMPTY_RECIPIENTS: ComposeRecipients = {
  to: [],
  cc: [],
  bcc: [],
};

const EMPTY_INPUTS: RecipientInputs = {
  to: '',
  cc: '',
  bcc: '',
};

const EMPTY_FORM: ComposeFormState = {
  channel_id: '',
  subject: '',
  body_text: '',
  body_html: '',
  template_id: '',
  related_shoot_id: '',
  related_shoot_context_type: '',
  related_account_id: '',
  related_invoice_id: '',
  variables: '',
  reply_to: '',
  scheduled_at: '',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const variableLibrary = [
  { name: 'client_name', label: 'Client Name', source: 'contact' },
  { name: 'shoot_date', label: 'Shoot Date', source: 'shoot' },
  { name: 'shoot_time', label: 'Shoot Time', source: 'shoot' },
  { name: 'shoot_address', label: 'Shoot Address', source: 'shoot' },
  { name: 'company_name', label: 'Company Name', source: 'account' },
  { name: 'invoice_total', label: 'Invoice Total', source: 'invoice' },
];

const bodyTextToHtml = (text: string) =>
  text.trim()
    ? text
      .split('\n')
      .map((line) => `<p>${line || '&nbsp;'}</p>`)
      .join('')
    : '';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const splitRecipientCandidates = (value: string) =>
  value
    .split(/[,\n;]+/)
    .map((candidate) => normalizeEmail(candidate))
    .filter(Boolean);

const isMessagingJsonValue = (value: unknown): value is MessagingJsonValue => {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isMessagingJsonValue);
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(isMessagingJsonValue);
  }

  return false;
};

const isMessagingJsonObject = (value: unknown): value is MessagingJsonObject =>
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.values(value as Record<string, unknown>).every(isMessagingJsonValue);

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatShootDate = (value?: string | null) => {
  if (!value) {
    return 'Date TBD';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const buildShootOption = (shoot: Record<string, unknown>): ContactShootOption | null => {
  const id = typeof shoot.id === 'number' || typeof shoot.id === 'string' ? String(shoot.id) : '';
  if (!id) {
    return null;
  }

  const address = typeof shoot.address === 'string' ? shoot.address.trim() : '';
  const city = typeof shoot.city === 'string' ? shoot.city.trim() : '';
  const state = typeof shoot.state === 'string' ? shoot.state.trim() : '';
  const propertySlug = typeof shoot.property_slug === 'string' ? shoot.property_slug.trim() : '';
  const client = shoot.client && typeof shoot.client === 'object' ? shoot.client as Record<string, unknown> : null;
  const clientName = client && typeof client.name === 'string' ? client.name.trim() : '';
  const headline = address || propertySlug || clientName || `Shoot #${id}`;
  const location = [city, state].filter(Boolean).join(', ');
  const dateLabel = formatShootDate(
    typeof shoot.scheduled_at === 'string'
      ? shoot.scheduled_at
      : typeof shoot.scheduled_date === 'string'
        ? shoot.scheduled_date
        : typeof shoot.completed_at === 'string'
          ? shoot.completed_at
          : typeof shoot.editing_completed_at === 'string'
            ? shoot.editing_completed_at
            : typeof shoot.admin_verified_at === 'string'
              ? shoot.admin_verified_at
              : null,
  );

  return {
    id,
    label: [headline, location].filter(Boolean).join(' • ') || `Shoot #${id}`,
    dateLabel,
  };
};

const getComposeErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const response = 'response' in error
      ? (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response
      : undefined;
    const responseMessage = response?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage) {
      return responseMessage;
    }

    const responseError = response?.data?.error;
    if (typeof responseError === 'string' && responseError) {
      return responseError;
    }

    const message = 'message' in error ? (error as { message?: unknown }).message : undefined;
    if (typeof message === 'string' && message) {
      return message;
    }
  }

  return fallback;
};

export default function EmailCompose() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, user } = useAuth();
  const canSendExternal = canSendExternalEmail(role);
  const composeState = (location.state as EmailComposeLocationState | null) ?? {};
  const composeMode: EmailComposeMode =
    composeState.mode === 'reply' || composeState.mode === 'forward' || composeState.mode === 'compose'
      ? composeState.mode
      : 'compose';
  const originalMessage = composeState.message;

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
    enabled: !canSendExternal && Boolean(form.related_shoot_context_type),
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
      body_text: composeMode === 'forward' && !prev.body_text ? quotedBody.trimStart() : prev.body_text,
      body_html: composeMode === 'forward' && !prev.body_html ? bodyTextToHtml(quotedBody.trimStart()) : prev.body_html,
      related_shoot_id: prev.related_shoot_id || (originalMessage.related_shoot_id ? String(originalMessage.related_shoot_id) : ''),
      related_shoot_context_type: prev.related_shoot_context_type || originalMessage.related_shoot_context_type || '',
      related_account_id: prev.related_account_id || (originalMessage.related_account_id ? String(originalMessage.related_account_id) : ''),
      related_invoice_id: prev.related_invoice_id || (originalMessage.related_invoice_id ? String(originalMessage.related_invoice_id) : ''),
    }));

    if (canSendExternal && originalMessage.from_address) {
      setRecipients((prev) => ({ ...prev, to: [normalizeEmail(originalMessage.from_address!)] }));
    }
  }, [canSendExternal, composeMode, draftWasRestored, originalMessage]);

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
    if (!form.related_shoot_context_type) {
      if (form.related_shoot_id) {
        setForm((prev) => ({ ...prev, related_shoot_id: '' }));
      }
      return;
    }

    if (form.related_shoot_id && !contactShootOptions.some((option) => option.id === form.related_shoot_id)) {
      setForm((prev) => ({ ...prev, related_shoot_id: '' }));
    }
  }, [contactShootOptions, form.related_shoot_context_type, form.related_shoot_id]);

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

  const channels = settingsData?.channels ?? [];

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
  const isMissingRequiredShootContext = !canSendExternal
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

    if (!canSendExternal && !form.related_shoot_context_type) {
      toast.error('Choose whether this is about a new shoot or a previous shoot.');
      return false;
    }

    if (!canSendExternal && !form.related_shoot_id) {
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
                        <p className="text-sm font-medium">Your message will reach the internal team with the right shoot attached.</p>
                        <p className="text-sm text-muted-foreground">
                          Choose whether this is about a new or previous shoot, then pick the shoot so admins, editing managers, and the right sales rep can see it.
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
                                onClick={() => {
                                  setForm((prev) => ({
                                    ...prev,
                                    related_shoot_context_type: prev.related_shoot_context_type === value ? prev.related_shoot_context_type : value,
                                    related_shoot_id: prev.related_shoot_context_type === value ? prev.related_shoot_id : '',
                                  }));
                                }}
                                className={cn(
                                  'flex-1 rounded-lg px-3 text-sm font-medium transition-colors',
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
                          disabled={!form.related_shoot_context_type || isLoadingContactShoots}
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
                          placeholder={canSendExternal ? 'Write your message here...' : 'Tell us what you need help with and any shoot details the team should know...'}
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
                        {form.related_shoot_id
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
