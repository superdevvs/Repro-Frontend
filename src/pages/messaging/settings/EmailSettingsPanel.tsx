import { Check, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { MessageChannelConfig } from '@/types/messaging';
import type { ChannelFormState } from './messagingSettingsHelpers';
import { getDisplayConfigRows } from './messagingSettingsHelpers';

interface EmailSettingsPanelProps {
  channels: MessageChannelConfig[];
  emailLoading: boolean;
  isEditing: boolean;
  showAddChannel: boolean;
  newChannel: ChannelFormState;
  createPending: boolean;
  updatePending: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAddChannel: () => void;
  onChannelChange: (value: ChannelFormState) => void;
  onSave: () => void;
  onEdit: (channel: MessageChannelConfig) => void;
  onTest: (channelId: number) => void;
  onDelete: (channelId: number) => void;
}

export function EmailSettingsPanel({
  channels,
  emailLoading,
  isEditing,
  showAddChannel,
  newChannel,
  createPending,
  updatePending,
  onOpenChange,
  onOpenAddChannel,
  onChannelChange,
  onSave,
  onEdit,
  onTest,
  onDelete,
}: EmailSettingsPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Connected Email Accounts</h2>
        <Dialog open={showAddChannel} onOpenChange={onOpenChange}>
          <DialogTrigger asChild>
            <Button onClick={onOpenAddChannel}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Email Account' : 'Add Email Account'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Provider</Label>
                <Select
                  value={newChannel.provider}
                  onValueChange={(value) => onChannelChange({ ...newChannel, provider: value as ChannelFormState['provider'] })}
                  disabled={isEditing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAKEMAIL">Cakemail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Display Name</Label>
                <Input value={newChannel.display_name} onChange={(e) => onChannelChange({ ...newChannel, display_name: e.target.value })} placeholder="e.g., Sales Team" />
              </div>
              <div>
                <Label>From Email</Label>
                <Input type="email" value={newChannel.from_email} onChange={(e) => onChannelChange({ ...newChannel, from_email: e.target.value })} placeholder="sales@company.com" />
              </div>
              <div>
                <Label>Reply-To Email (Optional)</Label>
                <Input type="email" value={newChannel.reply_to_email} onChange={(e) => onChannelChange({ ...newChannel, reply_to_email: e.target.value })} placeholder="noreply@company.com" />
              </div>
              <div className="space-y-4 rounded-md border border-dashed border-muted p-4">
                <div>
                  <Label>Cakemail Sender ID</Label>
                  <Input value={newChannel.cakemail_sender_id} onChange={(e) => onChannelChange({ ...newChannel, cakemail_sender_id: e.target.value })} placeholder="e.g., HeCJuYblJuMz441KoKwN" />
                </div>
                <div>
                  <Label>Cakemail List ID</Label>
                  <Input value={newChannel.cakemail_list_id} onChange={(e) => onChannelChange({ ...newChannel, cakemail_list_id: e.target.value })} placeholder="e.g., 8651530" />
                </div>
                <div>
                  <Label>Email Type</Label>
                  <Select value={newChannel.cakemail_type} onValueChange={(value) => onChannelChange({ ...newChannel, cakemail_type: value as ChannelFormState['cakemail_type'] })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transactional">Transactional</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tags (comma-separated)</Label>
                  <Input value={newChannel.cakemail_tags} onChange={(e) => onChannelChange({ ...newChannel, cakemail_tags: e.target.value })} placeholder="welcome, onboarding" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={newChannel.is_default} onCheckedChange={(checked) => onChannelChange({ ...newChannel, is_default: checked })} />
                <Label>Set as default</Label>
              </div>
              <Button onClick={onSave} disabled={createPending || updatePending} className="w-full">
                {isEditing ? (updatePending ? 'Saving...' : 'Save Changes') : createPending ? 'Adding...' : 'Add Account'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {emailLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse p-6">
              <div className="h-4 w-3/4 rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : channels.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No email accounts configured</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {channels.map((channel) => {
            const configRows = getDisplayConfigRows(channel.config_json);
            return (
              <Card key={channel.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="font-semibold">{channel.display_name}</h3>
                      {channel.is_default && (
                        <Badge variant="secondary">
                          <Check className="mr-1 h-3 w-3" />
                          Default
                        </Badge>
                      )}
                      <Badge variant="outline">{channel.provider}</Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>From: {channel.from_email}</p>
                      {channel.reply_to_email && <p>Reply-To: {channel.reply_to_email}</p>}
                      <p>Scope: {channel.owner_scope}</p>
                      {configRows.length > 0 && (
                        <div className="space-y-1 pt-2 text-xs text-muted-foreground">
                          {configRows.map((row) => (
                            <p key={`${channel.id}-${row.label}`}>{row.label}: {row.value}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(channel)}>Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => onTest(channel.id)}>Test</Button>
                    <Button variant="outline" size="sm" onClick={() => onDelete(channel.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
