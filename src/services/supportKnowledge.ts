import { apiClient } from './api';

export interface SupportArticle {
  id: string;
  title: string;
  summary: string;
  category: string;
  roles: string[];
  steps: string[];
  troubleshooting: string[];
  escalation: string | string[];
  links: Array<{ label: string; url: string }>;
  updated_at?: string;
}

export interface SupportKnowledgeResponse {
  data: SupportArticle[];
  meta: {
    role: string;
    total: number;
    query?: string;
    categories: string[];
    pagination?: { current_page?: number; page?: number; per_page: number; total: number; last_page: number };
  };
}

export const fetchSupportKnowledge = async (
  params: { query?: string; category?: string; page?: number; per_page?: number },
  signal?: AbortSignal,
): Promise<SupportKnowledgeResponse> => (await apiClient.get('/ai/knowledge', { params, signal })).data;

export const fetchSupportArticle = async (id: string, signal?: AbortSignal): Promise<SupportArticle> =>
  (await apiClient.get(`/ai/knowledge/${encodeURIComponent(id)}`, { signal })).data.data;

export const supportArticleUrl = (id: string) => `/chat-with-reproai?tab=help&article=${encodeURIComponent(id)}`;

export const isSafeSupportLink = (url: string) => {
  if ([...url].some((character) => character.charCodeAt(0) <= 32 || character === '\\') || /%0[ad]/i.test(url)) return false;
  return (url.startsWith('/') && !url.startsWith('//'))
    || /^tel:\+?[0-9]{7,15}$/.test(url)
    || /^mailto:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(url);
};

export const isRobbieHelpOnlyRole = (role?: string) => ['salesrep', 'sales_rep', 'sales-rep', 'rep', 'photographer', 'editor'].includes((role || '').toLowerCase());

export const roleHelpPrompts = (role?: string): string[] => {
  if (role === 'photographer') return ['How do I find my assigned shoots?', 'How do I upload shoot photos?', 'How do I update my availability?'];
  if (role === 'editor') return ['How do I find my editing assignments?', 'How do I upload edited media?', 'How do I report a delivery issue?'];
  if (isRobbieHelpOnlyRole(role)) return ['How do I find my assigned clients?', 'How do I check a client’s booking?', 'How do I help a client with an invoice?'];
  if (role === 'client') return ['How do I book a shoot?', 'How do I download my photos?', 'How do I pay an invoice?'];
  return ['How do I help someone sign in?', 'How do I troubleshoot an upload?', 'How do I handle a call with no transcript?'];
};

export const roleHelpLabel = (role?: string) => ({ client: 'Client', salesRep: 'Sales rep', sales_rep: 'Sales rep', photographer: 'Photographer', editor: 'Editor', editing_manager: 'Editing manager', admin: 'Admin', superadmin: 'Admin' })[role || ''] || 'Your role';

export const isSupportQuestion = (text: string) => /^(how (do|can|to|does)|where (do|can|is|are)|why |help\b|troubleshoot\b)/i.test(text.trim());
