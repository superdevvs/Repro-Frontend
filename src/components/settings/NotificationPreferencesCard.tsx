import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSelfProfileSave } from '@/hooks/useSelfProfileSave';
import { useToast } from '@/hooks/use-toast';
import type { UserData } from '@/types/auth';

const SMS_CATEGORIES = [
  { key: 'bookingUpdates', label: 'Booking updates', description: 'Confirmations, scheduling changes, and cancellations.' },
  { key: 'shootReminders', label: 'Shoot reminders', description: 'Reminders before an upcoming shoot.' },
  { key: 'deliveryUpdates', label: 'Media and delivery updates', description: 'Progress updates and notifications when media is ready.' },
  { key: 'payments', label: 'Payments and invoices', description: 'Payment requests, reminders, receipts, and payout updates.' },
  { key: 'accountUpdates', label: 'Account updates', description: 'Account and access updates sent by text.' },
  { key: 'other', label: 'Other text messages', description: 'Direct messages and other dashboard texts.' },
] as const;

type SmsCategory = typeof SMS_CATEGORIES[number]['key'];
type NotificationPreferencesForm = {
  notificationEmail: boolean;
  notificationSMS: boolean;
  smsCategories: Record<SmsCategory, boolean>;
  notifications: { weeklySummaries: boolean };
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);
const readBoolean = (value: unknown, fallback = true) => typeof value === 'boolean' ? value : fallback;
const readSmsBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (value === 0) return false;
  if (typeof value === 'string' && ['', '0', 'false', 'off', 'no'].includes(value.trim().toLowerCase())) return false;
  return true;
};

const readNotificationPreferences = (metadata: unknown): NotificationPreferencesForm => {
  const preferences = asRecord(asRecord(metadata).preferences);
  const legacySettings = asRecord(preferences.notificationSettings);
  const notifications = asRecord(preferences.notifications);
  const smsCategories = asRecord(preferences.smsCategories);

  return {
    notificationEmail: readBoolean(preferences.notificationEmail),
    notificationSMS: readSmsBoolean(preferences.notificationSMS ?? legacySettings.sms),
    smsCategories: {
      bookingUpdates: readSmsBoolean(smsCategories.bookingUpdates),
      shootReminders: readSmsBoolean(smsCategories.shootReminders ?? notifications.shootReminders),
      deliveryUpdates: readSmsBoolean(smsCategories.deliveryUpdates),
      payments: readSmsBoolean(smsCategories.payments ?? notifications.paymentReminders),
      accountUpdates: readSmsBoolean(smsCategories.accountUpdates),
      other: readSmsBoolean(smsCategories.other),
    },
    notifications: { weeklySummaries: readSmsBoolean(notifications.weeklySummaries) },
  };
};

// Refresh untouched values without losing edits when unrelated profile metadata changes.
const reconcilePreferences = (
  current: NotificationPreferencesForm,
  previous: NotificationPreferencesForm,
  incoming: NotificationPreferencesForm,
): NotificationPreferencesForm => ({
  notificationEmail: current.notificationEmail === previous.notificationEmail ? incoming.notificationEmail : current.notificationEmail,
  notificationSMS: current.notificationSMS === previous.notificationSMS ? incoming.notificationSMS : current.notificationSMS,
  smsCategories: Object.fromEntries(SMS_CATEGORIES.map(({ key }) => [
    key,
    current.smsCategories[key] === previous.smsCategories[key] ? incoming.smsCategories[key] : current.smsCategories[key],
  ])) as Record<SmsCategory, boolean>,
  notifications: {
    weeklySummaries: current.notifications.weeklySummaries === previous.notifications.weeklySummaries
      ? incoming.notifications.weeklySummaries : current.notifications.weeklySummaries,
  },
});

export function NotificationPreferencesCard() {
  const { user } = useAuth();
  return <NotificationPreferencesForm key={user?.id} user={user} />;
}

function NotificationPreferencesForm({ user }: { user: UserData | null }) {
  const { saveProfile } = useSelfProfileSave();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState(() => {
    const stored = readNotificationPreferences(user?.metadata);
    return { stored, values: stored };
  });
  const preferences = form.values;
  const showSmsPreferences = ['client', 'salesRep', 'admin', 'superadmin', 'editing_manager'].includes(user?.role ?? '');
  const showWeeklySummaries = ['salesRep', 'admin', 'superadmin', 'editing_manager'].includes(user?.role ?? '');

  useEffect(() => {
    const stored = readNotificationPreferences(user?.metadata);
    setForm((current) => ({
      stored,
      values: reconcilePreferences(current.values, current.stored, stored),
    }));
  }, [user?.metadata]);

  const changePreferences = (update: (current: NotificationPreferencesForm) => NotificationPreferencesForm) => {
    setForm((current) => ({ ...current, values: update(current.values) }));
    setSaveError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const result = await saveProfile({
        preferences: {
          notificationEmail: preferences.notificationEmail,
          ...(showSmsPreferences ? { notificationSMS: preferences.notificationSMS, smsCategories: preferences.smsCategories } : {}),
          ...(showWeeklySummaries ? { notifications: preferences.notifications } : {}),
        },
      });
      if (!result.reauthRequired) {
        const stored = result.user?.metadata ? readNotificationPreferences(result.user.metadata) : preferences;
        setForm({ stored, values: stored });
        toast({
          title: 'Preferences updated',
          description: 'Your notification preferences have been saved.',
        });
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Please try again.';
      setSaveError(description);
      toast({ title: 'Unable to save preferences', description, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Choose the notifications you receive on your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {showSmsPreferences && (
            <section aria-labelledby="text-notifications-heading" className="space-y-4">
              <div>
                <h3 id="text-notifications-heading" className="font-semibold">Text messages</h3>
                <p className="text-sm text-muted-foreground">Control texts sent to your account phone number. These choices do not change your email or in-app notifications.</p>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
                <div className="space-y-1">
                  <Label htmlFor="settings-notification-sms">Allow text messages</Label>
                  <p id="settings-notification-sms-description" className="text-sm text-muted-foreground">Turn off to stop all dashboard text messages. Your choices below are kept for when you turn texts back on.</p>
                </div>
                <Switch
                  id="settings-notification-sms"
                  aria-describedby="settings-notification-sms-description"
                  checked={preferences.notificationSMS}
                  onCheckedChange={(checked) => changePreferences((current) => ({ ...current, notificationSMS: checked }))}
                  disabled={isSaving}
                  className="shrink-0"
                />
              </div>
              {!preferences.notificationSMS && <p role="status" className="text-sm text-muted-foreground">All text messages are turned off.</p>}
              <fieldset disabled={isSaving || !preferences.notificationSMS} className="space-y-3">
                <legend className="mb-3 text-sm font-medium">Text message types</legend>
                {SMS_CATEGORIES.map(({ key, label, description }) => (
                  <div key={key} className={`flex items-center justify-between gap-4 rounded-lg border p-4 ${preferences.notificationSMS ? '' : 'opacity-60'}`}>
                    <div className="space-y-1">
                      <Label htmlFor={`settings-sms-${key}`}>{label}</Label>
                      <p id={`settings-sms-${key}-description`} className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      id={`settings-sms-${key}`}
                      aria-describedby={`settings-sms-${key}-description`}
                      checked={preferences.smsCategories[key]}
                      onCheckedChange={(checked) => changePreferences((current) => ({
                        ...current, smsCategories: { ...current.smsCategories, [key]: checked },
                      }))}
                      disabled={isSaving || !preferences.notificationSMS}
                      className="shrink-0"
                    />
                  </div>
                ))}
                {showWeeklySummaries && (
                  <div className={`flex items-center justify-between gap-4 rounded-lg border p-4 ${preferences.notificationSMS ? '' : 'opacity-60'}`}>
                    <div className="space-y-1">
                      <Label htmlFor="settings-weekly-summaries">Weekly sales summaries</Label>
                      <p id="settings-weekly-summaries-description" className="text-sm text-muted-foreground">Text updates from weekly sales reports. These also follow your Other text messages choice.</p>
                    </div>
                    <Switch
                      id="settings-weekly-summaries"
                      aria-describedby="settings-weekly-summaries-description"
                      checked={preferences.notifications.weeklySummaries}
                      onCheckedChange={(checked) => changePreferences((current) => ({ ...current, notifications: { weeklySummaries: checked } }))}
                      disabled={isSaving || !preferences.notificationSMS}
                      className="shrink-0"
                    />
                  </div>
                )}
              </fieldset>
            </section>
          )}
          <section aria-labelledby="email-notifications-heading" className="space-y-3">
            <h3 id="email-notifications-heading" className="font-semibold">Email notifications</h3>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="settings-notification-email">Email Notifications</Label>
                <p id="settings-notification-email-description" className="text-sm text-muted-foreground">Email me when I receive a new internal dashboard message.</p>
              </div>
              <Switch
                id="settings-notification-email"
                aria-describedby="settings-notification-email-description"
                checked={preferences.notificationEmail}
                onCheckedChange={(checked) => changePreferences((current) => ({ ...current, notificationEmail: checked }))}
                disabled={isSaving}
                className="shrink-0"
              />
            </div>
          </section>
          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-4">
          <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Preferences'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
