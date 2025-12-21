
import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BellIcon, CheckIcon, CalendarIcon, CameraIcon, ClockIcon, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from '@/components/auth/AuthProvider';
import { format, isToday, isYesterday } from 'date-fns';

// Notification types
type NotificationType = 'all' | 'unread' | 'shoots' | 'messages' | 'system';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'shoots' | 'messages' | 'system';
  isRead: boolean;
  date: string;
  actionUrl?: string;
  actionLabel?: string;
}

export function NotificationCenter() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationType>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Mock data - in a real app, this would come from an API
  useEffect(() => {
    // Generate mock notifications based on user role
    const mockNotifications: Notification[] = [
      {
        id: '1',
        title: 'New Shoot Request',
        message: 'A new shoot has been scheduled for 123 Main St.',
        type: 'shoots',
        isRead: false,
        date: new Date().toISOString(),
        actionUrl: '/shoots',
        actionLabel: 'View Details',
      },
      {
        id: '2',
        title: 'Message from Client',
        message: 'Jane Doe has sent you a message regarding the upcoming shoot.',
        type: 'messages',
        isRead: true,
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        actionUrl: 'mailto:support@reprohq.com?subject=Client%20message',
        actionLabel: 'Email Support',
      },
      {
        id: '3',
        title: 'System Maintenance',
        message: 'The system will be down for maintenance on Saturday from 2-4 AM.',
        type: 'system',
        isRead: false,
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '4',
        title: 'Payment Received',
        message: 'Payment for invoice #12345 has been received.',
        type: 'system',
        isRead: false,
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        actionUrl: '/invoices',
        actionLabel: 'View Invoice',
      },
      {
        id: '5',
        title: 'Shoot Completed',
        message: 'The shoot at 456 Park Ave has been marked as completed.',
        type: 'shoots',
        isRead: false,
        date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        actionUrl: '/shoots',
        actionLabel: 'View Shoot',
      },
    ];

    setNotifications(mockNotifications);
    setUnreadCount(mockNotifications.filter(n => !n.isRead).length);
  }, [user]);

  // Filter notifications based on active tab
  const filteredNotifications = notifications.filter(notification => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !notification.isRead;
    return notification.type === activeTab;
  });

  // Mark a notification as read
  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, isRead: true } 
          : notification
      )
    );
    
    // Update unread count
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, isRead: true }))
    );
    setUnreadCount(0);
  };

  // Format notification date
  const formatNotificationDate = (dateString: string) => {
    const date = new Date(dateString);
    
    if (isToday(date)) {
      return `Today, ${format(date, 'h:mm a')}`;
    } else if (isYesterday(date)) {
      return `Yesterday, ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, yyyy h:mm a');
    }
  };

  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'shoots':
        return <CameraIcon className="h-5 w-5 text-blue-500" />;
      case 'messages':
        return <MessageSquare className="h-5 w-5 text-purple-500" />;
      case 'system':
        return <ClockIcon className="h-5 w-5 text-orange-500" />;
      default:
        return <BellIcon className="h-5 w-5 text-primary" />;
    }
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
              {unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-[380px] sm:w-[540px] p-0">
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
        
        <Tabs 
          defaultValue="all" 
          value={activeTab} 
          onValueChange={(value) => setActiveTab(value as NotificationType)}
          className="w-full"
        >
          <div className="px-6 pt-4">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="all" className="text-xs">
                All
                {notifications.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5">
                    {notifications.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs">
                Unread
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="shoots" className="text-xs">Shoots</TabsTrigger>
              <TabsTrigger value="messages" className="text-xs">Messages</TabsTrigger>
              <TabsTrigger value="system" className="text-xs">System</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value={activeTab} className="mt-0">
            <ScrollArea className="h-[calc(100vh-180px)] p-6">
              {filteredNotifications.length > 0 ? (
                <div className="space-y-4">
                  <AnimatePresence initial={false}>
                    {filteredNotifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`p-4 rounded-lg border ${
                          notification.isRead ? 'bg-card' : 'bg-accent/20'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="mt-0.5">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-start">
                              <h4 className="font-medium text-sm">{notification.title}</h4>
                              <span className="text-xs text-muted-foreground">
                                {formatNotificationDate(notification.date)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {notification.message}
                            </p>
                            {notification.actionUrl && (
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="h-auto p-0 text-xs text-primary"
                                onClick={() => {
                                  markAsRead(notification.id);
                                  setIsOpen(false);
                                }}
                              >
                                {notification.actionLabel || 'View Details'}
                              </Button>
                            )}
                          </div>
                          {!notification.isRead && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <CheckIcon className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-60 text-center">
                  <BellIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium mb-1">No notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    You're all caught up! Any new notifications will appear here.
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
