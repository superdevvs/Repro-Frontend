import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { getEmailMessages } from '@/services/messaging';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { EmailMessageList } from '@/components/messaging/email/EmailMessageList';
import { EmailMessageDetail } from '@/components/messaging/email/EmailMessageDetail';
import type { Message } from '@/types/messaging';
import { useAuth } from '@/components/auth/AuthProvider';

export default function EmailInbox() {
  const { role } = useAuth();
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

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Email Navigation Tabs */}
        <EmailNavigation />
        
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden gap-4 px-4 pb-4">
          {/* Message List */}
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

          {/* Message Detail */}
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
      </div>
    </DashboardLayout>
  );
}
