import { usePageLoading } from '@/hooks/use-page-loading';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SmsThreadList } from '@/components/messaging/sms/SmsThreadList';
import { SmsConversation } from '@/components/messaging/sms/SmsConversation';
import { SmsContactPanel } from '@/components/messaging/sms/SmsContactPanel';
import { SmsComposeDialog } from '@/components/messaging/sms/SmsComposeDialog';
import {
  getSmsThreads,
  getSmsSenders,
  getSmsThread,
  markSmsThreadRead,
  resumeSmsThreadAi,
  sendSms,
  sendSmsMessageToThread,
  updateSmsContact,
  updateSmsContactComment,
  getTemplates,
} from '@/services/messaging';
import type { SmsInboxScope, SmsContact, SmsThreadDetail, SmsThreadFilter } from '@/types/messaging';
import { useSmsRealtime } from '@/hooks/use-sms-realtime';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { toast } from '@/lib/sonner-toast';
import { getComposeErrorMessage } from '@/pages/messaging/emailComposeModel';
import type { SmsComposePayload } from '@/components/messaging/sms/SmsComposeDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { parseSmsReaction } from '@/components/messaging/sms/smsReaction';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { canViewSystemSms } from '@/utils/messagingRoles';
import { SmsSenderSelect } from '@/components/messaging/sms/SmsSenderSelect';

export default function SmsCenter() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, user } = useAuth();
  const systemSmsAllowed = canViewSystemSms(role);
  const scope: SmsInboxScope = systemSmsAllowed && searchParams.get('scope') === 'system' ? 'system' : 'inbox';
  const [filter, setFilter] = useState<SmsThreadFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [desktopThreadId, setDesktopThreadId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [senderChoices, setSenderChoices] = useState<Record<string, number>>({});
  const [composeOpen, setComposeOpen] = useState(false);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [contactPanelOpen, setContactPanelOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const requestedThreadId = searchParams.get('thread');
  const autoSelectThread = useRef(true);
  const pendingScope = useRef<SmsInboxScope | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const threadsKey = ['sms-threads', { userId: user?.id, role, scope, filter, search: debouncedSearch, page }];

  const threadsQuery = useQuery({
    queryKey: threadsKey,
    queryFn: () =>
      getSmsThreads({
        filter: filter === 'all' ? undefined : filter,
        scope,
        search: debouncedSearch || undefined,
        page,
        per_page: 50,
      }),
  });

  const threads = useMemo(() => threadsQuery.data?.data ?? [], [threadsQuery.data?.data]);

  // On a phone the list is the home screen. The open thread comes only from
  // ?thread=, so Back (and the browser back gesture) can clear it and stay
  // cleared. Auto-selecting the first thread here reopened that conversation
  // the moment Back set the selection to null.
  // Desktop keeps a split view and adopts deep links. URL writes happen only
  // in navigation actions; a second synchronization effect can overwrite a
  // scope change with the previous render's URL.
  const activeThreadId = isMobile ? requestedThreadId : desktopThreadId;
  const draftKey = `${user?.id}:${role}:${activeThreadId}`;
  const composerText = activeThreadId ? drafts[draftKey] ?? '' : '';
  const setComposerText = (value: string | ((previous: string) => string)) => {
    if (!activeThreadId) return;
    setDrafts(previous => ({ ...previous, [draftKey]: typeof value === 'function' ? value(previous[draftKey] ?? '') : value }));
  };

  useEffect(() => {
    if (isMobile) return;
    if (pendingScope.current) {
      if (pendingScope.current === scope) pendingScope.current = null;
      return;
    }

    if (requestedThreadId) {
      setDesktopThreadId(requestedThreadId);
      return;
    }

    if (autoSelectThread.current && !desktopThreadId && threads.length > 0) {
      setDesktopThreadId(threads[0].id);
    }
  }, [isMobile, threads, desktopThreadId, requestedThreadId, scope]);

  const openThread = (id: string) => {
    if (!isMobile) setDesktopThreadId(id);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('thread', id);
    setContactDrawerOpen(false);
    // Push so the browser or system back gesture returns to the list.
    setSearchParams(nextParams, { replace: !isMobile });
  };

  const closeThread = () => {
    const nextParams = new URLSearchParams(searchParams);
    if (!nextParams.has('thread')) return;
    nextParams.delete('thread');
    setSearchParams(nextParams, { replace: true });
  };

  const detailKey = ['sms-thread', activeThreadId, user?.id, role];
  const threadDetailQuery = useQuery({
    queryKey: detailKey,
    queryFn: () => (activeThreadId ? getSmsThread(activeThreadId) : null),
    enabled: !!activeThreadId,
  });

  const threadDetail = threadDetailQuery.data?.thread.id === activeThreadId ? threadDetailQuery.data : undefined;
  const senderNumbersQuery = useQuery({
    queryKey: ['sms-senders', user?.id, role],
    queryFn: () => getSmsSenders(),
    enabled: role === 'superadmin',
    staleTime: 60_000,
  });
  const senderNumbers = senderNumbersQuery.data ?? [];
  const normalizeSender = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 ? `1${digits}` : digits;
  };
  const conversationNumber = threadDetail?.thread.businessNumber;
  const conversationSender = conversationNumber
    ? senderNumbers.find(number => normalizeSender(number.phone_number) === normalizeSender(conversationNumber))
    : senderNumbers.find(number => number.is_default) ?? senderNumbers[0];
  const selectedSenderId = senderChoices[draftKey] ?? conversationSender?.id;
  const validSender = senderNumbers.some(number => number.id === selectedSenderId);
  const senderUnavailable = role === 'superadmin' && (senderNumbersQuery.isLoading || senderNumbersQuery.isError || !validSender);
  // Only show the skeleton on the very first load (no cached/placeholder data).
  const showThreadSkeleton = threadDetailQuery.isLoading && !threadDetail;

  const templatesQuery = useQuery({
    queryKey: ['sms-templates'],
    queryFn: () => getTemplates({ channel: 'SMS' }),
    staleTime: 1000 * 60 * 5,
  });

  usePageLoading(threadsQuery.isLoading || threadDetailQuery.isLoading);

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

  // Mark each thread read at most once per open. Previously this fired on every
  // render because markRead's onSuccess invalidates the thread list, which
  // re-rendered and re-triggered the effect — a runaway loop that flooded the
  // API with thousands of mark-read requests and exhausted browser connections.
  const lastReadRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeThreadId) { lastReadRef.current = null; return; }
    setContactPanelOpen(false);
    setContactDrawerOpen(false);
    const readKey = `${user?.id}:${role}:${activeThreadId}`;
    if (lastReadRef.current === readKey) return;
    lastReadRef.current = readKey;
    markThreadRead(activeThreadId);
  }, [activeThreadId, markThreadRead, user?.id, role]);

  const sendMutation = useMutation({
    mutationFn: ({ body, threadId, senderId }: { body: string; threadId: string; draftKey: string; senderId?: number }) => {
      return sendSmsMessageToThread(threadId, { body, sms_number_id: senderId });
    },
    onSuccess: (result, sent) => {
      setDrafts(previous => previous[sent.draftKey]?.trim() === sent.body ? { ...previous, [sent.draftKey]: '' } : previous);
      queryClient.invalidateQueries({ queryKey: ['sms-thread', sent.threadId] });
      if (result.thread?.id && result.thread.id !== sent.threadId) {
        queryClient.invalidateQueries({ queryKey: ['sms-thread', result.thread.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['sms-threads'] });
      setSenderChoices(previous => { const next = { ...previous }; delete next[sent.draftKey]; return next; });
      if (result.thread?.id && (result.thread.id !== sent.threadId || scope === 'system')) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('scope');
        nextParams.set('thread', result.thread.id);
        setSearchParams(nextParams, { replace: true });
        if (!isMobile) setDesktopThreadId(result.thread.id);
        setPage(1);
        setFilter('all');
        setSearch('');
      }
      toast.success('Message sent');
      if (result.failed) {
        toast.warning(`${result.failed} ${result.failed === 1 ? 'person was' : 'people were'} not sent`);
      }
    },
    onError: () => toast.error('Unable to send message'),
  });

  const composeMutation = useMutation({
    mutationFn: (payload: SmsComposePayload) =>
      sendSms({
        to: payload.to,
        recipients: payload.recipients,
        group_ids: payload.group_ids,
        body_text: payload.bodyText,
        sms_number_id: payload.smsNumberId,
      }),
    onSuccess: (result) => {
      setComposeOpen(false);
      const sent = result.sent ?? 1;
      if (sent > 1) {
        toast.success(`Sent to ${sent} people`);
      } else {
        toast.success('Message sent');
      }
      if (result.failed) {
        toast.warning(`${result.failed} ${result.failed === 1 ? 'person was' : 'people were'} not sent`);
      }
      queryClient.invalidateQueries({ queryKey: threadsKey });
      if (result.thread?.id) {
        if (scope === 'system') {
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete('scope');
          nextParams.set('thread', result.thread.id);
          setSearchParams(nextParams, { replace: true });
          if (!isMobile) setDesktopThreadId(result.thread.id);
        }
        setPage(1);
        setSearch('');
        setFilter('all');
        if (scope !== 'system') openThread(result.thread.id);
        queryClient.invalidateQueries({ queryKey: ['sms-thread', result.thread.id] });
      }
    },
    onError: (error) => toast.error(getComposeErrorMessage(error, 'Unable to send message')),
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
      queryClient.setQueryData(detailKey, (prev: SmsThreadDetail | null | undefined) => {
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
    includeSystem: systemSmsAllowed,
    personalOnly: role === 'photographer',
    userId: user?.id,
    onMessage: (message) => {
      if (!activeThreadId) return;
      queryClient.setQueryData(detailKey, (prev: SmsThreadDetail | null | undefined) => {
        if (!prev) return prev;
        if (prev.messages.some((existing) => existing.id === message.id)) return prev;
        return { ...prev, messages: [...prev.messages, message] };
      });
      if (message.reaction || parseSmsReaction(message.body, message.direction)) {
        // The original SMS may live in an older duplicate contact thread.
        // Fetch its server-verified target when a reaction arrives live.
        queryClient.invalidateQueries({ queryKey: ['sms-thread', activeThreadId] });
      }
    },
    onThreadUpdated: (updated) => {
      if (!updated.lastMessageAt && !updated.contact) {
        queryClient.invalidateQueries({ queryKey: ['sms-threads'] });
        if (updated.id) {
          queryClient.invalidateQueries({ queryKey: ['sms-thread', updated.id] });
        }
        return;
      }

      // Reapply the server's scope, search and pagination. Inserting a live
      // payload directly can put automated or nonmatching threads in this list.
      queryClient.invalidateQueries({ queryKey: ['sms-threads'] });
      if (updated.id === activeThreadId) queryClient.invalidateQueries({ queryKey: ['sms-thread', activeThreadId] });
    },
  });

  const handleSend = () => {
    if (!composerText.trim() || !activeThreadId || senderUnavailable) return;
    sendMutation.mutate({ body: composerText.trim(), threadId: activeThreadId, draftKey, senderId: role === 'superadmin' ? selectedSenderId : undefined });
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

  const changeScope = (nextScope: SmsInboxScope) => {
    if (nextScope === 'system' && !systemSmsAllowed) return;
    autoSelectThread.current = false;
    pendingScope.current = nextScope;
    setDesktopThreadId(null);
    setPage(1);
    setFilter('all');
    setSearch('');
    setDebouncedSearch('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('thread');
    if (nextScope === 'system') nextParams.set('scope', 'system');
    else nextParams.delete('scope');
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <DashboardLayout>
      <div
        className={
          isMobile
            ? 'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background'
            : 'flex h-[calc(100vh-5rem)] min-h-0 gap-0 overflow-hidden rounded-3xl border border-border/60 bg-muted/20 shadow-sm'
        }
      >
        {listVisible && (
          <div className="flex h-full min-h-0 w-full flex-1 flex-col lg:max-w-md lg:flex-none">
            <SmsThreadList
              threads={threads}
              activeThreadId={activeThreadId ?? undefined}
              filter={filter}
              onFilterChange={(value) => { setFilter(value); setPage(1); }}
              search={search}
              onSearchChange={(value) => { setSearch(value); setPage(1); if (!value.trim()) setDebouncedSearch(''); }}
              onSelectThread={openThread}
              onRefresh={() => threadsQuery.refetch()}
              onCompose={() => setComposeOpen(true)}
              isRefreshing={threadsQuery.isFetching}
              scope={scope}
              canViewSystem={systemSmsAllowed}
              onScopeChange={changeScope}
              meta={threadsQuery.data?.meta}
              onPageChange={setPage}
              error={threadsQuery.isError}
            />
          </div>
        )}

        {conversationVisible ? (
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
            {showThreadSkeleton && (
              <div className="space-y-4 p-6">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-[60vh] rounded-3xl" />
              </div>
            )}
            {threadDetailQuery.isError && <div role="alert" className="p-6 text-sm">Could not open this conversation. Choose another conversation or refresh the inbox.</div>}
            {!activeThreadId && <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">Select a conversation</div>}
            {threadDetail && (
              <div
                className={`flex min-h-0 flex-1 flex-col transition-opacity duration-150 ${
                  threadDetailQuery.isPlaceholderData && threadDetailQuery.isFetching ? 'opacity-60' : 'opacity-100'
                }`}
              >
                <SmsConversation
                thread={threadDetail.thread}
                contact={threadDetail.contact}
                messages={threadDetail.messages}
                composerValue={composerText}
                onComposerChange={setComposerText}
                onSend={handleSend}
                sending={sendMutation.isPending}
                sendDisabled={senderUnavailable}
                senderControl={role === 'superadmin' ? <SmsSenderSelect
                  numbers={senderNumbers}
                  value={selectedSenderId}
                  onChange={id => setSenderChoices(previous => ({ ...previous, [draftKey]: id }))}
                  loading={senderNumbersQuery.isLoading}
                  error={senderNumbersQuery.isError}
                  onRetry={() => void senderNumbersQuery.refetch()}
                  disabled={sendMutation.isPending}
                /> : conversationNumber ? <p className="text-xs text-muted-foreground">Sending from {conversationNumber}</p> : undefined}
                isMobile={!!isMobile}
                onBack={closeThread}
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
              </div>
            )}
          </div>
        ) : (
          !listVisible && <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select a thread</div>
        )}

        {!isMobile && contactPanelOpen && (
          <div className="hidden w-[320px] border-l border-border/70 xl:block">
            <SmsContactPanel
              contact={threadDetail?.contact}
              group={threadDetail?.thread.group}
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
              group={threadDetail?.thread.group}
              onUpdateContact={handleContactUpdate}
              onUpdateComment={handleCommentUpdate}
              onClose={() => setContactDrawerOpen(false)}
            />
          </DrawerContent>
        </Drawer>
      )}

      <SmsComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSend={(payload) => composeMutation.mutate(payload)}
        sending={composeMutation.isPending}
        templates={smsTemplates}
        senderNumbers={senderNumbers}
        senderNumbersLoading={senderNumbersQuery.isLoading}
        senderNumbersError={senderNumbersQuery.isError}
        onRetrySenderNumbers={() => void senderNumbersQuery.refetch()}
      />
    </DashboardLayout>
  );
}
