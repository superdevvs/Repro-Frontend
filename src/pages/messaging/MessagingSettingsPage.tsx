import React, { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  fetchMessagingSettings,
  saveEmailSettings,
  saveSmsSettings,
} from '@/services/messagingService';
import { getAuthToken } from '@/utils/authToken';
import { Loader2, Plus } from 'lucide-react';

type Channel = {
  id?: number;
  display_name: string;
  from_email?: string;
  provider: string;
  is_default?: boolean;
  owner_scope?: string;
  type?: string;
};

type SmsNumber = {
  id?: number;
  phone_number: string;
  label?: string;
  mighty_call_key?: string;
  is_default?: boolean;
};

const MessagingSettingsPage = () => {
  const { toast } = useToast();
  const { session } = useAuth();
  const token = getAuthToken(session?.accessToken);

  const [emailChannels, setEmailChannels] = useState<Channel[]>([]);
  const [smsNumbers, setSmsNumbers] = useState<SmsNumber[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingSms, setSavingSms] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchMessagingSettings(token);
      setEmailChannels(response.email.channels ?? []);
      setSmsNumbers(response.sms.numbers ?? []);
    } catch (err) {
      toast({
        title: 'Failed to load settings',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateChannel = (index: number, field: keyof Channel, value: string | boolean) => {
    setEmailChannels((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const updateNumber = (index: number, field: keyof SmsNumber, value: string | boolean) => {
    setSmsNumbers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSaveEmail = async () => {
    try {
      setSavingEmail(true);
      await saveEmailSettings(emailChannels, token);
      toast({ title: 'Email settings saved' });
      await loadSettings();
    } catch (err) {
      toast({
        title: 'Unable to save email settings',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSaveSms = async () => {
    try {
      setSavingSms(true);
      await saveSmsSettings(smsNumbers, token);
      toast({ title: 'SMS settings saved' });
      await loadSettings();
    } catch (err) {
      toast({
        title: 'Unable to save SMS settings',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingSms(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 px-2 pt-3 pb-3 sm:space-y-6 sm:p-6">
      <PageHeader
        title="Messaging settings"
        description="Configure provider credentials and defaults for email & SMS."
        actions={
          <Button variant="outline" size="sm" onClick={loadSettings} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Email providers</CardTitle>
            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                setEmailChannels((prev) => [
                  ...prev,
                  {
                    display_name: 'New channel',
                    provider: 'CAKEMAIL',
                    from_email: '',
                    is_default: false,
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailChannels.map((channel, index) => (
              <div key={channel.id ?? `new-${index}`} className="rounded-md border p-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Display name</label>
                    <Input
                      value={channel.display_name}
                      onChange={(event) => updateChannel(index, 'display_name', event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Provider</label>
                    <Select
                      value={channel.provider}
                      onValueChange={(value) => updateChannel(index, 'provider', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CAKEMAIL">Cakemail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">From email</label>
                  <Input
                    type="email"
                    value={channel.from_email ?? ''}
                    onChange={(event) => updateChannel(index, 'from_email', event.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Default channel</span>
                  <Switch
                    checked={!!channel.is_default}
                    onCheckedChange={(value) => updateChannel(index, 'is_default', value)}
                  />
                </div>
              </div>
            ))}

            {emailChannels.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No email providers configured yet. Add one to get started.
              </p>
            )}

            <Button className="w-full" onClick={handleSaveEmail} disabled={savingEmail}>
              {savingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save email settings'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>MightyCall numbers</CardTitle>
            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                setSmsNumbers((prev) => [
                  ...prev,
                  {
                    phone_number: '',
                    label: 'New number',
                    is_default: false,
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {smsNumbers.map((number, index) => (
              <div key={number.id ?? `sms-${index}`} className="space-y-3 rounded-md border p-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Phone number</label>
                  <Input
                    value={number.phone_number}
                    onChange={(event) => updateNumber(index, 'phone_number', event.target.value)}
                    placeholder="+1 555 010 9999"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Label</label>
                    <Input
                      value={number.label ?? ''}
                      onChange={(event) => updateNumber(index, 'label', event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">MightyCall key</label>
                    <Input
                      value={number.mighty_call_key ?? ''}
                      onChange={(event) => updateNumber(index, 'mighty_call_key', event.target.value)}
                      placeholder="API key"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Default number</span>
                  <Switch
                    checked={!!number.is_default}
                    onCheckedChange={(value) => updateNumber(index, 'is_default', value)}
                  />
                </div>
              </div>
            ))}

            {smsNumbers.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No MightyCall numbers connected yet. Add one to enable SMS.
              </p>
            )}

            <Button className="w-full" onClick={handleSaveSms} disabled={savingSms}>
              {savingSms ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save SMS settings'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
      </div>
    </DashboardLayout>
  );
};

export default MessagingSettingsPage;





