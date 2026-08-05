import { lazy, Suspense, type ChangeEventHandler, type Dispatch, type MouseEvent, type MutableRefObject, type RefObject, type SetStateAction } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Archive, ArrowLeft, Clock, Code, FileIcon, FileText, Link as LinkIcon, Loader2, MessageSquare,
  Mic, MoreVertical, Plus, Search, Send, Trash2, X,
} from 'lucide-react';
import { AiMessageBubble } from '@/components/ai/AiMessageBubble';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AiChatRequest, AiChatSession, AiMessage } from '@/types/ai';
import type { ShootModalTab, TabMode, ViewMode } from './chatWithReproAiModel';

const LazyShootDetailsModal = lazy(() =>
  import('@/components/shoots/ShootDetailsModal').then((module) => ({
    default: module.ShootDetailsModal,
  })),
);

type SuggestedCard = {
  icon: LucideIcon;
  title: string;
  description: string;
  type: 'booking' | 'listing' | 'insight';
};

type SessionsStats = {
  thisWeekCount: number;
  avgMessagesPerSession: number;
  topTopic: string;
};

export interface ChatWithReproAiViewProps {
  isRobbieHome: boolean;
  tabMode: TabMode;
  filteredSessions: AiChatSession[];
  searchTerm: string;
  isMobile: boolean;
  handleNavigateBack: () => void;
  setTabMode: Dispatch<SetStateAction<TabMode>>;
  viewMode: ViewMode;
  setViewMode: Dispatch<SetStateAction<ViewMode>>;
  sessionId: string | null;
  messages: AiMessage[];
  handleBackToHome: () => void;
  contentScrollRef: RefObject<HTMLDivElement | null>;
  userName: string;
  suggestedCards: readonly SuggestedCard[];
  activeCardIndex: number;
  setActiveCardIndex: Dispatch<SetStateAction<number>>;
  handleCardClick: (cardType: SuggestedCard['type']) => void;
  sessions: AiChatSession[];
  isLoadingSessions: boolean;
  handleSessionClick: (session: AiChatSession) => Promise<void>;
  getSessionDisplayLabel: (session: AiChatSession) => string;
  formatTimestamp: (dateString: string) => string;
  visibleMessages: AiMessage[];
  isLoading: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  sessionsStats: SessionsStats;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  selectedSessions: Set<string>;
  setSelectedSessions: Dispatch<SetStateAction<Set<string>>>;
  handleBulkDelete: () => Promise<void>;
  handleSelectAll: () => void;
  handleToggleSelect: (sessionId: string, event: MouseEvent) => void;
  handleArchiveSession: (sessionId: string, event: MouseEvent) => Promise<void>;
  handleDeleteSession: (sessionId: string, event: MouseEvent) => Promise<void>;
  currentSuggestions: string[];
  shouldShowFallbackSuggestions: boolean;
  suggestionFallbacks: string[];
  getIntentFromSuggestion: (suggestion: string) => string | undefined;
  handleSendMessage: (message?: string, context?: AiChatRequest['context']) => Promise<void>;
  messageInputRef: RefObject<HTMLTextAreaElement | null>;
  message: string;
  setMessage: Dispatch<SetStateAction<string>>;
  resizeMessageInput: () => void;
  uploadInputRef: RefObject<HTMLInputElement | null>;
  FULL_UPLOAD_ACCEPT: string;
  handleUploadFileSelect: ChangeEventHandler<HTMLInputElement>;
  pendingUploadFiles: File[];
  pendingUploadFilesRef: MutableRefObject<File[]>;
  setPendingUploadFiles: Dispatch<SetStateAction<File[]>>;
  setPendingUploadId: Dispatch<SetStateAction<string | null>>;
  overviewShootId: string | null;
  setOverviewShootId: Dispatch<SetStateAction<string | null>>;
  overviewShootTab: ShootModalTab;
}

export function ChatWithReproAiView(props: ChatWithReproAiViewProps) {
  const {
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
    suggestedCards,
    activeCardIndex,
    setActiveCardIndex,
    handleCardClick,
    sessions,
    isLoadingSessions,
    handleSessionClick,
    getSessionDisplayLabel,
    formatTimestamp,
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
  } = props;

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
                      {/* Beta status + disclaimer sit above the conversation, not below it (Req 8.11) */}
                      <div className="mx-auto flex w-full max-w-2xl items-center justify-center gap-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-center">
                        <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Beta
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Robbie is in beta and can make mistakes. Please verify important details before acting on them.
                        </span>
                      </div>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => uploadInputRef.current?.click()}
                          disabled={isLoading}
                        >
                          <FileIcon className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 md:hidden"
                        onClick={() => uploadInputRef.current?.click()}
                        disabled={isLoading}
                      >
                        <FileIcon className="h-4 w-4" />
                      </Button>
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
  
                <input
                  ref={uploadInputRef}
                  type="file"
                  className="hidden"
                  accept={FULL_UPLOAD_ACCEPT}
                  multiple
                  onChange={handleUploadFileSelect}
                />
  
                {pendingUploadFiles.length > 0 && (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <span className="font-medium">{pendingUploadFiles.length} file{pendingUploadFiles.length === 1 ? '' : 's'} ready for Robbie</span>
                      <span className="ml-2 text-muted-foreground">
                        {pendingUploadFiles.slice(0, 2).map((file) => file.name).join(', ')}
                        {pendingUploadFiles.length > 2 ? `, +${pendingUploadFiles.length - 2} more` : ''}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => {
                        pendingUploadFilesRef.current = [];
                        setPendingUploadFiles([]);
                        setPendingUploadId(null);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
  
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
              initialTab={overviewShootTab}
            />
          </Suspense>
        )}
      </DashboardLayout>
    );
}

