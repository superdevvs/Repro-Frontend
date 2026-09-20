import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/components/auth/AuthProvider';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useSelfProfileSave } from '@/hooks/useSelfProfileSave';
import { useToast } from '@/hooks/use-toast';

const readShowEditingNotes = (metadata: unknown): boolean => {
  const metadataRecord = metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : {};
  const preferences = metadataRecord.preferences && typeof metadataRecord.preferences === 'object'
    ? metadataRecord.preferences as Record<string, unknown>
    : {};
  return typeof preferences.showEditingNotes === 'boolean' ? preferences.showEditingNotes : true;
};

export function EditorPreferencesCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { saveProfile } = useSelfProfileSave();
  const { preferences: displayPreferences, setTemperatureUnit, setTimeFormat } = useUserPreferences();
  const [showEditingNotes, setShowEditingNotes] = useState(() => readShowEditingNotes(user?.metadata));

  useEffect(() => {
    setShowEditingNotes(readShowEditingNotes(user?.metadata));
  }, [user?.metadata]);

  const persistEditingNotes = async (checked: boolean) => {
    const metadata = (user?.metadata ?? {}) as Record<string, unknown>;
    const savedPreferences = metadata.preferences && typeof metadata.preferences === 'object'
      ? metadata.preferences as Record<string, unknown>
      : {};
    setShowEditingNotes(checked);
    try {
      const result = await saveProfile({
        preferences: {
          ...savedPreferences,
          showEditingNotes: checked,
        },
      });
      if (!result.reauthRequired) {
        toast({
          title: 'Preferences updated',
          description: result.message || 'Editor preferences have been saved.',
        });
      }
    } catch (error) {
      setShowEditingNotes(!checked);
      toast({
        title: 'Unable to save preferences',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Editor preferences</CardTitle>
        <CardDescription>How editing notes and display units work on your dashboard.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4 rounded-md border p-4">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="showEditingNotes">Auto display editing notes</Label>
            <p className="text-sm text-muted-foreground">Show editing notes when opening a shoot</p>
          </div>
          <Switch
            id="showEditingNotes"
            checked={showEditingNotes}
            onCheckedChange={(checked) => void persistEditingNotes(checked)}
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-md border p-4">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="temperatureUnit">Temperature in Celsius</Label>
            <p className="text-sm text-muted-foreground">
              {displayPreferences.temperatureUnit === 'celsius' ? 'Celsius (°C)' : 'Fahrenheit (°F)'}
            </p>
          </div>
          <Switch
            id="temperatureUnit"
            checked={displayPreferences.temperatureUnit === 'celsius'}
            onCheckedChange={(checked) => setTemperatureUnit(checked ? 'celsius' : 'fahrenheit')}
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-md border p-4">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="timeFormat">24-hour time</Label>
            <p className="text-sm text-muted-foreground">
              {displayPreferences.timeFormat === '24h' ? '24-hour format (14:30)' : '12-hour format (2:30 PM)'}
            </p>
          </div>
          <Switch
            id="timeFormat"
            checked={displayPreferences.timeFormat === '24h'}
            onCheckedChange={(checked) => setTimeFormat(checked ? '24h' : '12h')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
