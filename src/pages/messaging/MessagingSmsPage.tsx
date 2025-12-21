import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/auth/AuthProvider';
import { getAuthToken } from '@/utils/authToken';
import { fetchSmsThread, fetchSmsThreads, sendSmsMessage } from '@/services/messagingService';
import { API_BASE_URL } from '@/config/env';
import { Loader2, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type SmsThread = {
  id: number | string;
  contact?: { 
    id?: number | string;
    name?: string; 
    phone?: string;
    primaryNumber?: string; // MightyCall uses primaryNumber
    numbers?: Array<{ number: string; label?: string; is_primary?: boolean }>;
  };
  lastMessageAt?: string;
  lastMessageSnippet?: string;
  last_message_at?: string;
  last_snippet?: string;
  lastDirection?: string;
  unread?: boolean;
  assignedTo?: {
    id: number | string;
    name: string;
  };
};

const MessagingSmsPage = () => {
  console.log('🔵 MessagingSmsPage component rendering');
  
  const { session } = useAuth();
  const token = getAuthToken(session?.accessToken);
  const { toast } = useToast();

  const [threads, setThreads] = useState<SmsThread[]>([]);
  const [activeThread, setActiveThread] = useState<SmsThread | null>(null); // Explicitly null by default
  const [threadMessages, setThreadMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [composer, setComposer] = useState({ to: '', body_text: '' });
  const [sending, setSending] = useState(false);

  // Debug: Log component mount and state
  useEffect(() => {
    console.log('🟢 MessagingSmsPage mounted/updated');
    console.log('MessagingSmsPage State:', {
      activeThread,
      threadsCount: threads.length,
      loading,
      token: token ? 'present' : 'missing',
    });
  }, [activeThread, threads.length, loading, token]);

  // Function to clear active thread and show compose
  const showCompose = useCallback(() => {
    setActiveThread(null);
    setThreadMessages([]);
    setComposer({ to: '', body_text: '' });
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchSmsThreads<any>(token);
      
      // Handle Laravel paginated response: { data: [...], links: {...}, meta: {...} }
      // The response from handleResponse is already the JSON, so check for data property
      let threadsData: SmsThread[] = [];
      
      console.log('SMS Threads API Response:', response); // Debug log
      
      if (Array.isArray(response)) {
        threadsData = response;
      } else if (response && Array.isArray(response.data)) {
        // Laravel paginated response
        threadsData = response.data;
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
        threadsData = response.data.data;
      } else {
        console.warn('Unexpected response format:', response);
      }
      
      console.log('Extracted threads:', threadsData); // Debug log
      setThreads(threadsData);
    } catch (err) {
      console.error('Error loading SMS threads:', err);
      toast({
        title: 'Failed to load SMS threads',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  const loadThreadMessages = useCallback(
    async (threadId: number) => {
      try {
        const response = await fetchSmsThread<{ thread: SmsThread; messages: any[] }>(threadId, token);
        setActiveThread(response.thread);
        setThreadMessages(response.messages ?? []);
        // Get phone from primaryNumber or phone field
        setComposer((prev) => {
          const contactPhone = response.thread?.contact?.primaryNumber 
            ?? response.thread?.contact?.phone 
            ?? response.thread?.contact?.numbers?.[0]?.number
            ?? prev.to;
          return {
            ...prev,
            to: contactPhone,
          };
        });
      } catch (err) {
        toast({
          title: 'Unable to open conversation',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    },
    [token, toast],
  );

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!composer.body_text) return;
    // For new messages, require 'to' field
    if (!activeThread && !composer.to) return;

    try {
      setSending(true);
      
      if (activeThread) {
        // Reply to existing thread
        const response = await fetch(`${API_BASE_URL}/api/messaging/sms/threads/${activeThread.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ body: composer.body_text }),
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error?.message || 'Failed to send message');
        }
      } else {
        // Send new message
        await sendSmsMessage(composer, token);
      }
      
      toast({ title: 'SMS sent successfully' });
      setComposer((prev) => ({ ...prev, body_text: '' }));
      
      // Reload threads to show the new message
      await loadThreads();
      
      // If we sent a new message, try to find and load the new thread
      if (!activeThread && composer.to) {
        const sentTo = composer.to;
        // Small delay to allow backend to process
        setTimeout(async () => {
          await loadThreads();
          // Try to find the thread we just created
          try {
            const updatedResponse = await fetchSmsThreads<any>(token);
            let threadsData: SmsThread[] = [];
            
            if (Array.isArray(updatedResponse)) {
              threadsData = updatedResponse;
            } else if (Array.isArray(updatedResponse.data)) {
              threadsData = updatedResponse.data;
            } else if (updatedResponse?.data?.data && Array.isArray(updatedResponse.data.data)) {
              threadsData = updatedResponse.data.data;
            }
            
            const newThread = threadsData.find(
              (t) => {
                const threadPhone = (t.contact?.primaryNumber 
                  ?? t.contact?.phone 
                  ?? t.contact?.numbers?.[0]?.number 
                  || '').replace(/\D/g, '');
                const sentPhone = sentTo.replace(/\D/g, '');
                return threadPhone === sentPhone || 
                       threadPhone.endsWith(sentPhone) || 
                       sentPhone.endsWith(threadPhone);
              }
            );
            if (newThread) {
              await loadThreadMessages(newThread.id);
            }
          } catch (err) {
            // Silently fail - thread might not be created yet
            console.log('Could not find new thread:', err);
          }
        }, 1000);
      } else if (activeThread) {
        // Reload current thread messages
        await loadThreadMessages(activeThread.id);
      }
    } catch (err) {
      toast({
        title: 'Failed to send SMS',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const seenThreads = useMemo(
    () =>
      threads.map((thread) => ({
        ...thread,
        isActive: activeThread?.id === thread.id,
      })),
    [threads, activeThread],
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="SMS inbox"
        description="Keep up with MightyCall conversations from one workspace."
        actions={
          <Button variant="outline" size="sm" onClick={loadThreads} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Threads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {seenThreads.map((thread) => (
              <button
                key={thread.id}
                className={`w-full rounded border p-3 text-left transition ${
                  thread.isActive ? 'border-primary bg-primary/5' : 'hover:border-primary/40'
                }`}
                onClick={() => loadThreadMessages(thread.id)}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{thread.contact?.name || 'Unknown contact'}</span>
                  <span className="text-xs text-muted-foreground">
                    {(thread.lastMessageAt || thread.last_message_at) 
                      ? new Date(thread.lastMessageAt || thread.last_message_at || '').toLocaleDateString() 
                      : ''}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {thread.lastMessageSnippet || thread.last_snippet || 'No messages yet'}
                </p>
                {thread.unread && (
                  <span className="inline-block mt-1 h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
            {!seenThreads.length && !loading && (
              <p className="text-sm text-muted-foreground">No SMS threads yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 min-h-[500px] bg-card" data-testid="sms-compose-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{activeThread ? 'Conversation' : 'Compose Message'}</CardTitle>
              {activeThread && (
                <Button variant="ghost" size="sm" onClick={showCompose}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  New Message
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6 min-h-[400px] bg-background" data-testid="sms-compose-content">
            {/* Debug: Show state - ALWAYS visible */}
            <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 text-xs border-2 border-yellow-400 rounded">
              🔍 Debug: activeThread = {String(activeThread)}, threads = {threads.length}, loading = {String(loading)}
            </div>
            
            {/* TEST: Simple visible element */}
            <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900 border-2 border-blue-400 rounded">
              <p className="font-bold text-blue-800 dark:text-blue-200">TEST: If you see this, the Card is rendering!</p>
            </div>
            
            {/* Always show compose when no thread is selected - this is the default */}
            {!activeThread ? (
              <div className="space-y-4" data-testid="compose-section">
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/30 bg-muted/20 p-8 text-center min-h-[200px]">
                  <MessageSquare className="h-12 w-12 text-primary" />
                  <div>
                    <p className="text-lg font-medium">Compose New Message</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Send an SMS to start a new conversation
                    </p>
                  </div>
                </div>
                <form className="space-y-4" onSubmit={handleSend}>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">To</label>
                    <Input
                      placeholder="+1 555 010 9999"
                      value={composer.to}
                      onChange={(event) => setComposer((prev) => ({ ...prev, to: event.target.value }))}
                      className="text-base"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter the recipient's phone number
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Message</label>
                    <Textarea
                      rows={6}
                      placeholder="Type your message here…"
                      value={composer.body_text}
                      onChange={(event) => setComposer((prev) => ({ ...prev, body_text: event.target.value }))}
                      className="text-base"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {composer.body_text.length}/1200 characters
                    </p>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={!composer.to || !composer.body_text || sending}
                    size="lg"
                    className="w-full"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Send SMS
                      </>
                    )}
                  </Button>
                </form>
              </div>
            ) : (
              /* Show conversation if thread is selected */
              <>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-sm font-medium">{activeThread.contact?.name || 'Unknown contact'}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeThread.contact?.primaryNumber 
                      ?? activeThread.contact?.phone 
                      ?? activeThread.contact?.numbers?.[0]?.number 
                      ?? 'No phone number'}
                  </p>
                </div>
                <div className="max-h-[320px] space-y-3 overflow-y-auto rounded border p-3">
                  {threadMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                          message.direction === 'OUTBOUND'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        <p>{message.body_text}</p>
                        <p className="mt-1 text-xs opacity-70">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!threadMessages.length && (
                    <p className="text-sm text-muted-foreground">No messages in this thread yet.</p>
                  )}
                </div>
                <form className="space-y-3" onSubmit={handleSend}>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Message</label>
                    <Textarea
                      rows={3}
                      placeholder="Type your message…"
                      value={composer.body_text}
                      onChange={(event) => setComposer((prev) => ({ ...prev, body_text: event.target.value }))}
                    />
                  </div>
                  <Button type="submit" disabled={!composer.body_text || sending}>
                    {sending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending
                      </>
                    ) : (
                      <>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Send Reply
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MessagingSmsPage;





