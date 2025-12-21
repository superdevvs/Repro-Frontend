import { apiClient } from './api';
import type {
  AiChatRequest,
  AiChatResponse,
  AiSessionsResponse,
  AiSessionMessagesResponse,
} from '@/types/ai';

/**
 * Send a message to the AI chat
 */
export const sendAiMessage = async (payload: AiChatRequest): Promise<AiChatResponse> => {
  try {
    const response = await apiClient.post<AiChatResponse>('/ai/chat', payload);
    return response.data;
  } catch (error: any) {
    // Log the full request details for network errors
    if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
      console.error('AI Chat Network Error:', {
        attemptedUrl: error?.config ? `${error.config.baseURL}${error.config.url}` : 'unknown',
        baseURL: error?.config?.baseURL,
        url: error?.config?.url,
        method: error?.config?.method,
        payload,
      });
    }
    throw error; // Re-throw to be handled by component
  }
};

/**
 * Send a message with streaming support
 * Note: This is a placeholder for future streaming implementation
 */
export const sendAiMessageStream = async (
  payload: AiChatRequest,
  onChunk: (chunk: string) => void
): Promise<AiChatResponse> => {
  // For now, use regular API call
  // Future: Implement SSE or ReadableStream handling
  const response = await sendAiMessage(payload);
  return response;
};

/**
 * Fetch AI chat sessions with optional search query
 */
export const fetchAiSessions = async (query?: string): Promise<AiSessionsResponse> => {
  const params = query ? { query } : {};
  const response = await apiClient.get<AiSessionsResponse>('/ai/sessions', { params });
  return response.data;
};

/**
 * Fetch messages for a specific session
 */
export const fetchAiSessionMessages = async (sessionId: string): Promise<AiSessionMessagesResponse> => {
  const response = await apiClient.get<AiSessionMessagesResponse>(`/ai/sessions/${sessionId}`);
  return response.data;
};

/**
 * Delete a chat session
 */
export const deleteAiSession = async (sessionId: string): Promise<void> => {
  await apiClient.delete(`/ai/sessions/${sessionId}`);
};

/**
 * Archive a chat session
 */
export const archiveAiSession = async (sessionId: string): Promise<AiSessionsResponse['data'][0]> => {
  const response = await apiClient.post(`/ai/sessions/${sessionId}/archive`);
  return response.data.session;
};
