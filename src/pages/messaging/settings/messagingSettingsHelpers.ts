import type { EmailProviderType, MessageChannelConfig, MessagingJsonObject, MessagingJsonValue, SmsNumberConfig } from '@/types/messaging';

export type ChannelFormState = {
  provider: EmailProviderType;
  display_name: string;
  from_email: string;
  reply_to_email: string;
  is_default: boolean;
  cakemail_sender_id: string;
  cakemail_list_id: string;
  cakemail_type: 'transactional' | 'marketing';
  cakemail_tags: string;
};

export const emptyChannelState: ChannelFormState = {
  provider: 'CAKEMAIL',
  display_name: '',
  from_email: '',
  reply_to_email: '',
  is_default: false,
  cakemail_sender_id: '',
  cakemail_list_id: '',
  cakemail_type: 'transactional',
  cakemail_tags: '',
};

export const emptyNumberState: SmsNumberConfig = {
  provider: 'TELNYX',
  phone_number: '',
  label: '',
  telnyx_phone_number_id: '',
  messaging_profile_id: '',
  is_default: false,
  sms_ai_enabled: true,
};

export const getMessagingSettingsErrorMessage = (error: unknown, fallback: string) => {
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

export const getConfigString = (value: MessagingJsonValue | undefined, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

export const getConfigStringList = (value: MessagingJsonValue | undefined): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
};

export const buildCakemailConfig = (channel: ChannelFormState): MessagingJsonObject | undefined => {
  const config: MessagingJsonObject = {};

  if (channel.cakemail_sender_id.trim()) {
    config.cakemail_sender_id = channel.cakemail_sender_id.trim();
  }

  if (channel.cakemail_list_id.trim()) {
    config.cakemail_list_id = channel.cakemail_list_id.trim();
  }

  if (channel.cakemail_type) {
    config.cakemail_type = channel.cakemail_type;
  }

  if (channel.cakemail_tags.trim()) {
    const tags = channel.cakemail_tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (tags.length) {
      config.cakemail_tags = tags;
    }
  }

  return Object.keys(config).length > 0 ? config : undefined;
};

export const mapChannelToFormState = (channel: MessageChannelConfig): ChannelFormState => {
  const config = channel.config_json ?? {};
  const tagsValue = getConfigStringList(config.cakemail_tags).join(', ') || getConfigString(config.cakemail_tags);

  return {
    provider: channel.provider === 'TELNYX' ? 'CAKEMAIL' : channel.provider,
    display_name: channel.display_name ?? '',
    from_email: channel.from_email ?? '',
    reply_to_email: channel.reply_to_email ?? '',
    is_default: Boolean(channel.is_default),
    cakemail_sender_id: getConfigString(config.cakemail_sender_id),
    cakemail_list_id: getConfigString(config.cakemail_list_id),
    cakemail_type: getConfigString(config.cakemail_type) === 'marketing' ? 'marketing' : 'transactional',
    cakemail_tags: tagsValue,
  };
};

export const getDisplayConfigRows = (config?: MessagingJsonObject | null): Array<{ label: string; value: string }> => {
  if (!config) {
    return [];
  }

  const rows: Array<{ label: string; value: string }> = [];
  const senderId = getConfigString(config.cakemail_sender_id);
  const listId = getConfigString(config.cakemail_list_id);
  const type = getConfigString(config.cakemail_type);
  const tags = getConfigStringList(config.cakemail_tags).join(', ') || getConfigString(config.cakemail_tags);

  if (senderId) rows.push({ label: 'Sender ID', value: senderId });
  if (listId) rows.push({ label: 'List ID', value: listId });
  if (type) rows.push({ label: 'Type', value: type });
  if (tags) rows.push({ label: 'Tags', value: tags });

  return rows;
};
