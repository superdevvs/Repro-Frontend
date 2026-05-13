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
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { AiMessageBubble } from '@/components/ai/AiMessageBubble';
import { cn } from '@/lib/utils';
import { sendAiMessage, fetchAiSessions, fetchAiSessionMessages, deleteAiSession, archiveAiSession } from '@/services/aiService';
import type { AiChatRequest, AiMessage, AiChatSession } from '@/types/ai';
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

type ViewMode = 'home' | 'chat';
type TabMode = 'chat' | 'history';

type InsightNavigationState = {
  initialMessage?: string;
  context?: AiChatRequest['context'];
  source?: string;
};

type PageContext = {
  page?: string;
  route?: string;
  tab?: string;
  entityId?: string;
  entityType?: string;
};

const ChatWithReproAi = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const hasConsumedNavigation = useRef(false);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isSendingRef = useRef(false);
  const shouldAutoScrollRef = useRef(false);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
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
  const lastAssistantStep = (lastAssistantMessage?.metadata as any)?.step as string | undefined;
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
      setActiveCardIndex((prev) => (prev + 1) % suggestedCards.length);
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
      const normalizedSessions: AiChatSession[] = Array.isArray(response.data)
        ? response.data
            .map((session: any) => {
              const createdAt = session?.createdAt ?? session?.created_at;
              const updatedAt = session?.updatedAt ?? session?.updated_at ?? createdAt;

              const previewRaw = session?.preview ?? session?.last_message ?? session?.lastMessage ?? null;
              return {
                id: String(session?.id ?? ''),
                title: (session?.title ?? '').toString(),
                topic: (session?.topic ?? 'general') as AiChatSession['topic'],
                messageCount: Number(session?.messageCount ?? session?.messages_count ?? 0),
                preview: typeof previewRaw === 'string' ? previewRaw : null,
                createdAt: typeof createdAt === 'string' ? createdAt : new Date().toISOString(),
                updatedAt: typeof updatedAt === 'string' ? updatedAt : new Date().toISOString(),
              };
            })
            .filter((session: AiChatSession) => session.id !== '')
        : [];

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

  const handleSendMessage = useCallback(async (msg?: string, context?: { mode?: 'booking' | 'listing' | 'insight' | 'general'; propertyId?: string; listingId?: string; intent?: string }) => {
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
    } catch (error: any) {
      console.error('Failed to send message:', error);
      
      // Log detailed network error info
      if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
        const baseURL = error?.config?.baseURL || 'unknown';
        const url = error?.config?.url || 'unknown';
        const fullUrl = `${baseURL}${url}`;
        console.error('Network Error Details:', {
          fullUrl,
          baseURL,
          url,
          method: error?.config?.method,
          code: error?.code,
          message: error?.message,
        });
      }
      
      // Determine error message based on error type
      let errorMessage = 'Failed to send message';
      if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
        const baseURL = error?.config?.baseURL || 'unknown';
        const url = error?.config?.url || 'unknown';
        errorMessage = `Unable to connect to the server at ${baseURL}${url}. Please check:\n\n1. Is the backend server running? (php artisan serve)\n2. Is the API URL correct? (Check .env VITE_API_URL)\n3. Check browser console for CORS errors`;
      } else if (error?.response?.status === 401 || error?.response?.status === 419) {
        errorMessage = 'Your session has expired. Please refresh the page and try again.';
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
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
      const detail = (event as CustomEvent<{ shootId?: string | number }>).detail;
      if (!detail?.shootId) return;
      setOverviewShootId(String(detail.shootId));
    };
    window.addEventListener('ai-open-shoot', handler as EventListener);
    return () => {
      window.removeEventListener('ai-open-shoot', handler as EventListener);
    };
  }, []);

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
    } catch (error: any) {
      console.error('Failed to delete session:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Failed to delete chat',
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
    } catch (error: any) {
      console.error('Failed to archive session:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Failed to archive chat',
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
    } catch (error: any) {
      console.error('Failed to delete sessions:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Failed to delete chats',
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

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = Math.max(0, now.getTime() - date.getTime());
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

  // Build a short, friendly label for a session row.
  // Prefer a real title; otherwise fall back to the latest message preview
  // trimmed to ~5 words so the list reads like a human summary.
  const getSessionDisplayLabel = useCallback((session: AiChatSession): string => {
    const PLACEHOLDER_TITLES = new Set(['new conversation', 'new chat', '']);
    const rawTitle = (session.title ?? '').trim();
    const isPlaceholderTitle = PLACEHOLDER_TITLES.has(rawTitle.toLowerCase());

    if (rawTitle && !isPlaceholderTitle) {
      return rawTitle;
    }

    const preview = (session.preview ?? '').trim();
    if (!preview) {
      return 'New conversation';
    }

    const words = preview.split(/\s+/).filter(Boolean);
    if (words.length <= 5) {
      return preview.length > 60 ? `${preview.slice(0, 57)}…` : preview;
    }
    return `${words.slice(0, 5).join(' ')}…`;
  }, []);

  const suggestedCards = [
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

  const defaultPrompts = [
    'Book a new shoot',  // First and most prominent suggestion
    'Rewrite the listing description for 19 Ocean Drive in a more premium tone.',
    'Which of my listings most need new media?',
    'Summarize key selling points for 12 Park Lane.',
    'Draft an Instagram carousel caption for my latest listing.',
    'What should I do this week to improve my active listings?',
  ];

  const pagePrompts = useMemo(() => {
    switch (pageContext.page) {
      case 'dashboard':
        return [
          'Manage a booking',
          'Book a new shoot',
          'Check availability',
          'Show upcoming shoots',
        ];
      case 'shoot_history':
        return [
          'Manage a booking',
          'Reschedule a booking',
          'Cancel a booking',
          'Search by address',
        ];
      case 'shoot_details':
        return [
          'Reschedule this shoot',
          'Cancel this booking',
          'Change services',
          'Manage another booking',
        ];
      case 'book_shoot':
        return [
          'Book a new shoot',
          'Tomorrow',
          'This week',
          'Next week',
        ];
      case 'availability':
        return [
          'Check availability',
          'Today',
          'Tomorrow',
          'All photographers',
        ];
      case 'accounting':
        return [
          'View outstanding invoices',
          'Accounting summary',
          'Create invoice',
          'Payment status',
        ];
      case 'invoices':
        return [
          'Create invoice',
          'Send invoice',
          'View outstanding invoices',
          'Apply discount',
        ];
      case 'ai_editing':
        return [
          'Rewrite listing description',
          'Suggest upgrades',
          'Which listings need new media?',
          'Generate captions',
        ];
      case 'reports':
        return [
          'Revenue this month',
          'Top clients',
          'Photographer performance',
          'Shoots completed',
        ];
      case 'settings':
        return [
          'Update scheduling settings',
          'Manage integrations',
          'Tour branding',
          'Help & FAQ',
        ];
      default:
        return undefined;
    }
  }, [pageContext.page]);

  const suggestionFallbacks = pagePrompts ?? defaultPrompts;

  // On the Robbie home view we hide the entire sticky tab header (tabs +
  // bottom divider line) for a cleaner, focused landing screen. The History
  // tab is still reachable from the "View all" button in Recent chats.
  const isRobbieHome = tabMode === 'chat' && viewMode === 'home';

  return (
    <DashboardLayout hideNavbar={false} hideFooter className="!p-0 !pb-0 !min-h-0">
      {/* Let content grow naturally so <main> scrolls */}
      <div className="flex flex-col flex-1">
        {/* ── TOP AREA: sticky page header + controls (hidden on Robbie home) ── */}
        {!isRobbieHome && (
        <div className="sticky top-0 z-50 shrink-0 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="mx-auto w-full max-w-5xl px-2 md:px-4 pt-2 md:pt-3 pb-2 md:pb-3">
            <div
              className={cn(
                "flex items-start md:items-center gap-2 pointer-events-auto",
                tabMode === 'history' ? 'justify-between' : 'justify-end'
              )}
            >
              {tabMode === 'history' && (
                <div className="min-w-0 pr-2">
                  <h2 className="text-xl md:text-2xl font-semibold leading-tight">Chat History</h2>
                  <p className="text-sm text-muted-foreground">
                    {filteredSessions.length} {filteredSessions.length === 1 ? 'conversation' : 'conversations'}
                    {searchTerm && ` matching "${searchTerm}"`}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 shrink-0">
                {tabMode === 'history' && !isMobile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    onClick={handleNavigateBack}
                    aria-label="Go back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="ml-1">Back</span>
                  </Button>
                )}
                <Tabs value={tabMode} onValueChange={(v) => {
                const newTab = v as TabMode;
                const previousTab = tabMode;
                setTabMode(newTab);
                // Navigation logic:
                // - If clicking "Ai Chat" tab while in chat view, go back to home (handled by onClick)
                // - If clicking "Ai Chat" tab while in history tab, go to chat view (if there's a session)
                if (newTab === 'chat') {
                  // Don't handle chat view -> home here, it's handled by onClick
                  if (previousTab === 'history' && viewMode !== 'chat') {
                    // Coming from history tab, go to chat view if there's a session
                    if (sessionId || messages.length > 0) {
                      setViewMode('chat');
                    }
                  }
                }
              }}>
                <TabsList 
                  className={cn(
                    "flex flex-row items-center p-1 md:p-[5px] gap-1 md:gap-4",
                    "w-fit md:w-auto min-w-[160px]",
                    "h-10 md:h-[52px]",
                    "rounded-[50px]",
                    "bg-muted/30 dark:bg-slate-900/80",
                    "border border-border/50 shadow-sm",
                    "backdrop-blur-sm",
                    "overflow-visible"
                  )}
                >
                  <TabsTrigger 
                    value="chat"
                    onClick={(e) => {
                      // Handle click explicitly for navigation
                      if (viewMode === 'chat') {
                        e.preventDefault();
                        handleBackToHome();
                      }
                    }}
                    className={cn(
                      "h-full rounded-[50px]",
                      "text-xs md:text-sm font-semibold transition-all duration-300 ease-in-out",
                      "data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground",
                      "data-[state=active]:border data-[state=active]:border-primary/20",
                      "data-[state=inactive]:text-muted-foreground/80 data-[state=inactive]:hover:text-foreground",
                      "data-[state=inactive]:hover:bg-muted/50",
                      "group relative",
                      // Only allow expansion in conversation screen
                      viewMode === 'chat' ? "overflow-visible" : "overflow-hidden",
                      // Padding: consistent for all modes
                      "px-4 md:px-4",
                      // Special styling when history tab is active
                      tabMode === 'history' && '[&[data-state=inactive]]:bg-primary/10 [&[data-state=inactive]]:text-primary [&[data-state=inactive]]:font-semibold dark:[&[data-state=inactive]]:bg-primary/20 dark:[&[data-state=inactive]]:text-primary'
                    )}
                    style={viewMode === 'chat' ? {
                      minWidth: 'fit-content',
                      flex: '1 1 auto'
                    } : {
                      flex: '1 1 0%'
                    }}
                  >
                    <span className="flex items-center justify-center transition-all duration-200 whitespace-nowrap">
                      <span className="text-center">Home</span>
                    </span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="history"
                    className={cn(
                      "flex-1 h-full rounded-[50px]",
                      "text-xs md:text-sm font-semibold transition-all duration-300 ease-in-out",
                      "data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground",
                      "data-[state=active]:border data-[state=active]:border-primary/20",
                      "data-[state=inactive]:text-muted-foreground/80 data-[state=inactive]:hover:text-foreground",
                      "data-[state=inactive]:hover:bg-muted/50",
                      "px-4 md:px-4"
                    )}
                  >
                    History
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              </div>
            </div>
          </div>
        </div>
        )}

        <div
          ref={contentScrollRef}
          className={cn(
            "relative flex flex-col flex-1",
            tabMode === 'history'
              ? "pb-16 md:pb-0"
              : viewMode === 'chat'
                ? "pb-56 md:pb-0"
                : ""
          )}
        >
        {/* Tabs Content */}
        <div className="flex flex-col">
          {tabMode === 'chat' && (
            <div className="mt-0 flex flex-col">
              <AnimatePresence mode="sync">
                {viewMode === 'home' ? (
                  <motion.div
                    key="home"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.24, ease: 'easeOut' }}
                    className="flex flex-col items-center justify-center space-y-3 md:space-y-4 px-4 py-6 md:py-10 min-h-[calc(100vh-180px)] md:min-h-[calc(100vh-200px)]"
                  >
                    {/* Welcome Section - Top-aligned */}
                    <motion.div
                      initial={{ opacity: 0, y: 14, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.08, duration: 0.3, ease: 'easeOut' }}
                      className="flex flex-col items-center space-y-2 md:space-y-3 text-center max-w-2xl px-2 mx-auto"
                    >
                      <ReproAiIcon
                        className={`w-14 h-14 md:w-20 md:h-20 mx-auto ${isMobile ? 'text-blue-600' : ''}`}
                        useSolid={isMobile}
                      />
                      <div className="w-full">
                        <h2 className="text-xl md:text-3xl font-semibold mb-1 md:mb-2 text-center">
                          Welcome, {userName}
                        </h2>
                        <p className="text-muted-foreground text-sm md:text-base px-2 text-center">
                          Use Robbie to book shoots, improve your listings, and understand your properties in one place.
                        </p>
                      </div>
                    </motion.div>

                    {/* Suggested Cards */}
                    <div className="w-full max-w-4xl px-2">
                      {/* Mobile: Stacked cards with auto-rotation */}
                      <div className="md:hidden relative mt-8">
                        <div className="relative w-full max-w-[340px] mx-auto" style={{ minHeight: `${suggestedCards.length * 24 + 140}px` }}>
                          {suggestedCards.map((card, index) => {
                            // Calculate position relative to active card
                            const relativePosition = (index - activeCardIndex + suggestedCards.length) % suggestedCards.length;
                            const offset = relativePosition * 24;
                            const zIndex = suggestedCards.length - relativePosition;
                            const scale = 1 - relativePosition * 0.02;
                            const opacity = relativePosition === 0 ? 1 : 0.85 - relativePosition * 0.15;
                            
                            return (
                              <motion.div
                                key={card.type}
                                initial={false}
                                animate={{ 
                                  y: offset,
                                  scale,
                                  opacity,
                                  zIndex,
                                }}
                                transition={{ 
                                  type: "spring",
                                  stiffness: 300,
                                  damping: 30,
                                }}
                                className="absolute left-0 right-0 mx-auto"
                                style={{ zIndex }}
                              >
                                <Card 
                                  className="cursor-pointer transition-shadow duration-200 hover:shadow-lg border border-border/60 bg-card backdrop-blur-sm"
                                  onClick={() => {
                                    setActiveCardIndex(index);
                                    handleCardClick(card.type);
                                  }}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex flex-col">
                                      <h4 className="font-semibold text-base mb-1">{card.title}</h4>
                                      <p className="text-sm text-muted-foreground leading-relaxed">
                                        {card.description}
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                      {/* Desktop: Grid */}
                      <h3 className="hidden md:block text-sm font-medium text-muted-foreground mb-4">Suggested for you</h3>
                      <div className="hidden md:grid md:grid-cols-3 gap-4 items-stretch">
                        {suggestedCards.map((card, index) => {
                          return (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 20, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 + index * 0.08, duration: 0.28, ease: 'easeOut' }}
                              whileHover={{ y: -4, transition: { duration: 0.2 } }}
                              className="h-full"
                            >
                              <Card 
                                className="cursor-pointer hover:shadow-md transition-shadow h-full"
                                onClick={() => handleCardClick(card.type)}
                              >
                                <CardContent className="p-6 h-full">
                                  <div className="flex flex-col h-full">
                                    <h4 className="font-semibold mb-2">{card.title}</h4>
                                    <p className="text-sm text-muted-foreground">
                                      {card.description}
                                    </p>
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Recent chats — bottom area preview, mirrors AI Editing's "Recent activity" */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.32, duration: 0.3, ease: 'easeOut' }}
                      className="w-full max-w-4xl px-2 pt-2 md:pt-4"
                    >
                      <div className="rounded-xl border bg-card/60 backdrop-blur-sm p-3 md:p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-sm md:text-base font-semibold">Recent chats</h3>
                            <p className="text-[11px] md:text-xs text-muted-foreground">
                              Pick up where you left off with Robbie.
                            </p>
                          </div>
                          {sessions.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => setTabMode('history')}
                            >
                              View all
                            </Button>
                          )}
                        </div>

                        {isLoadingSessions && sessions.length === 0 ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : sessions.length === 0 ? (
                          <div className="rounded-lg border border-dashed p-6 text-center">
                            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                              <MessageSquare className="h-5 w-5 text-primary" />
                            </div>
                            <p className="text-sm font-medium">No conversations yet</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Start a chat above to see it here.
                            </p>
                          </div>
                        ) : (
                          <div
                            className="max-h-[200px] md:max-h-[210px] space-y-1 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60"
                          >
                            {sessions.slice(0, 20).map((session) => (
                              <button
                                key={session.id}
                                onClick={() => handleSessionClick(session)}
                                className="group w-full text-left"
                              >
                                <div className="flex items-center gap-3 rounded-lg border border-transparent p-2.5 md:p-3 transition-colors hover:border-border hover:bg-secondary/50">
                                  <div className="flex h-8 w-8 md:h-9 md:w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                                    <MessageSquare className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
                                    <h4 className="truncate text-sm font-medium transition-colors group-hover:text-primary">
                                      {getSessionDisplayLabel(session)}
                                    </h4>
                                    <span className="hidden md:inline text-xs text-muted-foreground whitespace-nowrap">
                                      {session.messageCount || 0} {session.messageCount === 1 ? 'message' : 'messages'}
                                    </span>
                                    <div className="ml-auto flex items-center gap-1.5 whitespace-nowrap text-[11px] md:text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      <span>{formatTimestamp(session.updatedAt)}</span>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.08 }}
                    className="flex flex-col"
                  >
                    {/* Messages List */}
                    <div className="px-2 md:px-6 space-y-4 pb-4 pt-24 md:pt-28 flex flex-col max-w-5xl mx-auto w-full">
                    {visibleMessages.length > 0 && (
                      <AnimatePresence>
                        {visibleMessages.map((msg, index) => (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <AiMessageBubble message={msg} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-start"
                      >
                        <div className="flex items-end gap-3">
                          <div className="flex-shrink-0 flex h-8 w-8 md:h-9 md:w-9 items-center justify-center">
                            <ReproAiIcon className="h-8 w-8 md:h-9 md:w-9" />
                          </div>
                          <div className="rounded-[999px] px-4 py-2 flex items-center gap-2 bg-blue-100 text-slate-900 dark:bg-blue-500/20 dark:text-blue-100">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Thinking...</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {/* Scroll anchor */}
                    <div ref={messagesEndRef} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

            {/* History Tab Content */}
          {tabMode === 'history' && (
            <div className="mt-0 flex-1 min-h-0 flex flex-col">
              <div className="flex flex-col flex-1 min-h-0 max-w-5xl mx-auto w-full px-2 md:px-4 py-2 md:py-4">
                {/* Header Section with Stats */}
              <div className="mb-4 md:mb-8">
                {/* Stats Cards */}
                {filteredSessions.length > 0 && (
                  <>
                    {/* Mobile: compact stat pills */}
                    <div className="md:hidden mb-4 -mx-0.5 px-0.5 flex items-stretch gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      <div className="shrink-0 min-w-[132px] rounded-lg border bg-card/80 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">This Week</p>
                        <p className="text-sm font-semibold">{sessionsStats.thisWeekCount}</p>
                      </div>
                      <div className="shrink-0 min-w-[132px] rounded-lg border bg-card/80 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">Avg. Messages</p>
                        <p className="text-sm font-semibold">{sessionsStats.avgMessagesPerSession}</p>
                      </div>
                      <div className="shrink-0 min-w-[132px] rounded-lg border bg-card/80 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">Top Topic</p>
                        <p className="text-sm font-semibold capitalize truncate">{sessionsStats.topTopic}</p>
                      </div>
                    </div>

                    {/* Desktop/tablet: full stat cards */}
                    <div className="hidden md:grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      <div className="rounded-lg border bg-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">This Week</span>
                        </div>
                        <p className="text-2xl font-bold">{sessionsStats.thisWeekCount}</p>
                        <p className="text-xs text-muted-foreground mt-1">conversations started</p>
                      </div>
                      <div className="rounded-lg border bg-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Avg. Messages</span>
                        </div>
                        <p className="text-2xl font-bold">{sessionsStats.avgMessagesPerSession}</p>
                        <p className="text-xs text-muted-foreground mt-1">per conversation</p>
                      </div>
                      <div className="rounded-lg border bg-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Code className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Top Topic</span>
                        </div>
                        <p className="text-lg font-bold capitalize">{sessionsStats.topTopic}</p>
                        <p className="text-xs text-muted-foreground mt-1">most discussed</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Search Bar and Selection Controls */}
              <div className="mb-3 md:mb-6 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search chat history..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-secondary/30 border-0"
                  />
                </div>
                
                {/* Selection Controls */}
                {selectedSessions.size > 0 && (
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {selectedSessions.size} chat{selectedSessions.size > 1 ? 's' : ''} selected
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSessions(new Set())}
                        className="h-7 text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      className="h-7 text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete Selected
                    </Button>
                  </div>
                )}
              </div>

              {/* Chat History List */}
              <div className="flex-1 min-h-0 pb-4 md:pb-2">
                {isLoadingSessions ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <MessageSquare className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
                      {searchTerm ? 'No chats found' : 'No chat history yet'}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md">
                      {searchTerm 
                        ? 'Try adjusting your search terms to find what you\'re looking for'
                        : 'Start a conversation with Robbie to see your chat history appear here'
                      }
                    </p>
                    {!searchTerm && (
                      <Button onClick={() => setTabMode('chat')} size="lg">
                        <Plus className="h-4 w-4 mr-2" />
                        Start New Chat
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Select All Header */}
                    {filteredSessions.length > 0 && (
                      <div className="flex items-center gap-3 p-2 border-b border-border/50">
                        <Checkbox
                          checked={selectedSessions.size === filteredSessions.length && filteredSessions.length > 0}
                          onCheckedChange={handleSelectAll}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-xs text-muted-foreground">
                          Select all ({filteredSessions.length})
                        </span>
                      </div>
                    )}
                    
                    {filteredSessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => {
                          if (!selectedSessions.has(session.id)) {
                            handleSessionClick(session);
                          }
                        }}
                        className={cn(
                          "w-full text-left group",
                          selectedSessions.has(session.id) && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-center gap-2 md:gap-4 p-2.5 md:p-4 rounded-lg hover:bg-secondary/50 transition-colors border border-transparent hover:border-border">
                          <Checkbox
                            checked={selectedSessions.has(session.id)}
                            onCheckedChange={() => {}}
                            onClick={(e) => handleToggleSelect(session.id, e)}
                            className="shrink-0"
                          />
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                            <MessageSquare className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                              <h4 className="font-medium text-sm md:text-base truncate group-hover:text-primary transition-colors">
                                {getSessionDisplayLabel(session)}
                              </h4>
                              <div className="ml-auto flex items-center gap-1.5 text-[11px] md:text-xs text-muted-foreground whitespace-nowrap">
                                <Clock className="h-3 w-3" />
                                <span>{formatTimestamp(session.updatedAt)}</span>
                              </div>
                              <span className="hidden md:inline text-muted-foreground/50">•</span>
                              <span className="hidden md:inline text-xs text-muted-foreground whitespace-nowrap">
                                {session.messageCount || 0} {session.messageCount === 1 ? 'message' : 'messages'}
                              </span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                    }}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem
                                    onClick={(e) => handleArchiveSession(session.id, e)}
                                    className="cursor-pointer"
                                  >
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(e) => handleDeleteSession(session.id, e)}
                                    className="cursor-pointer text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </div>
          )}
        </div>
        </div>

        {/* ── BOTTOM AREA: fixed chat bar ── */}
        {tabMode === 'chat' && (
          <div className={cn(
            "border-t border-border/10 bg-background fixed bottom-16 md:sticky md:bottom-0 left-0 right-0 pb-[max(0.5rem,calc(env(safe-area-inset-bottom)+0.5rem))] md:pb-2",
            overviewShootId ? "z-[60]" : "z-[80]"
          )}>
            <div className={cn(
              "max-w-5xl mx-auto px-4 pb-0",
              viewMode === 'chat' ? "pt-4 md:pt-6" : "pt-3"
            )}>
              {/* AI Suggestions - Show ONLY in conversation screen */}
              {viewMode === 'chat' && (currentSuggestions.length > 0 || shouldShowFallbackSuggestions) && (
                <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] mb-3 md:mb-4">
                  {(currentSuggestions.length > 0 ? currentSuggestions : suggestionFallbacks.slice(0, 4)).map((suggestion, index) => {
                    const intent = getIntentFromSuggestion(suggestion);
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          handleSendMessage(suggestion, intent ? { intent } : undefined);
                        }}
                        disabled={isLoading}
                        className={cn(
                          "flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-full transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed",
                          currentSuggestions.length > 0
                            ? "bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary/90 border border-primary/20"
                            : "bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {suggestion}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Input Bar */}
              <div className={cn(
                "flex items-center gap-1.5 md:gap-2"
              )}>
                <div className="flex-1 flex items-center gap-1 md:gap-2 border rounded-lg px-2 md:px-3 py-1.5 md:py-2 bg-background">
                  <textarea
                    ref={messageInputRef}
                    rows={1}
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onInput={resizeMessageInput}
                    className="flex-1 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 text-sm md:text-base leading-6 resize-none min-h-[40px] max-h-[72px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={isLoading}
                  />
                  <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <LinkIcon className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <FileIcon className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9">
                      <Mic className="h-4 w-4 md:h-5 md:w-5" />
                    </Button>
                    <Button 
                      size="icon" 
                      className="h-8 w-8 md:h-9 md:w-9 p-0 rounded-full hover:scale-105 transition-transform"
                      onClick={() => handleSendMessage()}
                      disabled={isLoading || !message.trim()}
                      style={{
                        background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                        boxShadow: '0 4px 14px rgba(59, 130, 246, 0.5), inset 0px 2px 4px rgba(255, 255, 255, 0.25)',
                      }}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 md:h-5 md:w-5 text-white animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 md:h-5 md:w-5 text-white" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="mt-2 text-[10px] md:text-xs text-center text-muted-foreground hidden md:block">
                Robbie may make errors. Check important information.
              </p>
            </div>
          </div>
        )}
      </div>
      {overviewShootId && (
        <Suspense fallback={null}>
          <LazyShootDetailsModal
            shootId={overviewShootId}
            isOpen={Boolean(overviewShootId)}
            onClose={() => setOverviewShootId(null)}
            initialTab="overview"
          />
        </Suspense>
      )}
    </DashboardLayout>
  );
};

export default ChatWithReproAi;
