import type { AiChatRequest, AiChatSession } from '@/types/ai';

export type ViewMode = 'home' | 'chat';
export type TabMode = 'chat' | 'history';
export type ShootModalTab = 'overview' | 'notes' | 'issues' | 'tours' | 'settings' | 'activity' | 'media';

export type InsightNavigationState = {
  initialMessage?: string;
  context?: AiChatRequest['context'];
  source?: string;
};

export type PageContext = {
  page?: string;
  route?: string;
  tab?: string;
  entityId?: string;
  entityType?: string;
};

export const MAX_ROBBIE_UPLOAD_FILES = 1000;
export const FULL_UPLOAD_ACCEPT = 'image/*,video/*,application/pdf,.pdf,.raw,.cr2,.cr3,.nef,.nrw,.arw,.srf,.sr2,.dng,.raf,.orf,.pef,.rw2,.srw,.3fr,.fff,.iiq,.rwl,.x3f,.erf,.kdc,.mef,.mos,.mrw,.bay,.bmq,.cap,.cine,.dc2,.dcr,.drf,.eip,.gpr,.mdc,.mdf,.mrw,.obm,.ptx,.pxn,.r3d,.rdc,.rmf';
const FLOORPLAN_PATTERNS = ['floorplan', 'floor-plan', 'floor_plan', 'fp_', 'fp-', 'layout', 'blueprint'];

export const DEFAULT_PROMPTS = [
  'Book a new shoot',
  'Rewrite the listing description for 19 Ocean Drive in a more premium tone.',
  'Which of my listings most need new media?',
  'Summarize key selling points for 12 Park Lane.',
  'Draft an Instagram carousel caption for my latest listing.',
  'What should I do this week to improve my active listings?',
];

export const createUploadBatchId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const isVideoUpload = (file: File): boolean =>
  Boolean(file.type && file.type.toLowerCase().startsWith('video/'))
  || /\.(mp4|mov|m4v|avi|mkv|wmv|webm|mpg|mpeg|3gp)$/i.test(file.name);

export const isFloorplanUpload = (file: File): boolean => {
  const lower = file.name.toLowerCase();
  return FLOORPLAN_PATTERNS.some((pattern) => lower.includes(pattern));
};

export const formatAiSessionTimestamp = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Math.max(0, Date.now() - date.getTime());
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (seconds < 30) return 'Just now';
  if (minutes < 1) return '<1m ago';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

export const getAiSessionDisplayLabel = (session: AiChatSession): string => {
  const placeholderTitles = new Set(['new conversation', 'new chat', '']);
  const rawTitle = (session.title ?? '').trim();
  if (rawTitle && !placeholderTitles.has(rawTitle.toLowerCase())) return rawTitle;
  const preview = (session.preview ?? '').trim();
  if (!preview) return 'New conversation';
  const words = preview.split(/\s+/).filter(Boolean);
  if (words.length <= 5) return preview.length > 60 ? `${preview.slice(0, 57)}…` : preview;
  return `${words.slice(0, 5).join(' ')}…`;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined;

export const normalizeAiSession = (value: unknown): AiChatSession | null => {
  const session = asRecord(value);
  if (!session) return null;
  const id = session.id == null ? '' : String(session.id);
  if (!id) return null;
  const createdAt = typeof session.createdAt === 'string'
    ? session.createdAt
    : typeof session.created_at === 'string' ? session.created_at : new Date().toISOString();
  const updatedAt = typeof session.updatedAt === 'string'
    ? session.updatedAt
    : typeof session.updated_at === 'string' ? session.updated_at : createdAt;
  const previewValue = session.preview ?? session.last_message ?? session.lastMessage;
  const topic = ['booking', 'listing', 'insight', 'general'].includes(String(session.topic))
    ? session.topic as AiChatSession['topic']
    : 'general';
  return {
    id,
    title: session.title == null ? '' : String(session.title),
    topic,
    messageCount: Number(session.messageCount ?? session.messages_count ?? 0),
    preview: typeof previewValue === 'string' ? previewValue : null,
    createdAt,
    updatedAt,
  };
};

export type ApiErrorInfo = {
  code?: string;
  message?: string;
  config?: { baseURL?: string; url?: string; method?: string };
  response?: { status?: number; data?: { error?: string; message?: string } };
};

export const getApiErrorInfo = (error: unknown): ApiErrorInfo => {
  const record = asRecord(error);
  const config = asRecord(record?.config);
  const response = asRecord(record?.response);
  const data = asRecord(response?.data);
  return {
    code: typeof record?.code === 'string' ? record.code : undefined,
    message: typeof record?.message === 'string' ? record.message : undefined,
    config: config ? {
      baseURL: typeof config.baseURL === 'string' ? config.baseURL : undefined,
      url: typeof config.url === 'string' ? config.url : undefined,
      method: typeof config.method === 'string' ? config.method : undefined,
    } : undefined,
    response: response ? {
      status: typeof response.status === 'number' ? response.status : undefined,
      data: data ? {
        error: typeof data.error === 'string' ? data.error : undefined,
        message: typeof data.message === 'string' ? data.message : undefined,
      } : undefined,
    } : undefined,
  };
};

export const getPagePrompts = (page?: string): string[] | undefined => {
  switch (page) {
    case 'dashboard': return ['Manage a booking', 'Book a new shoot', 'Check availability', 'Show upcoming shoots'];
    case 'shoot_history': return ['Manage a booking', 'Reschedule a booking', 'Cancel a booking', 'Search by address'];
    case 'shoot_details': return ['Reschedule this shoot', 'Cancel this booking', 'Change services', 'Manage another booking'];
    case 'book_shoot': return ['Book a new shoot', 'Tomorrow', 'This week', 'Next week'];
    case 'availability': return ['Check availability', 'Today', 'Tomorrow', 'All photographers'];
    case 'accounting': return ['View outstanding invoices', 'Accounting summary', 'Create invoice', 'Payment status'];
    case 'invoices': return ['Create invoice', 'Send invoice', 'View outstanding invoices', 'Apply discount'];
    case 'ai_editing': return ['Rewrite listing description', 'Suggest upgrades', 'Which listings need new media?', 'Generate captions'];
    case 'reports': return ['Revenue this month', 'Top clients', 'Photographer performance', 'Shoots completed'];
    case 'settings': return ['Update scheduling settings', 'Manage integrations', 'Tour branding', 'Help & FAQ'];
    default: return undefined;
  }
};
