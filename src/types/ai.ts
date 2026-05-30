export interface AiChatRequest {
  sessionId?: string | null;
  message: string;
  context?: {
    mode?: 'booking' | 'listing' | 'insight' | 'general';
    propertyId?: string;
    listingId?: string;
    intent?: string; // 'book_shoot' | 'manage_booking' | 'availability' | 'client_stats' | 'accounting'
    source?: string;
    page?: string;
    route?: string;
    tab?: string;
    entityId?: string;
    entityType?: string;
    insightId?: string;
    insightType?: string;
    entity?: string;
    filters?: Record<string, any>;
    insightPriority?: string;
    insightSummary?: string;
    insightAction?: string;
    role?: string;
    targetShootId?: string | number;
    targetShootAddress?: string;
    address?: string;
    pendingUpload?: {
      uploadId: string;
      fileCount: number;
      fileNames?: string[];
      classification?: 'auto' | 'raw' | 'floorplan' | 'extra' | 'virtual_staging' | 'green_grass' | 'twilight' | 'drone';
    };
    uploadResult?: {
      shootId: string | number;
      successCount: number;
      errorCount: number;
      floorplanCount?: number;
      videoCount?: number;
      uploadType?: 'raw' | 'edited';
      errors?: string[];
    };
  };
}

export interface AiActionPayload {
  type: string;
  label?: string;
  shootId?: string | number;
  id?: string | number;
  tab?: string;
  [key: string]: unknown;
}

export interface ShootOperatorActionResult {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
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
  preview?: string | null;
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
