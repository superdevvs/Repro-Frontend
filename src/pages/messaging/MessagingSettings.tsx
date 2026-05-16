import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/sonner-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  createEmailChannel,
  deleteEmailChannel,
  getEmailSettings,
  getSmsSettings,
  saveSmsSettings,
  testEmailChannel,
  testSmsConnection,
  testSmsSend,
  updateEmailChannel,
} from '@/services/messaging';
import { EmailSettingsPanel } from './settings/EmailSettingsPanel';
import { SmsSettingsPanel } from './settings/SmsSettingsPanel';
import {
  buildCakemailConfig,
  emptyChannelState,
  emptyNumberState,
  getMessagingSettingsErrorMessage,
  mapChannelToFormState,
  type ChannelFormState,
} from './settings/messagingSettingsHelpers';
import type { MessageChannelConfig, SmsAiSettings, SmsNumberConfig } from '@/types/messaging';

export default function MessagingSettings() {
  const queryClient = useQueryClient();
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [showAddNumber, setShowAddNumber] = useState(false);
  const [newChannel, setNewChannel] = useState<ChannelFormState>({ ...emptyChannelState });
  const [editingChannelId, setEditingChannelId] = useState<number | null>(null);
  const [newNumber, setNewNumber] = useState<SmsNumberConfig>({ ...emptyNumberState });
  const [showTestSend, setShowTestSend] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Hello! This is a test message from Telnyx.');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingSend, setTestingSend] = useState(false);
  const [aiDraft, setAiDraft] = useState<SmsAiSettings | undefined>();

  const { data: emailSettings, isLoading: emailLoading } = useQuery({ queryKey: ['email-settings'], queryFn: getEmailSettings });
  const { data: smsSettings, isLoading: smsLoading } = useQuery({ queryKey: ['sms-settings'], queryFn: getSmsSettings });

  const createMutation = useMutation({
    mutationFn: createEmailChannel,
    onSuccess: () => {
      toast.success('Email channel added successfully');
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      setShowAddChannel(false);
      setEditingChannelId(null);
      setNewChannel({ ...emptyChannelState });
    },
    onError: (error) => toast.error(getMessagingSettingsErrorMessage(error, 'Failed to add email channel')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MessageChannelConfig> }) => updateEmailChannel(id, data),
    onSuccess: () => {
      toast.success('Email channel updated successfully');
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      setShowAddChannel(false);
      setEditingChannelId(null);
      setNewChannel({ ...emptyChannelState });
    },
    onError: (error) => toast.error(getMessagingSettingsErrorMessage(error, 'Failed to update email channel')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEmailChannel,
    onSuccess: () => {
      toast.success('Email channel deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
    },
    onError: (error) => toast.error(getMessagingSettingsErrorMessage(error, 'Failed to delete channel')),
  });

  const testMutation = useMutation({
    mutationFn: ({ id, email }: { id: number; email: string }) => testEmailChannel(id, email),
    onSuccess: () => toast.success('Test email sent successfully'),
    onError: (error) => toast.error(getMessagingSettingsErrorMessage(error, 'Failed to send test email')),
  });

  const saveSmsMutation = useMutation({
    mutationFn: saveSmsSettings,
    onSuccess: (response) => {
      toast.success('Telnyx sender saved successfully');
      queryClient.setQueryData(['sms-settings'], { numbers: response.numbers, ai: response.ai ?? smsSettings?.ai });
      setShowAddNumber(false);
      setNewNumber({ ...emptyNumberState });
    },
    onError: (error) => toast.error(getMessagingSettingsErrorMessage(error, 'Failed to save SMS sender')),
  });

  const channels = emailSettings?.channels ?? [];
  const numbers = smsSettings?.numbers ?? [];
  const isEditing = editingChannelId !== null;

  useEffect(() => {
    if (smsSettings?.ai) {
      setAiDraft(smsSettings.ai);
    }
  }, [smsSettings?.ai]);

  const handleSaveChannel = () => {
    if (!newChannel.display_name || !newChannel.from_email) {
      toast.error('Name and email are required');
      return;
    }

    const cakemailConfig = newChannel.provider === 'CAKEMAIL' ? buildCakemailConfig(newChannel) : undefined;

    if (isEditing && editingChannelId) {
      updateMutation.mutate({
        id: editingChannelId,
        data: {
          display_name: newChannel.display_name,
          from_email: newChannel.from_email,
          reply_to_email: newChannel.reply_to_email,
          is_default: newChannel.is_default,
          ...(cakemailConfig ? { config_json: cakemailConfig } : {}),
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
      ...(cakemailConfig ? { config_json: cakemailConfig } : {}),
    });
  };

  const handleOpenAddChannel = () => {
    setEditingChannelId(null);
    setNewChannel({ ...emptyChannelState });
    setShowAddChannel(true);
  };

  const handleEditChannel = (channel: MessageChannelConfig) => {
    setEditingChannelId(channel.id ?? null);
    setNewChannel(mapChannelToFormState(channel));
    setShowAddChannel(true);
  };

  const handleTestChannel = (channelId: number) => {
    const testEmail = prompt('Enter email address to send test:');
    if (testEmail) {
      testMutation.mutate({ id: channelId, email: testEmail });
    }
  };

  const handleDeleteChannel = (channelId: number) => {
    if (confirm('Delete this email account?')) {
      deleteMutation.mutate(channelId);
    }
  };

  const handleAddNumber = () => {
    if (!newNumber.phone_number) {
      toast.error('Phone number is required');
      return;
    }

    saveSmsMutation.mutate({
      numbers: [
        {
          ...newNumber,
          provider: 'TELNYX',
          is_default: true,
          sms_ai_enabled: newNumber.sms_ai_enabled !== false,
        },
      ],
      ai: aiDraft,
    });
  };

  const handleDeleteNumber = (index: number) => {
    if (confirm('Delete this SMS number?')) {
      saveSmsMutation.mutate({ numbers: numbers.filter((_, i) => i !== index), ai: aiDraft });
    }
  };

  const handleEditNumber = (index: number) => {
    const updatedLabel = prompt('Enter label:', numbers[index]?.label || '');
    if (updatedLabel !== null) {
      const updatedNumbers = [...numbers];
      updatedNumbers[index] = { ...updatedNumbers[index], label: updatedLabel };
      saveSmsMutation.mutate({ numbers: updatedNumbers, ai: aiDraft });
    }
  };

  const handleToggleNumberAi = (index: number, enabled: boolean) => {
    const updatedNumbers = [...numbers];
    updatedNumbers[index] = { ...updatedNumbers[index], sms_ai_enabled: enabled };
    saveSmsMutation.mutate({ numbers: updatedNumbers, ai: aiDraft });
  };

  const handleSaveAiSettings = () => {
    saveSmsMutation.mutate({ numbers, ai: aiDraft });
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const result = await testSmsConnection(numbers[0]?.id);
      if (result.success) toast.success('Telnyx connection successful!');
      else toast.error(result.error || 'Connection test failed');
    } catch (error) {
      toast.error(getMessagingSettingsErrorMessage(error, 'Connection test failed'));
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
    } catch (error) {
      toast.error(getMessagingSettingsErrorMessage(error, 'Failed to send test SMS'));
    } finally {
      setTestingSend(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 px-2 pt-3 pb-3 sm:space-y-6 sm:p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Messaging Settings</h1>
          <p className="text-muted-foreground">Manage email accounts and SMS providers</p>
        </div>

        <Tabs defaultValue="email">
          <TabsList className="mb-6">
            <TabsTrigger value="email">Email Providers</TabsTrigger>
            <TabsTrigger value="sms">SMS (Telnyx)</TabsTrigger>
          </TabsList>

          <TabsContent value="email">
            <EmailSettingsPanel
              channels={channels}
              emailLoading={emailLoading}
              isEditing={isEditing}
              showAddChannel={showAddChannel}
              newChannel={newChannel}
              createPending={createMutation.isPending}
              updatePending={updateMutation.isPending}
              onOpenChange={setShowAddChannel}
              onOpenAddChannel={handleOpenAddChannel}
              onChannelChange={setNewChannel}
              onSave={handleSaveChannel}
              onEdit={handleEditChannel}
              onTest={handleTestChannel}
              onDelete={handleDeleteChannel}
            />
          </TabsContent>

          <TabsContent value="sms">
            <SmsSettingsPanel
              numbers={numbers}
              aiSettings={smsSettings?.ai}
              aiDraft={aiDraft}
              smsLoading={smsLoading}
              showTestSend={showTestSend}
              showAddNumber={showAddNumber}
              newNumber={newNumber}
              testPhone={testPhone}
              testMessage={testMessage}
              testingConnection={testingConnection}
              testingSend={testingSend}
              savePending={saveSmsMutation.isPending}
              onShowTestSendChange={setShowTestSend}
              onShowAddNumberChange={setShowAddNumber}
              onNewNumberChange={setNewNumber}
              onTestPhoneChange={setTestPhone}
              onTestMessageChange={setTestMessage}
              onTestConnection={handleTestConnection}
              onTestSend={handleTestSend}
              onAddNumber={handleAddNumber}
              onEditNumber={handleEditNumber}
              onToggleNumberAi={handleToggleNumberAi}
              onAiDraftChange={setAiDraft}
              onSaveAiSettings={handleSaveAiSettings}
              onDeleteNumber={handleDeleteNumber}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
