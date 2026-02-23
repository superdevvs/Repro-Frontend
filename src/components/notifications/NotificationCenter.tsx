import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/config/env";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  BellIcon, 
  CheckIcon, 
  CameraIcon, 
  ClockIcon, 
  Loader2, 
  MessageSquare, 
  CalendarPlus,
  CalendarCheck,
  Play,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Pencil,
  Eye,
  DollarSign,
  Upload,
  AlertCircle,
  Send,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isYesterday, differenceInMinutes } from 'date-fns';
import { useNotifications, NotificationItem } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

// Notification types
type NotificationType = 'all' | 'unread' | 'shoots' | 'messages' | 'system';

// Check if notification is within the last 30 minutes
const isRecent = (dateString: string | null | undefined): boolean => {
  if (!dateString) return false;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;
    const now = new Date();
    const diff = differenceInMinutes(now, date);
    return diff >= 0 && diff <= 30;
  } catch {
    return false;
  }
};

export function NotificationCenter() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { notifications, unreadCount, loading, error, refresh, markAsRead, markAllAsRead } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationType>('unread');
  const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false);
  const [cancellationShootId, setCancellationShootId] = useState<number | null>(null);
  const [cancellationProcessing, setCancellationProcessing] = useState(false);
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [holdShootId, setHoldShootId] = useState<number | null>(null);
  const [holdProcessing, setHoldProcessing] = useState(false);

  // Handle cancellation approval
  const handleApproveCancellation = async () => {
    if (!cancellationShootId) return;
    setCancellationProcessing(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/shoots/${cancellationShootId}/approve-cancellation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      if (response.ok) {
        toast({
          title: "Cancellation approved",
          description: "The shoot has been cancelled successfully.",
        });
        setCancellationDialogOpen(false);
        setCancellationShootId(null);
        refresh();
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.message || "Failed to approve cancellation",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to approve cancellation",
        variant: "destructive",
      });
    } finally {
      setCancellationProcessing(false);
    }
  };

  const handleApproveHold = async () => {
    if (!holdShootId) return;
    setHoldProcessing(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/shoots/${holdShootId}/approve-hold`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      if (response.ok) {
        toast({
          title: 'Hold approved',
          description: 'The shoot has been placed on hold.',
        });
        setHoldDialogOpen(false);
        setHoldShootId(null);
        refresh();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.message || 'Failed to approve hold request',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to approve hold request',
        variant: 'destructive',
      });
    } finally {
      setHoldProcessing(false);
    }
  };

  const handleRejectHold = async () => {
    if (!holdShootId) return;
    setHoldProcessing(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/shoots/${holdShootId}/reject-hold`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ reason: 'Hold request rejected' }),
      });
      if (response.ok) {
        toast({
          title: 'Hold request rejected',
          description: 'The hold request has been rejected.',
        });
        setHoldDialogOpen(false);
        setHoldShootId(null);
        refresh();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.message || 'Failed to reject hold request',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to reject hold request',
        variant: 'destructive',
      });
    } finally {
      setHoldProcessing(false);
    }
  };

  // Handle cancellation rejection
  const handleRejectCancellation = async () => {
    if (!cancellationShootId) return;
    setCancellationProcessing(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/shoots/${cancellationShootId}/reject-cancellation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ reason: 'Admin rejected the cancellation request' }),
      });
      if (response.ok) {
        toast({
          title: "Cancellation rejected",
          description: "The cancellation request has been rejected.",
        });
        setCancellationDialogOpen(false);
        setCancellationShootId(null);
        refresh();
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.message || "Failed to reject cancellation",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to reject cancellation",
        variant: "destructive",
      });
    } finally {
      setCancellationProcessing(false);
    }
  };

  // Handle notification click - mark as read and navigate or show dialog
  const handleNotificationClick = (notification: NotificationItem) => {
    markAsRead(notification.id);
    
    // Check if this is a cancellation request notification
    const notificationAction = notification.action?.toLowerCase() || '';
    const notificationTitle = notification.title.toLowerCase();
    const isCancellation =
      notificationAction.includes('cancellation') || notificationTitle.includes('cancellation');
    const isHoldRequest =
      notificationAction.includes('hold_requested') ||
      notificationAction.includes('hold-requested') ||
      notificationTitle.includes('hold requested');
    
    if (isCancellation && notification.shootId) {
      // Open cancellation approval dialog
      setCancellationShootId(notification.shootId);
      setCancellationDialogOpen(true);
      setIsOpen(false);
      return;
    }

    if (isHoldRequest && notification.shootId) {
      setHoldShootId(notification.shootId);
      setHoldDialogOpen(true);
      setIsOpen(false);
      return;
    }
    
    setIsOpen(false);
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refresh();
    }
  }, [isOpen, refresh]);

  // Filter notifications based on active tab
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => {
      if (activeTab === 'all') return true;
      if (activeTab === 'unread') return !notification.isRead;
      return notification.type === activeTab;
    });
  }, [notifications, activeTab]);

  // Separate recent (last 30 min) from older notifications
  const { recentNotifications, olderNotifications } = useMemo(() => {
    const recent: NotificationItem[] = [];
    const older: NotificationItem[] = [];
    
    filteredNotifications.forEach(notification => {
      if (isRecent(notification.date)) {
        recent.push(notification);
      } else {
        older.push(notification);
      }
    });
    
    return { recentNotifications: recent, olderNotifications: older };
  }, [filteredNotifications]);

  // Format notification date
  const formatNotificationDate = (dateString: string) => {
    const date = new Date(dateString);
    const minutesAgo = differenceInMinutes(new Date(), date);
    
    if (minutesAgo < 1) {
      return 'Just now';
    } else if (minutesAgo < 60) {
      return `${minutesAgo}m ago`;
    } else if (isToday(date)) {
      return `Today, ${format(date, 'h:mm a')}`;
    } else if (isYesterday(date)) {
      return `Yesterday, ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, h:mm a');
    }
  };

  // Get icon + background color based on notification title/type
  const getNotificationIcon = (notification: NotificationItem, _isRecentNotification: boolean): { icon: React.ReactNode; bg: string } => {
    const iconClass = "h-3.5 w-3.5";
    const title = notification.title.toLowerCase();
    const type = notification.type;

    // Messages
    if (type === 'messages' || title.includes('sms') || title.includes('message') || title.includes('email')) {
      return { icon: <MessageSquare className={cn(iconClass, "text-purple-600 dark:text-purple-400")} />, bg: "bg-purple-100 dark:bg-purple-900/40" };
    }

    // Payment / Invoice
    if (title.includes('payment') || title.includes('paid') || title.includes('invoice')) {
      return { icon: <DollarSign className={cn(iconClass, "text-emerald-600 dark:text-emerald-400")} />, bg: "bg-emerald-100 dark:bg-emerald-900/40" };
    }

    // Cancellation
    if (title.includes('cancel')) {
      return { icon: <XCircle className={cn(iconClass, "text-red-600 dark:text-red-400")} />, bg: "bg-red-100 dark:bg-red-900/40" };
    }

    // Declined
    if (title.includes('decline')) {
      return { icon: <XCircle className={cn(iconClass, "text-red-600 dark:text-red-400")} />, bg: "bg-red-100 dark:bg-red-900/40" };
    }

    // Hold
    if (title.includes('hold')) {
      return { icon: <PauseCircle className={cn(iconClass, "text-amber-600 dark:text-amber-400")} />, bg: "bg-amber-100 dark:bg-amber-900/40" };
    }

    // Request
    if (title.includes('request')) {
      return { icon: <CalendarPlus className={cn(iconClass, "text-amber-600 dark:text-amber-400")} />, bg: "bg-amber-100 dark:bg-amber-900/40" };
    }

    // Created
    if (title.includes('created')) {
      return { icon: <CalendarPlus className={cn(iconClass, "text-green-600 dark:text-green-400")} />, bg: "bg-green-100 dark:bg-green-900/40" };
    }

    // Approved
    if (title.includes('approved')) {
      return { icon: <CalendarCheck className={cn(iconClass, "text-green-600 dark:text-green-400")} />, bg: "bg-green-100 dark:bg-green-900/40" };
    }

    // Scheduled / Rescheduled
    if (title.includes('scheduled') || title.includes('rescheduled')) {
      return { icon: <CalendarCheck className={cn(iconClass, "text-blue-600 dark:text-blue-400")} />, bg: "bg-blue-100 dark:bg-blue-900/40" };
    }

    // Started
    if (title.includes('started')) {
      return { icon: <Play className={cn(iconClass, "text-sky-600 dark:text-sky-400")} />, bg: "bg-sky-100 dark:bg-sky-900/40" };
    }

    // Completed / Delivered
    if (title.includes('completed') || title.includes('complete') || title.includes('delivered')) {
      return { icon: <CheckCircle2 className={cn(iconClass, "text-emerald-600 dark:text-emerald-400")} />, bg: "bg-emerald-100 dark:bg-emerald-900/40" };
    }

    // Editing
    if (title.includes('editing')) {
      return { icon: <Pencil className={cn(iconClass, "text-violet-600 dark:text-violet-400")} />, bg: "bg-violet-100 dark:bg-violet-900/40" };
    }

    // Review
    if (title.includes('review')) {
      return { icon: <Eye className={cn(iconClass, "text-indigo-600 dark:text-indigo-400")} />, bg: "bg-indigo-100 dark:bg-indigo-900/40" };
    }

    // Upload / Media
    if (title.includes('upload') || title.includes('media')) {
      return { icon: <Upload className={cn(iconClass, "text-cyan-600 dark:text-cyan-400")} />, bg: "bg-cyan-100 dark:bg-cyan-900/40" };
    }

    // Assigned
    if (title.includes('assigned')) {
      return { icon: <CalendarCheck className={cn(iconClass, "text-blue-600 dark:text-blue-400")} />, bg: "bg-blue-100 dark:bg-blue-900/40" };
    }

    // Update
    if (title.includes('update')) {
      return { icon: <RefreshCw className={cn(iconClass, "text-blue-600 dark:text-blue-400")} />, bg: "bg-blue-100 dark:bg-blue-900/40" };
    }

    // Error / Alert
    if (title.includes('issue') || title.includes('error') || title.includes('alert')) {
      return { icon: <AlertCircle className={cn(iconClass, "text-red-600 dark:text-red-400")} />, bg: "bg-red-100 dark:bg-red-900/40" };
    }

    // Fallback based on type
    switch (type) {
      case 'shoots':
        return { icon: <CameraIcon className={cn(iconClass, "text-blue-600 dark:text-blue-400")} />, bg: "bg-blue-100 dark:bg-blue-900/40" };
      case 'system':
        return { icon: <ClockIcon className={cn(iconClass, "text-orange-600 dark:text-orange-400")} />, bg: "bg-orange-100 dark:bg-orange-900/40" };
      default:
        return { icon: <BellIcon className={cn(iconClass, "text-primary")} />, bg: "bg-primary/10" };
    }
  };

  const renderNotification = (notification: NotificationItem, isRecentNotification: boolean) => {
    const isUnread = !notification.isRead;
    
    // Clean styling: New (prominent blue) > Unread (blue left bar) > Read (muted)
    const getContainerStyles = () => {
      if (isRecentNotification) {
        // New notifications (last 30 min) - very prominent blue styling
        return cn(
          'border-2 border-blue-500',
          'bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/50 dark:to-blue-950/30',
          'hover:from-blue-150 hover:to-blue-100 dark:hover:from-blue-900/60 dark:hover:to-blue-950/40',
          'shadow-md shadow-blue-200 dark:shadow-blue-900/30'
        );
      }
      if (isUnread) {
        // Unread but older - white background with blue left bar
        return cn(
          'border border-slate-200 dark:border-border',
          'bg-white dark:bg-card',
          'hover:bg-slate-50 dark:hover:bg-muted/30'
        );
      }
      // Read - greyed out appearance
      return cn(
        'border border-gray-200 dark:border-border/40',
        'bg-gray-100 dark:bg-muted/30',
        'opacity-50 hover:opacity-70'
      );
    };
    
    // Indicator bar for unread (not new) notifications - color based on action type
    const showUnreadBar = isUnread && !isRecentNotification;
    
    // Get indicator bar color based on notification type
    const getIndicatorColor = () => {
      const title = notification.title.toLowerCase();
      const action = (notification.action || '').toLowerCase();
      
      // Cancellation - red
      if (title.includes('cancel') || action.includes('cancel')) {
        return 'bg-red-500';
      }
      // Declined - red
      if (title.includes('decline') || action.includes('decline')) {
        return 'bg-red-500';
      }
      // New request - green
      if (title.includes('request') || action.includes('request') || title.includes('new shoot')) {
        return 'bg-green-500';
      }
      // Approved - green
      if (title.includes('approved') || action.includes('approved')) {
        return 'bg-green-500';
      }
      // Completed/Delivered - green
      if (title.includes('completed') || title.includes('delivered') || action.includes('completed')) {
        return 'bg-green-500';
      }
      // Payment - green
      if (title.includes('payment') || title.includes('paid') || action.includes('payment')) {
        return 'bg-green-500';
      }
      // On hold - amber/orange
      if (title.includes('hold') || action.includes('hold')) {
        return 'bg-amber-500';
      }
      // Default - blue
      return 'bg-blue-500';
    };

    return (
      <motion.div
        key={notification.id}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'px-3 py-2 rounded-lg cursor-pointer transition-all relative overflow-hidden',
          getContainerStyles()
        )}
        onClick={() => handleNotificationClick(notification)}
      >
        {/* Color-coded indicator bar for unread notifications */}
        {showUnreadBar && (
          <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", getIndicatorColor())} />
        )}
        
        <div className="flex items-center gap-2.5">
          {(() => {
            const { icon, bg } = getNotificationIcon(notification, isRecentNotification);
            return (
              <div className={cn("flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full", bg)}>
                {icon}
              </div>
            );
          })()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <h4 className={cn(
                  "text-xs truncate",
                  isUnread ? "font-semibold text-foreground" : "font-normal text-muted-foreground"
                )}>
                  {notification.title}
                </h4>
                {isRecentNotification && (
                  <Badge 
                    className="bg-blue-500 text-white border-0 text-[9px] px-1 py-0 font-medium leading-tight"
                  >
                    New
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-[10px] whitespace-nowrap flex-shrink-0",
                isUnread ? "text-muted-foreground font-medium" : "text-muted-foreground/70"
              )}>
                {formatNotificationDate(notification.date)}
              </span>
            </div>
            <p className={cn(
              "text-[11px] line-clamp-1",
              isUnread ? "text-muted-foreground" : "text-muted-foreground/60"
            )}>
              {notification.message}
            </p>
          </div>
          {isUnread && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 flex-shrink-0 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(notification.id);
              }}
              title="Mark as read"
            >
              <CheckIcon className="h-3 w-3" />
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          onClick={() => setIsOpen(true)}
        >
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent
        side={isMobile ? "top" : "right"}
        className={cn(
          "p-0 flex flex-col",
          isMobile
            ? "w-full max-h-[95vh] rounded-b-2xl [&>button]:hidden"
            : "w-[380px] sm:w-[540px]"
        )}
      >
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex justify-between items-center">
            <SheetTitle>Notifications</SheetTitle>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="text-xs"
              >
                <CheckIcon className="h-3.5 w-3.5 mr-1.5" />
                Mark all as read
              </Button>
            )}
          </div>
        </SheetHeader>
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {[
                { value: 'unread', label: 'Unread', count: unreadCount },
                { value: 'shoots', label: 'Shoots', count: null },
                { value: 'messages', label: 'Messages', count: null },
                { value: 'system', label: 'System', count: null },
                { value: 'all', label: 'All', count: notifications.length },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value as NotificationType)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors',
                    activeTab === tab.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && (
                    <span className="ml-1.5 text-[10px]">({tab.count})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <ScrollArea className={cn(isMobile ? "h-[calc(95vh-210px)]" : "h-[calc(100vh-180px)]", "p-4")} style={{ background: 'transparent' }}>
              {loading ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading notifications…</span>
                </div>
              ) : filteredNotifications.length > 0 ? (
                <div className="space-y-2">
                  {/* Recent notifications section */}
                  {recentNotifications.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                          New
                        </span>
                        <div className="flex-1 h-px bg-blue-200 dark:bg-blue-800" />
                      </div>
                      <AnimatePresence initial={false}>
                        {recentNotifications.map((notification) => 
                          renderNotification(notification, true)
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  
                  {/* Older notifications section */}
                  {olderNotifications.length > 0 && (
                    <div className="space-y-1.5">
                      {recentNotifications.length > 0 && (
                        <div className="flex items-center gap-2 px-1 pt-2">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                            Earlier
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      <AnimatePresence initial={false}>
                        {olderNotifications.map((notification) => 
                          renderNotification(notification, false)
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-60 text-center">
                  <BellIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium mb-1">No notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    {error || "You're all caught up! Any new notifications will appear here."}
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Close button at bottom - mobile only */}
        {isMobile && (
          <div className="px-4 py-3 border-t">
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </div>
        )}
      </SheetContent>

      {/* Cancellation Approval Dialog */}
      <Dialog open={cancellationDialogOpen} onOpenChange={setCancellationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Cancellation Request
            </DialogTitle>
            <DialogDescription>
              A client has requested to cancel shoot #{cancellationShootId}. Would you like to approve or reject this cancellation?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setCancellationDialogOpen(false);
                setCancellationShootId(null);
              }}
              disabled={cancellationProcessing}
            >
              Close
            </Button>
            <Button
              variant="outline"
              onClick={handleRejectCancellation}
              disabled={cancellationProcessing}
            >
              {cancellationProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reject
            </Button>
            <Button
              variant="destructive"
              onClick={handleApproveCancellation}
              disabled={cancellationProcessing}
            >
              {cancellationProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Approve Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold Approval Dialog */}
      <Dialog open={holdDialogOpen} onOpenChange={setHoldDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <PauseCircle className="h-5 w-5" />
              Hold Request
            </DialogTitle>
            <DialogDescription>
              A client has requested to put shoot #{holdShootId} on hold. Would you like to approve or reject this request?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setHoldDialogOpen(false);
                setHoldShootId(null);
              }}
              disabled={holdProcessing}
            >
              Close
            </Button>
            <Button variant="outline" onClick={handleRejectHold} disabled={holdProcessing}>
              {holdProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleApproveHold}
              disabled={holdProcessing}
            >
              {holdProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Approve Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
