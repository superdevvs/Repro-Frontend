import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useSelfProfileSave } from '@/hooks/useSelfProfileSave';
import { useToast } from '@/hooks/use-toast';

type NotificationPreferencesForm = {
  notificationEmail: boolean;
};

const readNotificationPreferences = (metadata: unknown): NotificationPreferencesForm => {
  const metadataRecord = metadata && typeof metadata === 'object'
    ? metadata as Record<string, unknown>
    : {};
  const preferences = metadataRecord.preferences && typeof metadataRecord.preferences === 'object'
    ? metadataRecord.preferences as Record<string, unknown>
    : {};

  return {
    notificationEmail: typeof preferences.notificationEmail === 'boolean'
      ? preferences.notificationEmail
      : true,
  };
};

export function NotificationPreferencesCard() {
  const { user } = useAuth();
  const { saveProfile } = useSelfProfileSave();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferencesForm>(
    () => readNotificationPreferences(user?.metadata),
  );

  useEffect(() => {
    setPreferences(readNotificationPreferences(user?.metadata));
  }, [user?.metadata]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const result = await saveProfile({ preferences });
      if (!result.reauthRequired) {
        toast({
          title: 'Preferences updated',
          description: result.message || 'Your notification preferences have been saved.',
        });
      }
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast({
        title: 'Unable to save preferences',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Manage how we contact you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 border-b pb-4">
              <div>
                <label htmlFor="settings-notification-email" className="font-medium">Email Notifications</label>
                <p className="text-sm text-muted-foreground">Email me when I receive a new internal dashboard message</p>
              </div>
              <Switch
                id="settings-notification-email"
                checked={preferences.notificationEmail}
                onCheckedChange={(checked) => setPreferences((current) => ({
                  ...current,
                  notificationEmail: checked,
                }))}
                disabled={isSaving}
              />
            </div>

          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-4">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
