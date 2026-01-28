export interface AiChatRequest {
  sessionId?: string | null;
  message: string;
  context?: {
    mode?: 'booking' | 'listing' | 'insight' | 'general';
    propertyId?: string;
    listingId?: string;
    intent?: string; // 'book_shoot' | 'manage_booking' | 'availability' | 'client_stats' | 'accounting'
    source?: string;
    insightId?: string;
    insightType?: string;
    entity?: string;
    filters?: Record<string, any>;
    insightPriority?: string;
    insightSummary?: string;
    insightAction?: string;
    role?: string;
  };
}

export interface AiMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AiChatSession {
  id: string;
  title: string;
  topic: 'booking' | 'listing' | 'insight' | 'general';
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiSessionsResponse {
  data: AiChatSession[];
  meta: {
    pagination: {
      current_page: number;
      per_page: number;
      total: number;
      last_page: number;
    };
    stats: {
      thisWeekCount: number;
      avgMessagesPerSession: number;
      topTopic: string;
    };
  };
}

export interface AiSessionMessagesResponse {
  session: AiChatSession;
  messages: AiMessage[];
}

export interface AiChatResponse {
  sessionId: string;
  messages: AiMessage[];
  meta?: {
    suggestions?: string[];
    actions?: Array<{
      type: string;
      [key: string]: any;
    }>;
  };
  session?: {
    id: string;
    title: string;
    topic: string;
  };
}
