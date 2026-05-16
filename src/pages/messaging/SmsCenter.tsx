import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SmsThreadList } from '@/components/messaging/sms/SmsThreadList';
import { SmsConversation } from '@/components/messaging/sms/SmsConversation';
import { SmsContactPanel } from '@/components/messaging/sms/SmsContactPanel';
import {
  getSmsThreads,
  getSmsThread,
  markSmsThreadRead,
  resumeSmsThreadAi,
  sendSmsMessageToThread,
  updateSmsContact,
  updateSmsContactComment,
  getTemplates,
} from '@/services/messaging';
import type { PaginatedResponseMeta, SmsContact, SmsThreadDetail, SmsThreadFilter, SmsThreadSummary } from '@/types/messaging';
import { useSmsRealtime } from '@/hooks/use-sms-realtime';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { toast } from '@/lib/sonner-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'react-router-dom';

export default function SmsCenter() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<SmsThreadFilter>('unanswered');
  const [search, setSearch] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [composerText, setComposerText] = useState('');
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [contactPanelOpen, setContactPanelOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const requestedThreadId = searchParams.get('thread');
  const searchParamsKey = searchParams.toString();

  const threadsKey = ['sms-threads', { filter, search }];

  const threadsQuery = useQuery({
    queryKey: threadsKey,
    queryFn: () =>
      getSmsThreads({
        filter: filter === 'all' ? undefined : filter,
        search: search || undefined,
        per_page: 50,
      }),
  });

  const threads = useMemo(() => threadsQuery.data?.data ?? [], [threadsQuery.data?.data]);

  useEffect(() => {
    if (requestedThreadId && requestedThreadId !== activeThreadId) {
      setActiveThreadId(requestedThreadId);
      return;
    }

    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0].id);
    }
  }, [threads, activeThreadId, requestedThreadId]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParamsKey);
    const currentThread = nextParams.get('thread');

    if (activeThreadId) {
      if (currentThread === activeThreadId) return;
      nextParams.set('thread', activeThreadId);
      setSearchParams(nextParams, { replace: true });
      return;
    }

    if (!currentThread) return;
    nextParams.delete('thread');
    setSearchParams(nextParams, { replace: true });
  }, [activeThreadId, searchParamsKey, setSearchParams]);

  const threadDetailQuery = useQuery({
    queryKey: ['sms-thread', activeThreadId],
    queryFn: () => (activeThreadId ? getSmsThread(activeThreadId) : null),
    enabled: !!activeThreadId,
  });

  const threadDetail = threadDetailQuery.data;

  const templatesQuery = useQuery({
    queryKey: ['sms-templates'],
    queryFn: () => getTemplates({ channel: 'SMS' }),
    staleTime: 1000 * 60 * 5,
  });

  const smsTemplates =
    templatesQuery.data?.map((template) => ({
      id: template.id,
      name: template.name,
      body_text: template.body_text,
    })) ?? [];

  const markReadMutation = useMutation({
    mutationFn: (threadId: string) => markSmsThreadRead(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: threadsKey });
    },
  });
  const { mutate: markThreadRead } = markReadMutation;

  useEffect(() => {
    if (activeThreadId) {
      markThreadRead(activeThreadId);
      setContactPanelOpen(false);
      setContactDrawerOpen(false);
    }
  }, [activeThreadId, markThreadRead]);

  const sendMutation = useMutation({
    mutationFn: (body: string) => sendSmsMessageToThread(activeThreadId!, { body }),
    onSuccess: () => {
      setComposerText('');
      queryClient.invalidateQueries({ queryKey: ['sms-thread', activeThreadId] });
      queryClient.invalidateQueries({ queryKey: threadsKey });
      toast.success('Message sent');
    },
    onError: () => toast.error('Unable to send message'),
  });

  const resumeAiMutation = useMutation({
    mutationFn: (threadId: string) => resumeSmsThreadAi(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-thread', activeThreadId] });
      queryClient.invalidateQueries({ queryKey: threadsKey });
      toast.success('AI replies resumed');
    },
    onError: () => toast.error('Unable to resume AI replies'),
  });

  const updateContactMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateSmsContact>[1]) => {
      if (!threadDetail?.contact) return Promise.reject();
      return updateSmsContact(threadDetail.contact.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-thread', activeThreadId] });
      queryClient.invalidateQueries({ queryKey: threadsKey });
      toast.success('Contact updated');
    },
    onError: () => toast.error('Unable to update contact'),
  });

  const updateCommentMutation = useMutation({
    mutationFn: (comment: string) => {
      if (!threadDetail?.contact) return Promise.reject();
      return updateSmsContactComment(threadDetail.contact.id, comment);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-thread', activeThreadId] });
    },
  });

  const toggleContactAiMutation = useMutation({
    mutationFn: (enabled: boolean) => {
      if (!threadDetail?.contact) return Promise.reject();
      return updateSmsContact(threadDetail.contact.id, { sms_ai_enabled: enabled });
    },
    onSuccess: (contact) => {
      queryClient.setQueryData(['sms-thread', activeThreadId], (prev: SmsThreadDetail | null | undefined) => {
        if (!prev) return prev;
        return {
          ...prev,
          contact,
          thread: {
            ...prev.thread,
            contactAiEnabled: contact.smsAiEnabled ?? null,
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: threadsKey });
      toast.success(contact.smsAiEnabled ? 'AI replies enabled' : 'AI replies disabled');
    },
    onError: () => toast.error('Unable to update AI reply setting'),
  });

  useSmsRealtime({
    threadId: activeThreadId,
    onMessage: (message) => {
      if (!activeThreadId) return;
      queryClient.setQueryData(['sms-thread', activeThreadId], (prev: SmsThreadDetail | null | undefined) => {
        if (!prev) return prev;
        return { ...prev, messages: [...prev.messages, message] };
      });
    },
    onThreadUpdated: (updated) => {
      queryClient.setQueryData(threadsKey, (prev: { data: SmsThreadSummary[]; meta: PaginatedResponseMeta } | undefined) => {
        if (!prev) return prev;
        const existingIndex = prev.data.findIndex((thread) => thread.id === updated.id);
        if (existingIndex === -1) {
          return { ...prev, data: [updated, ...prev.data] };
        }
        const clone = [...prev.data];
        clone[existingIndex] = { ...clone[existingIndex], ...updated };
        return { ...prev, data: clone };
      });
    },
  });

  const handleSend = () => {
    if (!composerText.trim() || !activeThreadId) return;
    sendMutation.mutate(composerText.trim());
  };

  const handleContactUpdate = async (payload: Parameters<typeof updateSmsContact>[1]) => {
    if (!threadDetail?.contact) {
      toast.error('No contact selected');
      return;
    }
    await updateContactMutation.mutateAsync(payload);
  };

  const handleCommentUpdate = async (comment: string) => {
    await updateCommentMutation.mutateAsync(comment);
  };

  const conversationVisible = !!activeThreadId || !isMobile;
  const listVisible = !isMobile || !activeThreadId;

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-5rem)] gap-0 overflow-hidden rounded-3xl border border-border/60 bg-muted/20 shadow-sm">
        {listVisible && (
          <div className="w-full max-w-md">
            <SmsThreadList
              threads={threads}
              activeThreadId={activeThreadId ?? undefined}
              filter={filter}
              onFilterChange={setFilter}
              search={search}
              onSearchChange={setSearch}
              onSelectThread={(id) => {
                setActiveThreadId(id);
                if (isMobile) {
                  setContactDrawerOpen(false);
                }
              }}
              onRefresh={() => threadsQuery.refetch()}
              isRefreshing={threadsQuery.isFetching}
            />
          </div>
        )}

        {conversationVisible ? (
          <div className="flex flex-1 flex-col">
            {threadDetailQuery.isLoading && (
              <div className="space-y-4 p-6">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-[60vh] rounded-3xl" />
              </div>
            )}
            {threadDetail && (
              <SmsConversation
                thread={threadDetail.thread}
                contact={threadDetail.contact}
                messages={threadDetail.messages}
                composerValue={composerText}
                onComposerChange={setComposerText}
                onSend={handleSend}
                sending={sendMutation.isPending}
                isMobile={!!isMobile}
                onBack={() => setActiveThreadId(null)}
                onOpenContact={() => {
                  if (isMobile) {
                    setContactDrawerOpen(true);
                  } else {
                    setContactPanelOpen(true);
                  }
                }}
                templates={smsTemplates}
                onSelectTemplate={(text) => setComposerText((prev) => (prev ? `${prev}\n${text}` : text))}
                onResumeAi={() => {
                  if (activeThreadId) {
                    resumeAiMutation.mutate(activeThreadId);
                  }
                }}
                resumingAi={resumeAiMutation.isPending}
                onToggleContactAi={(enabled) => toggleContactAiMutation.mutate(enabled)}
                togglingContactAi={toggleContactAiMutation.isPending}
              />
            )}
          </div>
        ) : (
          !listVisible && <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select a thread</div>
        )}

        {!isMobile && contactPanelOpen && (
          <div className="hidden w-[320px] border-l border-border/70 xl:block">
            <SmsContactPanel
              contact={threadDetail?.contact}
              onUpdateContact={handleContactUpdate}
              onUpdateComment={handleCommentUpdate}
              onClose={() => setContactPanelOpen(false)}
            />
          </div>
        )}
      </div>

      {isMobile && (
        <Drawer open={contactDrawerOpen} onOpenChange={setContactDrawerOpen}>
          <DrawerContent className="h-[80vh]">
            <SmsContactPanel
              contact={threadDetail?.contact}
              onUpdateContact={handleContactUpdate}
              onUpdateComment={handleCommentUpdate}
              onClose={() => setContactDrawerOpen(false)}
            />
          </DrawerContent>
        </Drawer>
      )}
    </DashboardLayout>
  );
}
