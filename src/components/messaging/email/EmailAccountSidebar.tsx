import { Mail, Inbox, Send, Clock, AlertCircle, Archive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MessageChannelConfig } from '@/types/messaging';
import { useAuth } from '@/components/auth/AuthProvider';

interface EmailAccountSidebarProps {
  channels: MessageChannelConfig[];
  selectedChannel: number | null;
  selectedFolder: string;
  onChannelSelect: (channelId: number | null) => void;
  onFolderSelect: (folder: string) => void;
}

const folders = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'scheduled', label: 'Scheduled', icon: Clock },
  { id: 'failed', label: 'Failed', icon: AlertCircle },
  { id: 'archive', label: 'Archive', icon: Archive },
  { id: 'trash', label: 'Trash', icon: Trash2 },
];

export function EmailAccountSidebar({
  channels,
  selectedChannel,
  selectedFolder,
  onChannelSelect,
  onFolderSelect,
}: EmailAccountSidebarProps) {
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const visibleFolders = isAdmin ? folders : folders.filter((folder) => folder.id === 'inbox');

  return (
    <div className="w-64 border-r border-border bg-muted/10 overflow-y-auto">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-lg">{isAdmin ? 'Email' : 'Messages'}</h2>
      </div>

      {/* Accounts */}
      {isAdmin && (
        <div className="p-2">
          <div className="text-xs font-medium text-muted-foreground uppercase px-2 py-2">
            Accounts
          </div>
          <Button
            variant={selectedChannel === null ? 'secondary' : 'ghost'}
            className={cn(
              'w-full justify-start',
              selectedChannel === null && 'bg-secondary'
            )}
            onClick={() => onChannelSelect(null)}
          >
            <Mail className="mr-2 h-4 w-4" />
            All Accounts
          </Button>
          {channels.map((channel) => (
            <Button
              key={channel.id}
              variant={selectedChannel === channel.id ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start',
                selectedChannel === channel.id && 'bg-secondary'
              )}
              onClick={() => onChannelSelect(channel.id)}
            >
              <Mail className="mr-2 h-4 w-4" />
              <div className="flex flex-col items-start flex-1 min-w-0">
                <span className="text-sm truncate w-full">{channel.display_name}</span>
                <span className="text-xs text-muted-foreground truncate w-full">
                  {channel.from_email}
                </span>
              </div>
            </Button>
          ))}
        </div>
      )}

      {/* Folders */}
      <div className="p-2 border-t border-border">
        <div className="text-xs font-medium text-muted-foreground uppercase px-2 py-2">
          Folders
        </div>
        {visibleFolders.map((folder) => {
          const Icon = folder.icon;
          const label = !isAdmin && folder.id === 'inbox' ? 'Messages' : folder.label;
          return (
            <Button
              key={folder.id}
              variant={selectedFolder === folder.id ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start',
                selectedFolder === folder.id && 'bg-secondary'
              )}
              onClick={() => onFolderSelect(folder.id)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </Button>
          );
        })}
      </div>

      {/* Labels */}
      {isAdmin && (
        <div className="p-2 border-t border-border">
          <div className="text-xs font-medium text-muted-foreground uppercase px-2 py-2">
            Labels
          </div>
          <Button variant="ghost" className="w-full justify-start">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
            Client
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
            Shoots
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
            Payments
          </Button>
        </div>
      )}
    </div>
  );
}

