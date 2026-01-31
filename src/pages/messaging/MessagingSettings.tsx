import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Trash2, Check, AlertCircle, Send, Loader2, RefreshCw } from 'lucide-react';
import {
  getEmailSettings,
  getSmsSettings,
  saveSmsSettings,
  createEmailChannel,
  updateEmailChannel,
  deleteEmailChannel,
  testEmailChannel,
  testSmsConnection,
  testSmsSend,
  syncSmsMessages,
} from '@/services/messaging';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { EmailProviderType } from '@/types/messaging';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function MessagingSettings() {
  type ChannelFormState = {
    provider: EmailProviderType;
    display_name: string;
    from_email: string;
    reply_to_email: string;
    is_default: boolean;
    cakemail_sender_id: string;
    cakemail_list_id: string;
    cakemail_type: 'transactional' | 'marketing';
    cakemail_tags: string;
  };

  const queryClient = useQueryClient();
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [showAddNumber, setShowAddNumber] = useState(false);
  const emptyChannelState: ChannelFormState = {
    provider: 'CAKEMAIL',
    display_name: '',
    from_email: '',
    reply_to_email: '',
    is_default: false,
    cakemail_sender_id: '',
    cakemail_list_id: '',
    cakemail_type: 'transactional',
    cakemail_tags: '',
  };
  const [newChannel, setNewChannel] = useState<ChannelFormState>(() => ({ ...emptyChannelState }));
  const [editingChannelId, setEditingChannelId] = useState<number | null>(null);
  const [newNumber, setNewNumber] = useState({
    phone_number: '',
    label: '',
    mighty_call_key: '',
    is_default: false,
  });
  const [showTestSend, setShowTestSend] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Hello! This is a test message from MightyCall.');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingSend, setTestingSend] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Fetch email settings
  const { data: emailSettings, isLoading: emailLoading } = useQuery({
    queryKey: ['email-settings'],
    queryFn: getEmailSettings,
  });

  // Fetch SMS settings
  const { data: smsSettings, isLoading: smsLoading } = useQuery({
    queryKey: ['sms-settings'],
    queryFn: getSmsSettings,
  });

  // Create channel mutation
  const createMutation = useMutation({
    mutationFn: createEmailChannel,
    onSuccess: () => {
      toast.success('Email channel added successfully');
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      setShowAddChannel(false);
      setEditingChannelId(null);
      setNewChannel({ ...emptyChannelState });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add email channel');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      updateEmailChannel(id, data),
    onSuccess: () => {
      toast.success('Email channel updated successfully');
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      setShowAddChannel(false);
      setEditingChannelId(null);
      setNewChannel({ ...emptyChannelState });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update email channel');
    },
  });

  // Delete channel mutation
  const deleteMutation = useMutation({
    mutationFn: deleteEmailChannel,
    onSuccess: () => {
      toast.success('Email channel deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete channel');
    },
  });

  // Test channel mutation
  const testMutation = useMutation({
    mutationFn: ({ id, email }: { id: number; email: string }) => testEmailChannel(id, email),
    onSuccess: () => {
      toast.success('Test email sent successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send test email');
    },
  });

  // Save SMS settings mutation
  const saveSmsMutation = useMutation({
    mutationFn: saveSmsSettings,
    onSuccess: (response: any) => {
      toast.success('SMS numbers saved successfully');
      // Update the query cache with the returned numbers if available
      if (response?.data?.numbers) {
        queryClient.setQueryData(['sms-settings'], { numbers: response.data.numbers });
      } else {
        // Otherwise, refetch
        queryClient.invalidateQueries({ queryKey: ['sms-settings'] });
      }
      setShowAddNumber(false);
      setNewNumber({
        phone_number: '',
        label: '',
        mighty_call_key: '',
        is_default: false,
      });
    },
    onError: (error: any) => {
      console.error('Failed to save SMS numbers:', error);
      const errorMessage = error?.response?.data?.message 
        || error?.response?.data?.error 
        || error?.message 
        || 'Failed to save SMS numbers';
      toast.error(errorMessage);
    },
  });

  const channels = emailSettings?.channels || [];
  const numbers = smsSettings?.numbers || [];
  const isEditing = editingChannelId !== null;

  const buildCakemailConfig = () => {
    const config: Record<string, string | string[]> = {};

    if (newChannel.cakemail_sender_id.trim()) {
      config.cakemail_sender_id = newChannel.cakemail_sender_id.trim();
    }

    if (newChannel.cakemail_list_id.trim()) {
      config.cakemail_list_id = newChannel.cakemail_list_id.trim();
    }

    if (newChannel.cakemail_type) {
      config.cakemail_type = newChannel.cakemail_type;
    }

    if (newChannel.cakemail_tags.trim()) {
      const tags = newChannel.cakemail_tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      if (tags.length) {
        config.cakemail_tags = tags;
      }
    }

    return config;
  };

  const handleAddChannel = () => {
    if (!newChannel.display_name || !newChannel.from_email) {
      toast.error('Name and email are required');
      return;
    }

    const cakemailConfig = newChannel.provider === 'CAKEMAIL' ? buildCakemailConfig() : undefined;

    if (isEditing && editingChannelId) {
      updateMutation.mutate({
        id: editingChannelId,
        data: {
          display_name: newChannel.display_name,
          from_email: newChannel.from_email,
          reply_to_email: newChannel.reply_to_email,
          is_default: newChannel.is_default,
          ...(cakemailConfig && Object.keys(cakemailConfig).length > 0
            ? { config_json: cakemailConfig }
            : {}),
        },
      });
      return;
    }

    createMutation.mutate({
      type: 'EMAIL',
      provider: newChannel.provider,
      display_name: newChannel.display_name,
      from_email: newChannel.from_email,
      reply_to_email: newChannel.reply_to_email,
      is_default: newChannel.is_default,
      owner_scope: 'GLOBAL',
      ...(cakemailConfig && Object.keys(cakemailConfig).length > 0
        ? { config_json: cakemailConfig }
        : {}),
    });
  };

  const handleOpenAddChannel = () => {
    setEditingChannelId(null);
    setNewChannel({ ...emptyChannelState });
    setShowAddChannel(true);
  };

  const handleEditChannel = (channel: any) => {
    const config = channel?.config_json ?? {};
    const tagsValue = Array.isArray(config.cakemail_tags)
      ? config.cakemail_tags.join(', ')
      : config.cakemail_tags ?? '';

    setEditingChannelId(channel.id ?? null);
    setNewChannel({
      provider: (channel.provider as EmailProviderType) ?? 'CAKEMAIL',
      display_name: channel.display_name ?? '',
      from_email: channel.from_email ?? '',
      reply_to_email: channel.reply_to_email ?? '',
      is_default: !!channel.is_default,
      cakemail_sender_id: config.cakemail_sender_id ?? '',
      cakemail_list_id: config.cakemail_list_id ?? '',
      cakemail_type: config.cakemail_type ?? 'transactional',
      cakemail_tags: tagsValue,
    });
    setShowAddChannel(true);
  };

  const handleTestChannel = (channelId: number) => {
    const testEmail = prompt('Enter email address to send test:');
    if (testEmail) {
      testMutation.mutate({ id: channelId, email: testEmail });
    }
  };

  const handleAddNumber = () => {
    if (!newNumber.phone_number || !newNumber.mighty_call_key) {
      toast.error('Phone number and API key are required');
      return;
    }

    // Preserve existing numbers with their IDs, add new number without ID
    const updatedNumbers = [
      ...numbers.map((n: any) => ({ 
        ...n, 
        id: n.id || undefined // Keep ID if exists
      })),
      {
        ...newNumber,
        // Don't include id for new numbers
      }
    ];
    
    console.log('Saving SMS numbers:', updatedNumbers);
    saveSmsMutation.mutate({ numbers: updatedNumbers });
  };

  const handleUpdateNumber = (index: number, updatedNumber: any) => {
    const updatedNumbers = [...numbers];
    updatedNumbers[index] = { ...updatedNumbers[index], ...updatedNumber };
    saveSmsMutation.mutate({ numbers: updatedNumbers });
  };

  const handleDeleteNumber = (index: number) => {
    if (confirm('Delete this SMS number?')) {
      const updatedNumbers = numbers.filter((_: any, i: number) => i !== index);
      saveSmsMutation.mutate({ numbers: updatedNumbers });
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const result = await testSmsConnection();
      if (result.success) {
        toast.success('MightyCall connection successful!');
      } else {
        toast.error(result.error || 'Connection test failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Connection test failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestSend = async () => {
    if (!testPhone) {
      toast.error('Please enter a phone number');
      return;
    }
    setTestingSend(true);
    try {
      const result = await testSmsSend({ to: testPhone, message: testMessage });
      if (result.success) {
        toast.success(`Test SMS sent! Message ID: ${result.message_id}`);
        setShowTestSend(false);
        setTestPhone('');
      } else {
        toast.error(result.error || 'Failed to send test SMS');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to send test SMS');
    } finally {
      setTestingSend(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncSmsMessages(24);
      if (result.success) {
        toast.success('Messages synced successfully!');
      } else {
        toast.error(result.error || 'Sync failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Messaging Settings</h1>
          <p className="text-muted-foreground">Manage email accounts and SMS providers</p>
        </div>

        <Tabs defaultValue="email">
          <TabsList className="mb-6">
            <TabsTrigger value="email">Email Providers</TabsTrigger>
            <TabsTrigger value="sms">SMS (MightyCall)</TabsTrigger>
          </TabsList>

          {/* Email Settings */}
          <TabsContent value="email" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Connected Email Accounts</h2>
              <Dialog open={showAddChannel} onOpenChange={setShowAddChannel}>
                <DialogTrigger asChild>
                  <Button onClick={handleOpenAddChannel}>
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
                        onValueChange={(value) =>
                          setNewChannel({ ...newChannel, provider: value as EmailProviderType })
                        }
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
                      <Input
                        value={newChannel.display_name}
                        onChange={(e) => setNewChannel({ ...newChannel, display_name: e.target.value })}
                        placeholder="e.g., Sales Team"
                      />
                    </div>
                    <div>
                      <Label>From Email</Label>
                      <Input
                        type="email"
                        value={newChannel.from_email}
                        onChange={(e) => setNewChannel({ ...newChannel, from_email: e.target.value })}
                        placeholder="sales@company.com"
                      />
                    </div>
                    <div>
                      <Label>Reply-To Email (Optional)</Label>
                      <Input
                        type="email"
                        value={newChannel.reply_to_email}
                        onChange={(e) => setNewChannel({ ...newChannel, reply_to_email: e.target.value })}
                        placeholder="noreply@company.com"
                      />
                    </div>
                    {newChannel.provider === 'CAKEMAIL' && (
                      <div className="space-y-4 rounded-md border border-dashed border-muted p-4">
                        <div>
                          <Label>Cakemail Sender ID</Label>
                          <Input
                            value={newChannel.cakemail_sender_id}
                            onChange={(e) =>
                              setNewChannel({ ...newChannel, cakemail_sender_id: e.target.value })
                            }
                            placeholder="e.g., HeCJuYblJuMz441KoKwN"
                          />
                        </div>
                        <div>
                          <Label>Cakemail List ID</Label>
                          <Input
                            value={newChannel.cakemail_list_id}
                            onChange={(e) =>
                              setNewChannel({ ...newChannel, cakemail_list_id: e.target.value })
                            }
                            placeholder="e.g., 8651530"
                          />
                        </div>
                        <div>
                          <Label>Email Type</Label>
                          <Select
                            value={newChannel.cakemail_type}
                            onValueChange={(value) =>
                              setNewChannel({
                                ...newChannel,
                                cakemail_type: value as 'transactional' | 'marketing',
                              })
                            }
                          >
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
                          <Input
                            value={newChannel.cakemail_tags}
                            onChange={(e) =>
                              setNewChannel({ ...newChannel, cakemail_tags: e.target.value })
                            }
                            placeholder="welcome, onboarding"
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={newChannel.is_default}
                        onCheckedChange={(checked) => setNewChannel({ ...newChannel, is_default: checked })}
                      />
                      <Label>Set as default</Label>
                    </div>
                    <Button
                      onClick={handleAddChannel}
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="w-full"
                    >
                      {isEditing
                        ? updateMutation.isPending
                          ? 'Saving...'
                          : 'Save Changes'
                        : createMutation.isPending
                        ? 'Adding...'
                        : 'Add Account'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {emailLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="p-6 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </Card>
                ))}
              </div>
            ) : channels.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No email accounts configured</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {channels.map((channel) => (
                  <Card key={channel.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{channel.display_name}</h3>
                          {channel.is_default && (
                            <Badge variant="secondary">
                              <Check className="mr-1 h-3 w-3" />
                              Default
                            </Badge>
                          )}
                          <Badge variant="outline">{channel.provider}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>From: {channel.from_email}</p>
                          {channel.reply_to_email && <p>Reply-To: {channel.reply_to_email}</p>}
                          <p>Scope: {channel.owner_scope}</p>
                          {channel.provider === 'CAKEMAIL' && channel.config_json && (
                            <div className="pt-2 text-xs text-muted-foreground space-y-1">
                              {channel.config_json.cakemail_sender_id && (
                                <p>Sender ID: {channel.config_json.cakemail_sender_id}</p>
                              )}
                              {channel.config_json.cakemail_list_id && (
                                <p>List ID: {channel.config_json.cakemail_list_id}</p>
                              )}
                              {channel.config_json.cakemail_type && (
                                <p>Type: {channel.config_json.cakemail_type}</p>
                              )}
                              {channel.config_json.cakemail_tags && (
                                <p>
                                  Tags:{' '}
                                  {Array.isArray(channel.config_json.cakemail_tags)
                                    ? channel.config_json.cakemail_tags.join(', ')
                                    : channel.config_json.cakemail_tags}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditChannel(channel)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestChannel(channel.id)}
                        >
                          Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm('Delete this email account?')) {
                              deleteMutation.mutate(channel.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* SMS Settings */}
          <TabsContent value="sms" className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-semibold">MightyCall Configuration</h2>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testingConnection || numbers.length === 0}
                >
                  {testingConnection ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Testing...</>
                  ) : (
                    'Test Connection'
                  )}
                </Button>
                <Dialog open={showTestSend} onOpenChange={setShowTestSend}>
                  <DialogTrigger asChild>
                    <Button variant="outline" disabled={numbers.length === 0}>
                      <Send className="mr-2 h-4 w-4" />
                      Test Send
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Send Test SMS</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Phone Number</Label>
                        <Input
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value)}
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                      <div>
                        <Label>Message</Label>
                        <Input
                          value={testMessage}
                          onChange={(e) => setTestMessage(e.target.value)}
                          placeholder="Test message"
                        />
                      </div>
                      <Button
                        onClick={handleTestSend}
                        disabled={testingSend || !testPhone}
                        className="w-full"
                      >
                        {testingSend ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                        ) : (
                          <><Send className="mr-2 h-4 w-4" />Send Test SMS</>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  onClick={handleSync}
                  disabled={syncing || numbers.length === 0}
                >
                  {syncing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Syncing...</>
                  ) : (
                    <><RefreshCw className="mr-2 h-4 w-4" />Sync Messages</>
                  )}
                </Button>
                <Dialog open={showAddNumber} onOpenChange={setShowAddNumber}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Number
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add SMS Number</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Phone Number</Label>
                      <Input
                        value={newNumber.phone_number}
                        onChange={(e) => setNewNumber({ ...newNumber, phone_number: e.target.value })}
                        placeholder="(202) 868-1663"
                      />
                    </div>
                    <div>
                      <Label>Label (Optional)</Label>
                      <Input
                        value={newNumber.label}
                        onChange={(e) => setNewNumber({ ...newNumber, label: e.target.value })}
                        placeholder="e.g., Main Number"
                      />
                    </div>
                    <div>
                      <Label>MightyCall API Key</Label>
                      <Input
                        type="password"
                        value={newNumber.mighty_call_key}
                        onChange={(e) => setNewNumber({ ...newNumber, mighty_call_key: e.target.value })}
                        placeholder="Enter API key for this number"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Each phone number has its own API key from MightyCall
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={newNumber.is_default}
                        onCheckedChange={(checked) => setNewNumber({ ...newNumber, is_default: checked })}
                      />
                      <Label>Set as default</Label>
                    </div>
                    <Button
                      onClick={handleAddNumber}
                      disabled={saveSmsMutation.isPending || !newNumber.phone_number || !newNumber.mighty_call_key}
                      className="w-full"
                    >
                      {saveSmsMutation.isPending ? 'Adding...' : 'Add Number'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              </div>
            </div>

            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${numbers.length > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-medium">
                    {numbers.length > 0 ? 'MightyCall Connected' : 'MightyCall Not Connected'}
                  </span>
                </div>

                {smsLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </div>
                ) : numbers.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-4 flex gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
                    <div>
                      <p className="font-medium text-yellow-800">No SMS numbers configured</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        Add your MightyCall phone numbers and their API keys to enable SMS functionality.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label>Configured Numbers</Label>
                    {numbers.map((number: any, idx: number) => (
                      <Card key={number.id || idx} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="font-medium">{number.phone_number}</div>
                              {number.is_default && (
                                <Badge variant="secondary">
                                  <Check className="mr-1 h-3 w-3" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            {number.label && (
                              <div className="text-sm text-muted-foreground mb-1">{number.label}</div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              API Key: {number.mighty_call_key ? '••••••••' : 'Not set'}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const updatedLabel = prompt('Enter label:', number.label || '');
                                if (updatedLabel !== null) {
                                  handleUpdateNumber(idx, { label: updatedLabel });
                                }
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteNumber(idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

