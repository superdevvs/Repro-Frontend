import React, { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

const LazyShootDetailsModal = lazy(() =>
  import('@/components/shoots/ShootDetailsModal').then((module) => ({
    default: module.ShootDetailsModal,
  })),
);
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/components/auth/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUpload } from '@/context/UploadContext';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { AiMessageBubble } from '@/components/ai/AiMessageBubble';
import { cn } from '@/lib/utils';
import { sendAiMessage, fetchAiSessions, fetchAiSessionMessages, deleteAiSession, archiveAiSession } from '@/services/aiService';
import type { AiActionPayload, AiChatRequest, AiMessage, AiChatSession } from '@/types/ai';
import { 
  ImageIcon, 
  FileText, 
  Code, 
  Link as LinkIcon, 
  FileIcon, 
  Mic, 
  Send,
  Search,
  MessageSquare,
  Plus,
  Clock,
  MoreVertical,
  Loader2,
  Trash2,
  Archive,
  ArrowLeft,
  X
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';

import { ChatWithReproAiView } from './ChatWithReproAiView';
import {
  DEFAULT_PROMPTS,
  FULL_UPLOAD_ACCEPT,
  MAX_ROBBIE_UPLOAD_FILES,
  createUploadBatchId,
  formatAiSessionTimestamp,
  getApiErrorInfo,
  getAiSessionDisplayLabel,
  getPagePrompts,
  isFloorplanUpload,
  isVideoUpload,
  normalizeAiSession,
  type InsightNavigationState,
  type PageContext,
  type ShootModalTab,
  type TabMode,
  type ViewMode,
} from './chatWithReproAiModel';

const SUGGESTED_CARDS = [
  {
    icon: ImageIcon,
    title: 'Book a New Shoot',
    description: 'Schedule photos, video, drone, or floorplans for any property in seconds.',
    type: 'booking' as const,
  },
  {
    icon: FileText,
    title: 'Improve a Listing',
    description: 'Generate listing copy, photo order, and channel-ready content powered by Robbie.',
    type: 'listing' as const,
  },
  {
    icon: Code,
    title: 'Get Property Insights',
    description: 'Ask Robbie what\'s special about a property and how to position it.',
    type: 'insight' as const,
  },
];

const ChatWithReproAi = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { trackUpload } = useUpload();
  const hasConsumedNavigation = useRef(false);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isSendingRef = useRef(false);
  const shouldAutoScrollRef = useRef(false);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingUploadFilesRef = useRef<File[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [tabMode, setTabMode] = useState<TabMode>('chat');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [sessionsStats, setSessionsStats] = useState({
    thisWeekCount: 0,
    avgMessagesPerSession: 0,
    topTopic: 'general',
  });
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [overviewShootId, setOverviewShootId] = useState<string | null>(null);
  const [overviewShootTab, setOverviewShootTab] = useState<ShootModalTab>('overview');
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
  
  const userName = user?.name || user?.email?.split('@')[0] || 'there';

  const visibleMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (msg.sender === 'system') {
        return false;
      }
      const content = (msg.content ?? '').trim();
      const metadata = msg.metadata ?? {};
      const hasActions = Boolean(metadata.action)
        || (Array.isArray(metadata.actions) && metadata.actions.length > 0);
      return content !== '' || hasActions;
    });
  }, [messages]);

  const lastAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg.sender === 'assistant') {
        return msg;
      }
    }
    return undefined;
  }, [messages]);
  const lastAssistantStep = typeof lastAssistantMessage?.metadata?.step === 'string'
    ? lastAssistantMessage.metadata.step
    : undefined;
  const shouldShowFallbackSuggestions = currentSuggestions.length === 0 && !lastAssistantStep;

  const mapRouteToPage = useCallback((route: string): string | undefined => {
    if (route.startsWith('/dashboard')) return 'dashboard';
    if (route.startsWith('/shoot-history')) return 'shoot_history';
    if (route.startsWith('/shoots/')) return 'shoot_details';
    if (route.startsWith('/book-shoot')) return 'book_shoot';
    if (route.startsWith('/availability')) return 'availability';
    if (route.startsWith('/accounting')) return 'accounting';
    if (route.startsWith('/invoices')) return 'invoices';
    if (route.startsWith('/ai-editing')) return 'ai_editing';
    if (route.startsWith('/reports')) return 'reports';
    if (route.startsWith('/settings')) return 'settings';
    if (route.startsWith('/chat-with-reproai')) return 'chat';
    return undefined;
  }, []);

  const pageContext = useMemo<PageContext>(() => {
    const navState = location.state as InsightNavigationState | null;
    const contextRoute = navState?.context?.route;
    let lastRoute: string | null = null;
    if (!contextRoute && location.pathname === '/chat-with-reproai') {
      try {
        lastRoute = sessionStorage.getItem('robbie_last_route');
      } catch (error) {
        lastRoute = null;
      }
    }
    const route = contextRoute || lastRoute || location.pathname;
    const page = navState?.context?.page || mapRouteToPage(route);
    const shootMatch = route.match(/^\/shoots\/([^/]+)/);
    const entityId = shootMatch?.[1];
    return {
      page,
      route,
      tab: tabMode,
      entityId,
      entityType: entityId ? 'shoot' : undefined,
    };
  }, [location.pathname, location.state, mapRouteToPage, tabMode]);

  // Auto-rotate stacked cards every 3 seconds
  useEffect(() => {
    if (viewMode !== 'home') return;
    const interval = setInterval(() => {
      setActiveCardIndex((prev) => (prev + 1) % SUGGESTED_CARDS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [viewMode]);

  // Load sessions when history tab is active or when showing the home panel
  // (home now renders a compact "Recent chats" preview in its bottom area).
  useEffect(() => {
    if (tabMode === 'history' || (tabMode === 'chat' && viewMode === 'home')) {
      void loadSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabMode, viewMode, searchTerm]);

  const resizeMessageInput = useCallback(() => {
    const el = messageInputRef.current;
    if (!el) return;
    el.style.height = '0px';
    const maxHeight = 72;
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    resizeMessageInput();
  }, [message, resizeMessageInput]);

  // Capture the real scroll owner (<main> from DashboardLayout)
  useEffect(() => {
    if (contentScrollRef.current) {
      mainScrollRef.current = contentScrollRef.current.closest('main');
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (tabMode !== 'chat' || viewMode !== 'chat' || visibleMessages.length === 0 || !shouldAutoScrollRef.current) {
      return;
    }

    const scrollOwner = mainScrollRef.current;
    if (!scrollOwner) return;

    const scrollToLatest = () => {
      scrollOwner.scrollTop = Math.max(0, scrollOwner.scrollHeight - scrollOwner.clientHeight);
    };

    scrollToLatest();
    const rafId = window.requestAnimationFrame(scrollToLatest);
    const t1 = window.setTimeout(scrollToLatest, 150);
    const t2 = window.setTimeout(scrollToLatest, 400);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [
    tabMode,
    viewMode,
    visibleMessages,
    isLoading,
    currentSuggestions.length,
    shouldShowFallbackSuggestions,
  ]);

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const response = await fetchAiSessions(searchTerm || undefined);
      const normalizedSessions = (Array.isArray(response.data) ? response.data : [])
        .map(normalizeAiSession)
        .filter((session): session is AiChatSession => session !== null);

      setSessions(normalizedSessions);
      if (response.meta?.stats) {
        setSessionsStats(response.meta.stats);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chat history',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSessions(false);
    }
  }, [searchTerm]);

  const loadSessionMessages = useCallback(async (id: string) => {
    try {
      const response = await fetchAiSessionMessages(id);
      setMessages(response.messages);
      // Clear suggestions when loading a session (they'll come from next AI response)
      setCurrentSuggestions([]);
      shouldAutoScrollRef.current = false;
    } catch (error) {
      console.error('Failed to load session messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chat messages',
        variant: 'destructive',
      });
    }
  }, []);

  // Helper to map suggestion text to intent
  const getIntentFromSuggestion = useCallback((suggestion: string): string | undefined => {
    const s = suggestion.toLowerCase();
    if (s.includes('book') && (s.includes('shoot') || s.includes('new'))) return 'book_shoot';
    if (s.includes('manage') && s.includes('booking')) return 'manage_booking';
    if (s.includes('availability') || s.includes('available')) return 'availability';
    return undefined;
  }, []);

  const handleSendMessage = useCallback(async (msg?: string, context?: AiChatRequest['context']) => {
    const messageToSend = msg || message.trim();
    if (!messageToSend || isSendingRef.current) return;

    isSendingRef.current = true;
    shouldAutoScrollRef.current = true;
    setIsLoading(true);
    const userMessage: AiMessage = {
      id: `temp-${Date.now()}`,
      sender: 'user',
      content: messageToSend,
      createdAt: new Date().toISOString(),
    };

    // Add user message optimistically
    setMessages(prev => [...prev, userMessage]);
    setMessage('');

    if (viewMode === 'home') {
      setViewMode('chat');
      setTabMode('chat');
    }

    // Auto-detect intent from message only when starting a new conversation (no session yet).
    // Once inside a flow (sessionId exists), rely on the backend session state to keep the
    // correct intent — sending a re-detected intent on every follow-up message can reset the
    // flow and cause loops.
    const intent = context?.intent || (!sessionId ? getIntentFromSuggestion(messageToSend) : undefined);
    const finalContext = {
      ...pageContext,
      ...context,
      ...(intent ? { intent } : {}),
      role: user?.role,
    };

    try {
      const response = await sendAiMessage({
        sessionId: sessionId,
        message: messageToSend,
        context: finalContext,
      });

      // Batch all state updates together to ensure suggestions render with messages
      // Transition to chat view if coming from home (do this with other updates)
      const isFirstMessage = viewMode === 'home';
      
      setSessionId(response.sessionId);
      setMessages(response.messages);
      
      // Always update suggestions from response
      const newSuggestions = response.meta?.suggestions;
      if (Array.isArray(newSuggestions) && newSuggestions.length > 0) {
        setCurrentSuggestions(newSuggestions);
      } else {
        setCurrentSuggestions([]);
      }
      
      // Transition to chat view AFTER setting suggestions to ensure they render
      if (isFirstMessage) {
        setViewMode('chat');
        setTabMode('chat');
      }
    } catch (error: unknown) {
      console.error('Failed to send message:', error);
      const errorInfo = getApiErrorInfo(error);
      
      // Log detailed network error info
      if (errorInfo.code === 'ERR_NETWORK' || errorInfo.message === 'Network Error') {
        const baseURL = errorInfo.config?.baseURL || 'unknown';
        const url = errorInfo.config?.url || 'unknown';
        const fullUrl = `${baseURL}${url}`;
        console.error('Network Error Details:', {
          fullUrl,
          baseURL,
          url,
          method: errorInfo.config?.method,
          code: errorInfo.code,
          message: errorInfo.message,
        });
      }
      
      // Determine error message based on error type
      let errorMessage = 'Failed to send message';
      if (errorInfo.code === 'ERR_NETWORK' || errorInfo.message === 'Network Error') {
        const baseURL = errorInfo.config?.baseURL || 'unknown';
        const url = errorInfo.config?.url || 'unknown';
        errorMessage = `Unable to connect to the server at ${baseURL}${url}. Please check:\n\n1. Is the backend server running? (php artisan serve)\n2. Is the API URL correct? (Check .env VITE_API_URL)\n3. Check browser console for CORS errors`;
      } else if (errorInfo.response?.status === 401 || errorInfo.response?.status === 419) {
        errorMessage = 'Your session has expired. Please refresh the page and try again.';
      } else if (errorInfo.response?.data?.error) {
        errorMessage = errorInfo.response.data.error;
      } else if (errorInfo.response?.data?.message) {
        errorMessage = errorInfo.response.data.message;
      } else if (errorInfo.message) {
        errorMessage = errorInfo.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  }, [message, sessionId, viewMode, pageContext, user?.role, getIntentFromSuggestion]);

  const startConfirmedRobbieUpload = useCallback((action: AiActionPayload) => {
    const shootId = typeof action?.shootId === 'string' || typeof action?.shootId === 'number'
      ? action.shootId
      : null;
    const files = pendingUploadFilesRef.current;
    if (!shootId || files.length === 0) {
      toast({
        title: 'No files ready',
        description: 'Select files in Robbie first, then confirm the upload target.',
        variant: 'destructive',
      });
      return;
    }

    const apiHeaders = getApiHeaders();
    const authHeader = apiHeaders.Authorization;
    const impersonateHeader = apiHeaders['X-Impersonate-User-Id'];
    const uploadBatchId = createUploadBatchId();
    const failedFiles: File[] = [];
    const uploadResult = {
      shootId,
      successCount: 0,
      errorCount: 0,
      floorplanCount: 0,
      videoCount: 0,
      errors: [] as string[],
      uploadType: 'raw' as const,
    };

    trackUpload({
      shootId: String(shootId),
      shootAddress: `Shoot #${shootId}`,
      fileCount: files.length,
      fileNames: files.map((file) => file.name),
      uploadType: 'raw',
      uploadFn: async (onProgress) => {
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          const isVideo = isVideoUpload(file);
          const shouldMarkFloorplan = action.classification === 'floorplan' || (!isVideo && isFloorplanUpload(file));

          await new Promise<void>((resolve) => {
            const formData = new FormData();
            formData.append('files[]', file);
            formData.append('upload_type', 'raw');
            formData.append('upload_batch_id', uploadBatchId);
            formData.append('upload_batch_total', String(files.length));
            formData.append('upload_batch_index', String(index));
            if (isVideo) {
              formData.append('service_category', 'video');
            }
            if (shouldMarkFloorplan) {
              formData.append('media_type', 'floorplan');
            }

            const xhr = new XMLHttpRequest();
            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                uploadResult.successCount += 1;
                if (shouldMarkFloorplan) uploadResult.floorplanCount += 1;
                if (isVideo) uploadResult.videoCount += 1;
                resolve();
                return;
              }

              let message = 'Upload failed';
              try {
                const payload = JSON.parse(xhr.responseText || '{}');
                message = payload?.message || payload?.error || message;
              } catch {
                // Keep the generic message when the server response is not JSON.
              }
              uploadResult.errorCount += 1;
              uploadResult.errors.push(`${file.name}: ${message}`);
              failedFiles.push(file);
              resolve();
            });
            xhr.addEventListener('error', () => {
              uploadResult.errorCount += 1;
              uploadResult.errors.push(`${file.name}: Network error`);
              failedFiles.push(file);
              resolve();
            });
            xhr.open('POST', `${API_BASE_URL}/api/shoots/${shootId}/upload`);
            if (authHeader) xhr.setRequestHeader('Authorization', authHeader);
            if (impersonateHeader) xhr.setRequestHeader('X-Impersonate-User-Id', impersonateHeader);
            xhr.send(formData);
          });

          onProgress(Math.round(((index + 1) / files.length) * 100));
        }

        if (uploadResult.successCount === 0) {
          throw new Error(uploadResult.errors[0] || 'All files failed to upload');
        }
      },
      onComplete: () => {
        pendingUploadFilesRef.current = failedFiles;
        setPendingUploadFiles(failedFiles);
        setPendingUploadId(failedFiles.length > 0 ? createUploadBatchId() : null);
        void handleSendMessage(`Upload finished for shoot #${shootId}.`, {
          uploadResult,
          targetShootId: shootId,
        });
      },
      onError: (error) => {
        void handleSendMessage(`Upload failed for shoot #${shootId}: ${error}`, {
          uploadResult: {
            ...uploadResult,
            errorCount: uploadResult.errorCount || files.length,
          },
          targetShootId: shootId,
        });
      },
    });

    toast({
      title: 'Robbie upload started',
      description: `${files.length} file${files.length === 1 ? '' : 's'} uploading to shoot #${shootId}.`,
    });
  }, [handleSendMessage, trackUpload]);

  const handleUploadFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (selected.length === 0) return;

    const accepted = selected.slice(0, MAX_ROBBIE_UPLOAD_FILES);
    if (selected.length > MAX_ROBBIE_UPLOAD_FILES) {
      toast({
        title: 'Only 1000 files added',
        description: `${selected.length - MAX_ROBBIE_UPLOAD_FILES} file(s) were skipped.`,
        variant: 'destructive',
      });
    }

    const uploadId = createUploadBatchId();
    pendingUploadFilesRef.current = accepted;
    setPendingUploadFiles(accepted);
    setPendingUploadId(uploadId);

    void handleSendMessage(`Upload ${accepted.length} file${accepted.length === 1 ? '' : 's'} to a shoot.`, {
      pendingUpload: {
        uploadId,
        fileCount: accepted.length,
        fileNames: accepted.slice(0, 12).map((file) => file.name),
        classification: 'auto',
      },
      targetShootId: pageContext.entityType === 'shoot' ? pageContext.entityId : undefined,
      source: 'robbie_attachment_tray',
    });
  }, [handleSendMessage, pageContext.entityId, pageContext.entityType]);

  useEffect(() => {
    const state = location.state as InsightNavigationState | null;
    if (!state?.initialMessage || hasConsumedNavigation.current) return;

    hasConsumedNavigation.current = true;
    void handleSendMessage(state.initialMessage, state.context);
    navigate(location.pathname, { replace: true, state: null });
  }, [handleSendMessage, location.pathname, location.state, navigate]);

  // Listen for insight strip clicks while already on the chat screen.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; context?: AiChatRequest['context'] }>).detail;
      const text = detail?.message?.trim();
      if (!text) return;
      void handleSendMessage(text, detail?.context);
    };
    window.addEventListener('robbie-insight-send', handler as EventListener);
    return () => {
      window.removeEventListener('robbie-insight-send', handler as EventListener);
    };
  }, [handleSendMessage]);

  // Listen for "Open #N" actions inside chat replies to show the shoot overview modal.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ shootId?: string | number; tab?: ShootModalTab }>).detail;
      if (!detail?.shootId) return;
      setOverviewShootTab(detail.tab || 'overview');
      setOverviewShootId(String(detail.shootId));
    };
    window.addEventListener('ai-open-shoot', handler as EventListener);
    return () => {
      window.removeEventListener('ai-open-shoot', handler as EventListener);
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AiActionPayload>).detail;
      if (detail?.type) {
        startConfirmedRobbieUpload(detail);
      }
    };
    window.addEventListener('robbie-start-upload', handler as EventListener);
    return () => {
      window.removeEventListener('robbie-start-upload', handler as EventListener);
    };
  }, [startConfirmedRobbieUpload]);

  const handleCardClick = useCallback((cardType: 'booking' | 'listing' | 'insight') => {
    if (isSendingRef.current || isLoading) return;
    if (viewMode === 'home') {
      setViewMode('chat');
      setTabMode('chat');
    }

    const prompts = {
      booking: { message: 'Book a new shoot', intent: 'book_shoot' },
      listing: { message: 'Rewrite the listing description for one of my properties in a more premium tone.', intent: undefined },
      insight: { message: 'Summarize key selling points for one of my properties.', intent: undefined },
    };

    const prompt = prompts[cardType];
    handleSendMessage(prompt.message, { intent: prompt.intent });
    // Focus input after a brief delay
    setTimeout(() => {
      const input = document.querySelector('input[placeholder="Type your message..."]') as HTMLInputElement;
      input?.focus();
    }, 100);
  }, [handleSendMessage, isLoading, viewMode]);

  const handleSessionClick = async (session: AiChatSession) => {
    setSessionId(session.id);
    setViewMode('chat');
    setTabMode('chat');
    await loadSessionMessages(session.id);
  };

  const handleDeleteSession = useCallback(async (deletedSessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteAiSession(deletedSessionId);
      toast({
        title: 'Success',
        description: 'Chat deleted successfully',
      });
      // Remove from local state
      setSessions(prev => prev.filter(s => s.id !== deletedSessionId));
      // If this was the current session, reset
      if (deletedSessionId === sessionId) {
        setViewMode('home');
        setSessionId(null);
        setMessages([]);
      }
    } catch (error: unknown) {
      console.error('Failed to delete session:', error);
      toast({
        title: 'Error',
        description: getApiErrorInfo(error).response?.data?.message || 'Failed to delete chat',
        variant: 'destructive',
      });
    }
  }, [sessionId]);

  const handleArchiveSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      await archiveAiSession(sessionId);
      toast({
        title: 'Success',
        description: 'Chat archived successfully',
      });
      // Reload sessions to reflect the change
      await loadSessions();
    } catch (error: unknown) {
      console.error('Failed to archive session:', error);
      toast({
        title: 'Error',
        description: getApiErrorInfo(error).response?.data?.message || 'Failed to archive chat',
        variant: 'destructive',
      });
    }
  }, [loadSessions]);

  const handleToggleSelect = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  }, []);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredSessions = sessions.filter((session) => {
    const sessionTitle = (session?.title ?? '').toString().toLowerCase();
    return sessionTitle.includes(normalizedSearchTerm);
  });

  const handleSelectAll = useCallback(() => {
    if (selectedSessions.size === filteredSessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(filteredSessions.map(s => s.id)));
    }
  }, [selectedSessions.size, filteredSessions]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedSessions.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedSessions.size} chat${selectedSessions.size > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }

    const sessionsToDelete = Array.from(selectedSessions);
    const wasCurrentSession = sessionId && sessionsToDelete.includes(sessionId);

    try {
      const deletePromises = sessionsToDelete.map(id => deleteAiSession(id));
      await Promise.all(deletePromises);
      
      toast({
        title: 'Success',
        description: `${selectedSessions.size} chat${selectedSessions.size > 1 ? 's' : ''} deleted successfully`,
      });
      
      // Clear selection and reload
      setSelectedSessions(new Set());
      await loadSessions();
      
      // If any deleted session was the current one, reset
      if (wasCurrentSession) {
        setViewMode('home');
        setSessionId(null);
        setMessages([]);
      }
    } catch (error: unknown) {
      console.error('Failed to delete sessions:', error);
      toast({
        title: 'Error',
        description: getApiErrorInfo(error).response?.data?.message || 'Failed to delete chats',
        variant: 'destructive',
      });
    }
  }, [selectedSessions, sessionId, loadSessions]);

  const handleBackToHome = useCallback(() => {
    setViewMode('home');
    setMessages([]);
    setSessionId(null);
    setMessage('');
    setCurrentSuggestions([]);
  }, []);

  const handleNavigateBack = useCallback(() => {
    try {
      const lastRoute = sessionStorage.getItem('robbie_last_route');
      if (lastRoute && lastRoute !== location.pathname) {
        navigate(lastRoute);
        return;
      }
    } catch (error) {
      // ignore storage errors
    }
    navigate(-1);
  }, [location.pathname, navigate]);

  const pagePrompts = useMemo(() => getPagePrompts(pageContext.page), [pageContext.page]);
  const suggestionFallbacks = pagePrompts ?? DEFAULT_PROMPTS;

  // On the Robbie home view we hide the entire sticky tab header (tabs +
  // bottom divider line) for a cleaner, focused landing screen. The History
  // tab is still reachable from the "View all" button in Recent chats.
  const isRobbieHome = tabMode === 'chat' && viewMode === 'home';

  return (
    <ChatWithReproAiView
      {...{
        isRobbieHome,
        tabMode,
        filteredSessions,
        searchTerm,
        isMobile,
        handleNavigateBack,
        setTabMode,
        viewMode,
        setViewMode,
        sessionId,
        messages,
        handleBackToHome,
        contentScrollRef,
        userName,
        suggestedCards: SUGGESTED_CARDS,
        activeCardIndex,
        setActiveCardIndex,
        handleCardClick,
        sessions,
        isLoadingSessions,
        handleSessionClick,
        getSessionDisplayLabel: getAiSessionDisplayLabel,
        formatTimestamp: formatAiSessionTimestamp,
        visibleMessages,
        isLoading,
        messagesEndRef,
        sessionsStats,
        setSearchTerm,
        selectedSessions,
        setSelectedSessions,
        handleBulkDelete,
        handleSelectAll,
        handleToggleSelect,
        handleArchiveSession,
        handleDeleteSession,
        currentSuggestions,
        shouldShowFallbackSuggestions,
        suggestionFallbacks,
        getIntentFromSuggestion,
        handleSendMessage,
        messageInputRef,
        message,
        setMessage,
        resizeMessageInput,
        uploadInputRef,
        FULL_UPLOAD_ACCEPT,
        handleUploadFileSelect,
        pendingUploadFiles,
        pendingUploadFilesRef,
        setPendingUploadFiles,
        setPendingUploadId,
        overviewShootId,
        setOverviewShootId,
        overviewShootTab,
      }}
    />
  );
};

export default ChatWithReproAi;
