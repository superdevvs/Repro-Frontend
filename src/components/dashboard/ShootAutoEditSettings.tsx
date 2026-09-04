import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

import { API_BASE_URL } from '@/config/env';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast as sonnerToast } from '@/lib/sonner-toast';
import type { ShootData } from '@/types/shoots';

type AutoEditPreferences = {
  editing_type?: string;
  style?: string;
};

type AutoEditShoot = Pick<ShootData, 'id'> & {
  auto_edit_enabled?: boolean;
  auto_edit_preferences?: AutoEditPreferences;
};

type AutoEditUpdate = {
  auto_edit_enabled?: boolean;
  auto_edit_preferences?: AutoEditPreferences;
};

interface ShootAutoEditSettingsProps {
  shoot: AutoEditShoot;
  onUpdate?: (updated: AutoEditUpdate) => void;
}

const patchAutoEditSettings = async (shootId: ShootData['id'], body: Record<string, unknown>) => {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('authToken') || localStorage.getItem('token')
    : null;

  const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`Server ${response.status}`);
};

export function ShootAutoEditSettings({ shoot, onUpdate }: ShootAutoEditSettingsProps) {
  const [autoEditEnabled, setAutoEditEnabled] = useState(() => Boolean(shoot.auto_edit_enabled));
  const [autoEditStyle, setAutoEditStyle] = useState(() => shoot.auto_edit_preferences?.style || 'signature');
  const [autoEditType, setAutoEditType] = useState(() => shoot.auto_edit_preferences?.editing_type || 'enhance');

  useEffect(() => {
    setAutoEditEnabled(Boolean(shoot.auto_edit_enabled));
    setAutoEditStyle(shoot.auto_edit_preferences?.style || 'signature');
    setAutoEditType(shoot.auto_edit_preferences?.editing_type || 'enhance');
  }, [shoot]);

  const handleEnabledChange = async (checked: boolean) => {
    setAutoEditEnabled(checked);
    try {
      await patchAutoEditSettings(shoot.id, {
        auto_edit_enabled: checked,
        auto_edit_preferences: checked ? {
          editing_type: autoEditType,
          style: autoEditStyle,
          auto_perspective: true,
          sky_replacement: true,
        } : null,
      });
      onUpdate?.({ auto_edit_enabled: checked });
      sonnerToast.success(checked ? 'Auto-edit enabled' : 'Auto-edit disabled');
    } catch (error) {
      console.error('Auto-edit toggle failed', error);
      sonnerToast.error('Failed to update auto-edit setting');
      setAutoEditEnabled(!checked);
    }
  };

  const handleTypeChange = async (value: string) => {
    setAutoEditType(value);
    try {
      await patchAutoEditSettings(shoot.id, {
        auto_edit_preferences: {
          editing_type: value,
          style: autoEditStyle,
          auto_perspective: true,
          sky_replacement: true,
        },
      });
      onUpdate?.({ auto_edit_preferences: { editing_type: value, style: autoEditStyle } });
    } catch (error) {
      console.error('Failed to update auto-edit type', error);
      sonnerToast.error('Failed to update editing type');
    }
  };

  const handleStyleChange = async (value: string) => {
    setAutoEditStyle(value);
    try {
      await patchAutoEditSettings(shoot.id, {
        auto_edit_preferences: {
          editing_type: autoEditType,
          style: value,
          auto_perspective: true,
          sky_replacement: true,
        },
      });
      onUpdate?.({ auto_edit_preferences: { editing_type: autoEditType, style: value } });
    } catch (error) {
      console.error('Failed to update auto-edit style', error);
      sonnerToast.error('Failed to update enhancement style');
    }
  };

  return (
    <div className="border rounded-lg p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Auto-Edit
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Automatically edit photos when uploaded using preset preferences
          </div>
        </div>
        <Switch
          checked={autoEditEnabled}
          onCheckedChange={handleEnabledChange}
          className="flex-shrink-0"
        />
      </div>

      {autoEditEnabled && (
        <div className="space-y-3 pt-3 border-t">
          <div className="space-y-2">
            <Label className="text-xs">Editing Type</Label>
            <Select value={autoEditType} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enhance">Enhance</SelectItem>
                <SelectItem value="sky_replace">Sky Replace</SelectItem>
                <SelectItem value="remove_object">Remove Object</SelectItem>
                <SelectItem value="color_correct">Color Correct</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Enhancement Style</Label>
            <Select value={autoEditStyle} onValueChange={handleStyleChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="signature">Signature</SelectItem>
                <SelectItem value="natural">Natural</SelectItem>
                <SelectItem value="twilight">Twilight</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
