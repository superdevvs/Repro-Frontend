import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { getEmailMessages, getEmailSettings } from '@/services/messaging';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { EmailAccountSidebar } from '@/components/messaging/email/EmailAccountSidebar';
import { EmailMessageList } from '@/components/messaging/email/EmailMessageList';
import { EmailMessageDetail } from '@/components/messaging/email/EmailMessageDetail';
import type { Message, MessageChannelConfig } from '@/types/messaging';
import { useAuth } from '@/components/auth/AuthProvider';

export default function EmailInbox() {
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('inbox');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Fetch channels
  const { data: settingsData } = useQuery({
    queryKey: ['email-settings'],
    queryFn: getEmailSettings,
    enabled: isAdmin,
  });

  // Fetch messages
  const { data: messagesData, isLoading, refetch } = useQuery({
    queryKey: ['email-messages', selectedChannel, statusFilter, searchQuery],
    queryFn: () =>
      getEmailMessages({
        channel_id: selectedChannel || undefined,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
        per_page: 25,
      }),
  });

  const channels = isAdmin ? settingsData?.channels || [] : [];
  const messages = messagesData?.data || [];

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Email Navigation Tabs */}
        <EmailNavigation />
        
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Accounts & Folders */}
          <EmailAccountSidebar
          channels={channels}
          selectedChannel={selectedChannel}
          selectedFolder={selectedFolder}
          onChannelSelect={setSelectedChannel}
          onFolderSelect={setSelectedFolder}
        />

        {/* Middle Column - Message List */}
        <div className="flex-1 border-r border-border overflow-hidden flex flex-col">
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

        {/* Right Column - Message Detail */}
        <div className="w-1/3 overflow-hidden">
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

