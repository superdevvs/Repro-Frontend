import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { getEmailMessages } from '@/services/messaging';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { EmailMessageList } from '@/components/messaging/email/EmailMessageList';
import { EmailMessageDetail } from '@/components/messaging/email/EmailMessageDetail';
import type { Message } from '@/types/messaging';
import { useAuth } from '@/components/auth/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EmailInbox() {
  const { role } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Fetch messages
  const { data: messagesData, isLoading, refetch } = useQuery({
    queryKey: ['email-messages', statusFilter, searchQuery],
    queryFn: () =>
      getEmailMessages({
        status: statusFilter || undefined,
        search: searchQuery || undefined,
        per_page: 25,
      }),
  });

  const messages = messagesData?.data || [];

  // Mobile: show detail view full-screen when a message is selected
  const showMobileDetail = isMobile && selectedMessage;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Email Navigation Tabs - hide when viewing detail on mobile */}
        {!showMobileDetail && <EmailNavigation />}
        
        {/* Main Content */}
        {isMobile ? (
          // Mobile: full-screen list OR full-screen detail
          showMobileDetail ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <EmailMessageDetail
                message={selectedMessage}
                onClose={() => setSelectedMessage(null)}
                onRefresh={refetch}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <EmailMessageList
                messages={messages}
                isLoading={isLoading}
                selectedMessage={selectedMessage}
                onSelectMessage={setSelectedMessage}
                onSearchChange={setSearchQuery}
                onStatusFilterChange={setStatusFilter}
                onRefresh={refetch}
              />
            </div>
          )
        ) : (
          // Desktop: side-by-side list + detail
          <div className="flex-1 flex overflow-hidden gap-4 px-4 pb-4">
            <div className="w-[540px] border border-border rounded-lg overflow-hidden flex flex-col bg-background">
              <EmailMessageList
                messages={messages}
                isLoading={isLoading}
                selectedMessage={selectedMessage}
                onSelectMessage={setSelectedMessage}
                onSearchChange={setSearchQuery}
                onStatusFilterChange={setStatusFilter}
                onRefresh={refetch}
              />
            </div>
            <div className="flex-1 min-w-0 border border-border rounded-lg overflow-hidden">
              {selectedMessage ? (
                <EmailMessageDetail
                  message={selectedMessage}
                  onClose={() => setSelectedMessage(null)}
                  onRefresh={refetch}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center space-y-2">
                    <p>Select a message to view</p>
                    <p className="text-sm">
                      Or press <kbd className="px-2 py-1 bg-muted rounded">C</kbd> to compose
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Compose Button - mobile only, hide when viewing detail */}
      {isMobile && !showMobileDetail && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] right-4 z-40">
          <Button
            size="lg"
            className="h-12 rounded-full shadow-lg shadow-primary/30 px-5 gap-2"
            onClick={() => navigate('/messaging/email/compose')}
          >
            <Pencil className="h-4 w-4" />
            Compose
          </Button>
        </div>
      )}
    </DashboardLayout>
  );
}
