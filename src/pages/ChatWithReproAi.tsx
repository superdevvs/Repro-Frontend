import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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

const ChatWithReproAi = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const hasConsumedNavigation = useRef(false);
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
  
  const userName = user?.name || user?.email?.split('@')[0] || 'there';

  // Auto-rotate stacked cards every 3 seconds
  useEffect(() => {
    if (viewMode !== 'home') return;
    const interval = setInterval(() => {
      setActiveCardIndex((prev) => (prev + 1) % suggestedCards.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [viewMode]);

  // Load sessions when history tab is active
  useEffect(() => {
    if (tabMode === 'history') {
      loadSessions();
    }
  }, [tabMode, searchTerm]);

  // Load session messages when sessionId changes
  useEffect(() => {
    if (sessionId && viewMode === 'chat') {
      loadSessionMessages(sessionId);
    }
  }, [sessionId, viewMode]);

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const response = await fetchAiSessions(searchTerm || undefined);
      setSessions(response.data);
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
      setSessionId(id);
      // Clear suggestions when loading a session (they'll come from next AI response)
      setCurrentSuggestions([]);
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
    if (s.includes('client') || s.includes('stats')) return 'client_stats';
    if (s.includes('accounting') || s.includes('revenue') || s.includes('invoice')) return 'accounting';
    return undefined;
  }, []);

  const handleSendMessage = useCallback(async (msg?: string, context?: { mode?: 'booking' | 'listing' | 'insight' | 'general'; propertyId?: string; listingId?: string; intent?: string }) => {
    const messageToSend = msg || message.trim();
    if (!messageToSend) return;

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

    // Transition to chat view on first message
    if (viewMode === 'home') {
      setViewMode('chat');
      setTabMode('chat');
    }

    // Auto-detect intent from message if not provided
    const intent = context?.intent || getIntentFromSuggestion(messageToSend);
    const finalContext = intent ? { ...context, intent } : context;

    try {
      const response = await sendAiMessage({
        sessionId: sessionId,
        message: messageToSend,
        context: finalContext,
      });

      setSessionId(response.sessionId);
      setMessages(response.messages);
      // Update suggestions from the response
      if (response.meta?.suggestions && Array.isArray(response.meta.suggestions) && response.meta.suggestions.length > 0) {
        setCurrentSuggestions(response.meta.suggestions);
      } else {
        // Keep previous suggestions if new ones aren't provided, or clear if explicitly empty
        if (response.meta?.suggestions === null || (Array.isArray(response.meta?.suggestions) && response.meta.suggestions.length === 0)) {
          setCurrentSuggestions([]);
        }
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
    }
  }, [message, sessionId, viewMode]);

  useEffect(() => {
    const state = location.state as InsightNavigationState | null;
    if (!state?.initialMessage || hasConsumedNavigation.current) return;

    hasConsumedNavigation.current = true;
    void handleSendMessage(state.initialMessage, state.context);
    navigate(location.pathname, { replace: true, state: null });
  }, [handleSendMessage, location.pathname, location.state, navigate]);

  const handleCardClick = (cardType: 'booking' | 'listing' | 'insight') => {
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
  };

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

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

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

  const suggestedPrompts = [
    'Book a new shoot',  // First and most prominent suggestion
    'Rewrite the listing description for 19 Ocean Drive in a more premium tone.',
    'Which of my listings most need new media?',
    'Summarize key selling points for 12 Park Lane.',
    'Draft an Instagram carousel caption for my latest listing.',
    'What should I do this week to improve my active listings?',
  ];

  return (
    <DashboardLayout className="!p-0">
      {/* Single flex column - the ONLY container that cares about height */}
      <div className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-64px)]">
        {/* ── TOP AREA: scrollable content (tabs, hero, messages) ── */}
        <div className={cn(
          "flex-1 relative",
          viewMode === 'home' ? "overflow-hidden" : "overflow-y-auto pb-32 md:pb-0"
        )}>
          {/* Tabs - Top Left - Sticky */}
          <div className="sticky top-0 flex justify-start px-4 md:px-6 pt-3 md:pt-4 pb-2 z-40 bg-background dark:bg-slate-950 backdrop-blur-sm">
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
                  "w-full max-w-[280px] md:w-auto md:min-w-[192px]",
                  "h-10 md:h-[52px]",
                  "rounded-lg md:rounded-[50px]",
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
                    "h-full rounded-md md:rounded-[50px]",
                    "text-xs md:text-sm font-semibold transition-all duration-300 ease-in-out",
                    "data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground",
                    "data-[state=active]:border data-[state=active]:border-primary/20",
                    "data-[state=inactive]:text-muted-foreground/80 data-[state=inactive]:hover:text-foreground",
                    "data-[state=inactive]:hover:bg-muted/50",
                    "group relative",
                    // Only allow expansion in conversation screen
                    viewMode === 'chat' ? "overflow-visible" : "overflow-hidden",
                    // Padding: normal on main/history, expandable on chat
                    viewMode === 'chat' ? "px-0 group-hover:pl-2 group-hover:pr-2" : "px-4 md:px-4",
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
                  <span className={cn(
                    "flex items-center justify-center transition-all duration-200 whitespace-nowrap",
                    viewMode === 'chat' ? "gap-0 group-hover:gap-1.5" : "gap-0"
                  )}>
                    {viewMode === 'chat' && (
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 16 16" 
                        fill="none" 
                        xmlns="http://www.w3.org/2000/svg"
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 w-0 group-hover:w-4 overflow-hidden flex-shrink-0"
                      >
                        <path 
                          d="M10 12L6 8L10 4" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    <span className="text-center">Ai Chat</span>
                  </span>
                </TabsTrigger>
                <TabsTrigger 
                  value="history"
                  className={cn(
                    "flex-1 h-full rounded-md md:rounded-[50px]",
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

          {/* Tabs Content */}
          <Tabs value={tabMode} onValueChange={(v) => {
              const newTab = v as TabMode;
              const previousTab = tabMode;
              setTabMode(newTab);
              // Navigation logic:
              // - If clicking "Ai Chat" tab while in chat view, go back to home
              // - If clicking "Ai Chat" tab while in history tab, go to chat view (if there's a session)
              if (newTab === 'chat') {
                if (viewMode === 'chat') {
                  // Already in chat view, clicking "Ai Chat" goes to home
                  handleBackToHome();
                } else if (previousTab === 'history') {
                  // Coming from history tab, go to chat view if there's a session
                  if (sessionId || messages.length > 0) {
                    setViewMode('chat');
                  }
                }
              }
            }}>
            <TabsContent value="chat" className="mt-0">
              <AnimatePresence mode="wait">
                {viewMode === 'home' ? (
                  <motion.div
                    key="home"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center justify-center space-y-4 md:space-y-6 px-4 pt-12 pb-4 md:py-6"
                  >
                    {/* Welcome Section - Centered */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 }}
                      className="flex flex-col items-center justify-center space-y-2 md:space-y-4 text-center max-w-2xl px-2 mx-auto"
                    >
                      <ReproAiIcon className="w-16 h-16 md:w-24 md:h-24 mx-auto" />
                      <div className="w-full">
                        <h2 className="text-xl md:text-3xl font-semibold mb-1 md:mb-2 text-center">
                          Welcome, {userName}
                        </h2>
                        <p className="text-muted-foreground text-sm md:text-lg px-2 text-center">
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
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 + index * 0.1 }}
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
                  </motion.div>
                ) : (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col flex-1"
                  >
                    {/* Messages List */}
                    <div className="px-4 space-y-4 pb-4 pt-4 md:pt-6 flex-1 flex flex-col">
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center flex-1 min-h-0">
                        <div className="flex flex-col items-center justify-center text-center">
                          <ReproAiIcon className="w-16 h-16 md:w-20 md:h-20 mb-4 opacity-50" />
                          <p className="text-muted-foreground text-sm md:text-base">Start a conversation with Robbie</p>
                        </div>
                      </div>
                    ) : (
                      <AnimatePresence>
                        {messages.map((msg, index) => (
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
                        <div className="bg-secondary rounded-lg px-4 py-2 flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                      </motion.div>
                    )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>

            {/* History Tab Content */}
            <TabsContent value="history" className="mt-0">
              <div className="flex flex-col max-w-5xl mx-auto w-full px-4 py-4">
                {/* Header Section with Stats */}
              <div className="mb-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold mb-1">Chat History</h2>
                  <p className="text-sm text-muted-foreground">
                    {filteredSessions.length} {filteredSessions.length === 1 ? 'conversation' : 'conversations'}
                    {searchTerm && ` matching "${searchTerm}"`}
                  </p>
                </div>

                {/* Stats Cards */}
                {filteredSessions.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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
                )}
              </div>

              {/* Search Bar and Selection Controls */}
              <div className="mb-6 space-y-3">
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
              <div className="flex-1 overflow-y-auto">
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
                        <div className="flex items-start gap-4 p-4 rounded-lg hover:bg-secondary/50 transition-colors border border-transparent hover:border-border">
                          <Checkbox
                            checked={selectedSessions.has(session.id)}
                            onCheckedChange={() => {}}
                            onClick={(e) => handleToggleSelect(session.id, e)}
                            className="mt-1"
                          />
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                            <MessageSquare className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <h4 className="font-medium text-base group-hover:text-primary transition-colors">
                                {session.title}
                              </h4>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
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
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{formatTimestamp(session.updatedAt)}</span>
                              </div>
                              <span className="text-muted-foreground/50">•</span>
                              <span>{session.messageCount || 0} {session.messageCount === 1 ? 'message' : 'messages'}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          </Tabs>
        </div>

        {/* ── BOTTOM AREA: fixed chat bar ── */}
        {tabMode === 'chat' && (
          <div className="border-t bg-background dark:bg-slate-950 shadow-lg fixed bottom-0 md:bottom-auto left-0 right-0 md:relative pb-[max(4rem,calc(env(safe-area-inset-bottom)+4rem))] md:pb-5 z-50">
            <div className={cn(
              "max-w-4xl mx-auto px-4 pb-3 md:pb-5",
              viewMode === 'chat' ? "pt-4 md:pt-6" : "pt-3"
            )}>
              {/* AI Suggestions - Show ONLY in conversation screen */}
              {viewMode === 'chat' && (
                <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] mb-3 md:mb-4">
                  {(currentSuggestions.length > 0 ? currentSuggestions : suggestedPrompts.slice(0, 4)).map((suggestion, index) => {
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
                  <Input
                    type="text"
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 text-sm md:text-base"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={isLoading}
                  />
                  <div className="hidden md:flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <FileIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 flex-shrink-0">
                  <Mic className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
                <Button 
                  size="icon" 
                  className="h-9 w-9 md:h-10 md:w-10 p-0 rounded-full flex-shrink-0 hover:scale-105 transition-transform"
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

              {/* Disclaimer */}
              <p className="text-[10px] md:text-xs text-center text-muted-foreground hidden md:block">
                Robbie may make errors. Check important information.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ChatWithReproAi;
