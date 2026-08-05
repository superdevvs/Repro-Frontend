import type {
  Message,
  MessagingJsonObject,
  MessagingJsonValue,
  RelatedShootContextType,
} from '@/types/messaging';

export type Priority = 'normal' | 'high' | 'urgent';
export type EmailComposeMode = 'compose' | 'reply' | 'forward';
export type RecipientField = 'to' | 'cc' | 'bcc';

export type EmailComposeLocationState = {
  mode?: EmailComposeMode;
  message?: Message;
  prefillBody?: string;
};

export type ComposeRecipients = Record<RecipientField, string[]>;
export type RecipientInputs = Record<RecipientField, string>;
export type RecipientErrors = Partial<Record<RecipientField, string>>;

export type DraftAttachmentPlaceholder = {
  name: string;
  size: number;
  type: string;
  needsReattach: boolean;
};

export type ContactShootOption = {
  id: string;
  label: string;
  dateLabel?: string;
};

export type ComposeFormState = {
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

export type ComposeDraft = {
  version: 1;
  form: ComposeFormState;
  recipients: ComposeRecipients;
  showCcBcc: boolean;
  priority: Priority;
  previewMode: boolean;
  attachments: DraftAttachmentPlaceholder[];
};

export const EMPTY_RECIPIENTS: ComposeRecipients = { to: [], cc: [], bcc: [] };
export const EMPTY_INPUTS: RecipientInputs = { to: '', cc: '', bcc: '' };
export const EMPTY_FORM: ComposeFormState = {
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

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const variableLibrary = [
  { name: 'client_name', label: 'Client Name', source: 'contact' },
  { name: 'shoot_date', label: 'Shoot Date', source: 'shoot' },
  { name: 'shoot_time', label: 'Shoot Time', source: 'shoot' },
  { name: 'shoot_address', label: 'Shoot Address', source: 'shoot' },
  { name: 'company_name', label: 'Company Name', source: 'account' },
  { name: 'invoice_total', label: 'Invoice Total', source: 'invoice' },
];

export const bodyTextToHtml = (text: string) =>
  text.trim()
    ? text.split('\n').map((line) => `<p>${line || '&nbsp;'}</p>`).join('')
    : '';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const splitRecipientCandidates = (value: string) =>
  value.split(/[,\n;]+/).map((candidate) => normalizeEmail(candidate)).filter(Boolean);

const isMessagingJsonValue = (value: unknown): value is MessagingJsonValue => {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) return value.every(isMessagingJsonValue);
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(isMessagingJsonValue);
  }
  return false;
};

export const isMessagingJsonObject = (value: unknown): value is MessagingJsonObject =>
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.values(value as Record<string, unknown>).every(isMessagingJsonValue);

export const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatShootDate = (value?: string | null) => {
  if (!value) return 'Date TBD';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

export const buildShootOption = (shoot: Record<string, unknown>): ContactShootOption | null => {
  const id = typeof shoot.id === 'number' || typeof shoot.id === 'string' ? String(shoot.id) : '';
  if (!id) return null;
  const address = typeof shoot.address === 'string' ? shoot.address.trim() : '';
  const city = typeof shoot.city === 'string' ? shoot.city.trim() : '';
  const state = typeof shoot.state === 'string' ? shoot.state.trim() : '';
  const propertySlug = typeof shoot.property_slug === 'string' ? shoot.property_slug.trim() : '';
  const client = shoot.client && typeof shoot.client === 'object' ? shoot.client as Record<string, unknown> : null;
  const clientName = client && typeof client.name === 'string' ? client.name.trim() : '';
  const headline = address || propertySlug || clientName || `Shoot #${id}`;
  const location = [city, state].filter(Boolean).join(', ');
  const dateLabel = formatShootDate(
    typeof shoot.scheduled_at === 'string' ? shoot.scheduled_at
      : typeof shoot.scheduled_date === 'string' ? shoot.scheduled_date
        : typeof shoot.completed_at === 'string' ? shoot.completed_at
          : typeof shoot.editing_completed_at === 'string' ? shoot.editing_completed_at
            : typeof shoot.admin_verified_at === 'string' ? shoot.admin_verified_at : null,
  );
  return { id, label: [headline, location].filter(Boolean).join(' • ') || `Shoot #${id}`, dateLabel };
};

export const getComposeErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const response = 'response' in error
      ? (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response
      : undefined;
    if (typeof response?.data?.message === 'string' && response.data.message) return response.data.message;
    if (typeof response?.data?.error === 'string' && response.data.error) return response.data.error;
    const message = 'message' in error ? (error as { message?: unknown }).message : undefined;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
};
