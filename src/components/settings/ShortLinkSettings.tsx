import { useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';

export type ShortLinkType =
  | 'iguide_offline_viewer'
  | 'share_download'
  | 'media_zip'
  | 'payment';

export type ShortLinkSettingsData = {
  enabled: boolean;
  code_length: number;
  types: Record<ShortLinkType, boolean>;
};

const TYPE_ROWS: Array<{ id: ShortLinkType; label: string; description: string }> = [
  {
    id: 'iguide_offline_viewer',
    label: 'Offline iGUIDE viewer',
    description: 'Replace the long signed ZIP path with a stable /api/g/… alias.',
  },
  {
    id: 'share_download',
    label: 'Editor share links',
    description: 'Copy a short link that redirects to the existing /share/ page.',
  },
  {
    id: 'media_zip',
    label: 'Email zip downloads',
    description: 'Shorten the signed small/full zip URLs used in email templates.',
  },
  {
    id: 'payment',
    label: 'Payment links',
    description: 'Shorten public checkout links. Leave off unless you want a shorter pay URL.',
  },
];

const emptySettings = (): ShortLinkSettingsData => ({
  enabled: true,
  code_length: 10,
  types: {
    iguide_offline_viewer: true,
    share_download: false,
    media_zip: false,
    payment: false,
  },
});

const asSettings = (value: unknown): ShortLinkSettingsData => {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : root;
  const types = data.types && typeof data.types === 'object' ? data.types as Record<string, unknown> : {};
  const fallback = emptySettings();

  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : fallback.enabled,
    code_length: typeof data.code_length === 'number' ? data.code_length : fallback.code_length,
    types: {
      iguide_offline_viewer: Boolean(types.iguide_offline_viewer),
      share_download: Boolean(types.share_download),
      media_zip: Boolean(types.media_zip),
      payment: Boolean(types.payment),
    },
  };
};

export function ShortLinkSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ShortLinkSettingsData | null>(null);
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.get('/admin/short-links/settings')
      .then((response) => {
        if (!cancelled) setSettings(asSettings(response.data));
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load short-link settings.');
          setSettings(emptySettings());
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (next: ShortLinkSettingsData, key: string) => {
    const previous = settings;
    setSettings(next);
    setError('');
    setSavingKey(key);
    try {
      const response = await apiClient.put('/admin/short-links/settings', next);
      setSettings(asSettings(response.data));
      toast({
        title: 'Link shortening updated',
        description: 'New links will use these settings. Existing short codes keep working.',
      });
    } catch (saveError) {
      setSettings(previous);
      setError(saveError instanceof Error ? saveError.message : 'Could not save short-link settings.');
    } finally {
      setSavingKey(null);
    }
  };

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-5 w-5 text-primary" />
            Link shortening
          </CardTitle>
          <CardDescription>Loading short-link settings…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-5 w-5 text-primary" />
          Link shortening
        </CardTitle>
        <CardDescription>
          First-party short links on reprodashboard.com. The offline iGUIDE alias stays
          path-preserving so relative tour assets keep working.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : null}
        <div className="flex items-center justify-between gap-4 rounded-md border p-4">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="short-links-enabled">Shorten public links</Label>
            <p className="text-sm text-muted-foreground">
              Master switch for every short-link type below.
            </p>
          </div>
          <Switch
            id="short-links-enabled"
            checked={settings.enabled}
            disabled={savingKey !== null}
            onCheckedChange={(checked) => void persist({ ...settings, enabled: checked }, 'enabled')}
          />
        </div>
        {TYPE_ROWS.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-4 rounded-md border p-4">
            <div className="min-w-0 space-y-0.5">
              <Label htmlFor={`short-links-${row.id}`}>{row.label}</Label>
              <p className="text-sm text-muted-foreground">{row.description}</p>
            </div>
            <Switch
              id={`short-links-${row.id}`}
              checked={settings.enabled && settings.types[row.id]}
              disabled={!settings.enabled || savingKey !== null}
              onCheckedChange={(checked) => void persist({
                ...settings,
                types: { ...settings.types, [row.id]: checked },
              }, row.id)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
