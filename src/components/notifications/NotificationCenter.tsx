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

  // Get icon based on notification title/type for more specific icons
  const getNotificationIcon = (notification: NotificationItem, isRecentNotification: boolean) => {
    const iconClass = "h-5 w-5";
    const title = notification.title.toLowerCase();
    const type = notification.type;
    
    // Determine color based on notification state
    const getColor = (baseColor: string, recentColor: string) => 
      isRecentNotification ? recentColor : baseColor;

    // Messages
    if (type === 'messages' || title.includes('sms') || title.includes('message')) {
      return <MessageSquare className={cn(iconClass, getColor("text-purple-500", "text-purple-400"))} />;
    }

    // Shoot-specific icons based on title
    if (title.includes('request')) {
      return <CalendarPlus className={cn(iconClass, getColor("text-amber-500", "text-amber-400"))} />;
    }
    if (title.includes('created')) {
      return <CalendarPlus className={cn(iconClass, getColor("text-green-500", "text-green-400"))} />;
    }
    if (title.includes('approved')) {
      return <CalendarCheck className={cn(iconClass, getColor("text-green-500", "text-green-400"))} />;
    }
    if (title.includes('scheduled')) {
      return <CalendarCheck className={cn(iconClass, getColor("text-blue-500", "text-blue-400"))} />;
    }
    if (title.includes('started')) {
      return <Play className={cn(iconClass, getColor("text-sky-500", "text-sky-400"))} />;
    }
    if (title.includes('completed') || title.includes('complete')) {
      return <CheckCircle2 className={cn(iconClass, getColor("text-emerald-500", "text-emerald-400"))} />;
    }
    if (title.includes('cancelled') || title.includes('canceled')) {
      return <XCircle className={cn(iconClass, getColor("text-red-500", "text-red-400"))} />;
    }
    if (title.includes('hold')) {
      return <PauseCircle className={cn(iconClass, getColor("text-amber-500", "text-amber-400"))} />;
    }
    if (title.includes('editing')) {
      return <Pencil className={cn(iconClass, getColor("text-violet-500", "text-violet-400"))} />;
    }
    if (title.includes('review')) {
      return <Eye className={cn(iconClass, getColor("text-indigo-500", "text-indigo-400"))} />;
    }
    if (title.includes('payment') || title.includes('paid')) {
      return <DollarSign className={cn(iconClass, getColor("text-green-500", "text-green-400"))} />;
    }
    if (title.includes('upload') || title.includes('media')) {
      return <Upload className={cn(iconClass, getColor("text-cyan-500", "text-cyan-400"))} />;
    }
    if (title.includes('update')) {
      return <RefreshCw className={cn(iconClass, getColor("text-blue-500", "text-blue-400"))} />;
    }
    if (title.includes('issue') || title.includes('error') || title.includes('alert')) {
      return <AlertCircle className={cn(iconClass, getColor("text-red-500", "text-red-400"))} />;
    }
    if (title.includes('sent') || title.includes('delivered')) {
      return <Send className={cn(iconClass, getColor("text-teal-500", "text-teal-400"))} />;
    }

    // Fallback based on type
    switch (type) {
      case 'shoots':
        return <CameraIcon className={cn(iconClass, getColor("text-blue-500", "text-blue-400"))} />;
      case 'system':
        return <ClockIcon className={cn(iconClass, getColor("text-orange-500", "text-orange-400"))} />;
      default:
        return <BellIcon className={cn(iconClass, getColor("text-primary", "text-primary/80"))} />;
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
          'p-4 rounded-xl cursor-pointer transition-all relative overflow-hidden',
          getContainerStyles()
        )}
        onClick={() => handleNotificationClick(notification)}
      >
        {/* Color-coded indicator bar for unread notifications */}
        {showUnreadBar && (
          <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", getIndicatorColor())} />
        )}
        
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {getNotificationIcon(notification, isRecentNotification)}
          </div>
          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className={cn(
                  "text-sm",
                  isUnread ? "font-semibold text-foreground" : "font-normal text-muted-foreground"
                )}>
                  {notification.title}
                </h4>
                {isRecentNotification && (
                  <Badge 
                    className="bg-blue-500 text-white border-0 text-[10px] px-1.5 py-0 font-medium"
                  >
                    New
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-xs whitespace-nowrap flex-shrink-0",
                isUnread ? "text-muted-foreground font-medium" : "text-muted-foreground/70"
              )}>
                {formatNotificationDate(notification.date)}
              </span>
            </div>
            <p className={cn(
              "text-sm line-clamp-2",
              isUnread ? "text-muted-foreground" : "text-muted-foreground/60"
            )}>
              {notification.message}
            </p>
            {notification.actionUrl && (
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-xs font-medium text-blue-600 dark:text-blue-400"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNotificationClick(notification);
                }}
              >
                {notification.actionLabel || 'View'}
              </Button>
            )}
          </div>
          {isUnread && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 flex-shrink-0 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(notification.id);
              }}
              title="Mark as read"
            >
              <CheckIcon className="h-4 w-4" />
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
      
      <SheetContent className="w-[380px] sm:w-[540px] p-0 flex flex-col">
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
            <ScrollArea className="h-[calc(100vh-180px)] p-4" style={{ background: 'transparent' }}>
              {loading ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading notifications…</span>
                </div>
              ) : filteredNotifications.length > 0 ? (
                <div className="space-y-4">
                  {/* Recent notifications section */}
                  {recentNotifications.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
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
                    <div className="space-y-3">
                      {recentNotifications.length > 0 && (
                        <div className="flex items-center gap-2 px-1 pt-3">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
