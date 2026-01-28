import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Image as ImageIcon, Type, Layers, RefreshCw, Check } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const DEFAULT_LOGO_URL = `${API_BASE_URL.replace(/\/$/, '')}/images/REPRO-HQ.png`;

// Demo image for preview (a sample real estate photo placeholder)
const DEMO_IMAGE_URL = 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop';

interface WatermarkSettings {
  id: number;
  logo_enabled: boolean;
  logo_position: string;
  logo_opacity: number;
  logo_size: number;
  logo_offset_x: number;
  logo_offset_y: number;
  custom_logo_url: string | null;
  text_enabled: boolean;
  text_content: string | null;
  text_style: string;
  text_opacity: number;
  text_color: string;
  text_size: number;
  text_spacing: number;
  text_angle: number;
  overlay_enabled: boolean;
  overlay_color: string;
}

const positionPresets = [
  { value: 'top-left', label: 'Top Left', icon: '↖' },
  { value: 'top-right', label: 'Top Right', icon: '↗' },
  { value: 'bottom-left', label: 'Bottom Left', icon: '↙' },
  { value: 'bottom-right', label: 'Bottom Right', icon: '↘' },
  { value: 'center', label: 'Center', icon: '⊙' },
];

const textStyles = [
  { value: 'diagonal', label: 'Diagonal', description: 'Single diagonal text across the image' },
  { value: 'repeated', label: 'Repeated Pattern', description: 'Traditional repeated watermark pattern' },
  { value: 'corner', label: 'Corner Text', description: 'Text in corner with logo' },
  { value: 'banner', label: 'Banner Style', description: 'Horizontal banner across image' },
];

export default function WatermarkEditor() {
  const [settings, setSettings] = useState<WatermarkSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateProgress, setRegenerateProgress] = useState(0);
  const [regenerateStatus, setRegenerateStatus] = useState<string>('');
  const [regenerateOnSave, setRegenerateOnSave] = useState(true);
  const [regenerationId, setRegenerationId] = useState<string | null>(null);
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    setLogoPreviewError(false);
  }, [settings?.custom_logo_url]);

  const normalizeSettings = (data: WatermarkSettings): WatermarkSettings => ({
    ...data,
    text_angle: data.text_angle ?? -30,
  });

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/watermark-settings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(normalizeSettings(data));
      }
    } catch (error) {
      console.error('Failed to fetch watermark settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load watermark settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const logoPreviewUrl = settings?.custom_logo_url || DEFAULT_LOGO_URL;
  const isDefaultLogo = !settings?.custom_logo_url;

  const saveSettings = async () => {
    if (!settings) return;
    
    setSaving(true);
    if (regenerateOnSave) {
      setRegenerating(true);
      setRegenerateProgress(0);
      setRegenerateStatus('Saving settings...');
    }
    
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/watermark-settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...settings,
          regenerate_watermarks: regenerateOnSave,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(normalizeSettings(data.settings));
        
        // If regeneration was triggered, start polling for progress
        if (data.regeneration_id && data.files_queued > 0) {
          setRegenerationId(data.regeneration_id);
          setRegenerateStatus(`Regenerating ${data.files_queued} watermarks...`);
          pollRegenerationProgress(data.regeneration_id);
        } else {
          setRegenerating(false);
          toast({
            title: 'Success',
            description: regenerateOnSave 
              ? 'Watermark settings saved. No files need regeneration.'
              : 'Watermark settings saved successfully',
          });
        }
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save watermark settings:', error);
      setRegenerating(false);
      toast({
        title: 'Error',
        description: 'Failed to save watermark settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };
  
  const pollRegenerationProgress = async (regId: string) => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    let attempts = 0;
    const maxAttempts = 600; // 10 minutes max (1 second intervals)
    
    const poll = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/admin/watermark-settings/regeneration-progress/${regId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        if (response.ok) {
          const progress = await response.json();
          setRegenerateProgress(progress.percentage || 0);
          setRegenerateStatus(
            `Processing: ${progress.processed || 0}/${progress.total || 0} files (${progress.percentage || 0}%)`
          );
          
          if (progress.status === 'completed') {
            setRegenerating(false);
            setRegenerationId(null);
            toast({
              title: 'Success',
              description: `Watermarks regenerated: ${progress.processed} files processed${progress.failed > 0 ? `, ${progress.failed} failed` : ''}`,
            });
            return;
          }
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          setRegenerating(false);
          setRegenerationId(null);
          toast({
            title: 'Info',
            description: 'Watermark regeneration is still processing in the background',
          });
        }
      } catch (error) {
        console.error('Failed to poll progress:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        }
      }
    };
    
    poll();
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const formData = new FormData();
      formData.append('logo', file);

      const response = await fetch(`${API_BASE_URL}/api/admin/watermark-settings/upload-logo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(normalizeSettings(data.settings));
        setRegenerateOnSave(true);
        toast({
          title: 'Success',
          description: 'Logo uploaded. Click “Save Changes” to apply to existing unpaid photos.',
        });
      } else {
        throw new Error('Failed to upload logo');
      }
    } catch (error) {
      console.error('Failed to upload logo:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload logo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const updateSetting = <K extends keyof WatermarkSettings>(key: K, value: WatermarkSettings[K]) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  const regenerateWatermarks = async () => {
    setRegenerating(true);
    setRegenerateProgress(0);
    setRegenerateStatus('Starting watermark regeneration...');
    
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/watermark-settings/regenerate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.regeneration_id && data.files_queued > 0) {
          setRegenerationId(data.regeneration_id);
          setRegenerateStatus(`Regenerating ${data.files_queued} watermarks...`);
          pollRegenerationProgress(data.regeneration_id);
        } else {
          setRegenerating(false);
          toast({
            title: 'Info',
            description: 'No files need watermark regeneration',
          });
        }
      } else {
        throw new Error('Failed to regenerate watermarks');
      }
    } catch (error) {
      console.error('Failed to regenerate watermarks:', error);
      setRegenerating(false);
      toast({
        title: 'Error',
        description: 'Failed to regenerate watermarks',
        variant: 'destructive',
      });
    }
  };

  // Calculate logo position for preview
  const getLogoPreviewStyle = useMemo(() => {
    if (!settings) return {};
    
    const position: React.CSSProperties = {
      position: 'absolute',
      width: `${settings.logo_size}%`,
      maxWidth: '120px',
      opacity: settings.logo_opacity / 100,
    };

    const offsetX = `${settings.logo_offset_x}%`;
    const offsetY = `${settings.logo_offset_y}%`;

    switch (settings.logo_position) {
      case 'top-left':
        position.top = offsetY;
        position.left = offsetX;
        break;
      case 'top-right':
        position.top = offsetY;
        position.right = offsetX;
        break;
      case 'bottom-left':
        position.bottom = offsetY;
        position.left = offsetX;
        break;
      case 'bottom-right':
        position.bottom = offsetY;
        position.right = offsetX;
        break;
      case 'center':
        position.top = '50%';
        position.left = '50%';
        position.transform = 'translate(-50%, -50%)';
        break;
    }

    return position;
  }, [settings?.logo_position, settings?.logo_opacity, settings?.logo_size, settings?.logo_offset_x, settings?.logo_offset_y]);

  // Get text preview style
  const getTextPreviewStyle = useMemo((): React.CSSProperties => {
    if (!settings) return {};
    
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      color: settings.text_color,
      opacity: settings.text_opacity / 100,
      fontSize: `${Math.max(8, settings.text_size)}px`,
      fontWeight: 'bold',
      whiteSpace: 'nowrap',
      textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
    };

    switch (settings.text_style) {
      case 'diagonal':
        return { ...baseStyle, top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)' };
      case 'banner':
        return { ...baseStyle, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      case 'corner':
        return { ...baseStyle, bottom: '8%', left: '3%' };
      case 'repeated':
        return { ...baseStyle, top: '50%', left: '50%', transform: `translate(-50%, -50%) rotate(${settings.text_angle ?? -30}deg)` };
      default:
        return baseStyle;
    }
  }, [settings?.text_style, settings?.text_color, settings?.text_opacity, settings?.text_size, settings?.text_angle]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Failed to load watermark settings
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Watermark Settings</h2>
          <p className="text-muted-foreground">
            Configure how watermarks appear on unpaid client photos
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={regenerateOnSave}
              onChange={(e) => setRegenerateOnSave(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
              disabled={saving || regenerating}
            />
            <span className="leading-tight">
              Apply to existing photos
              <span className="block text-xs text-muted-foreground">
                Regenerates watermarks for unpaid shoots after save.
              </span>
            </span>
          </label>
          <Button onClick={saveSettings} disabled={saving || regenerating} className="min-w-[140px]">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
      

      {/* Two-column layout: Settings on left, Preview on right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Settings */}
        <div className="space-y-6">
          <Tabs defaultValue="logo" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="logo" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Logo
          </TabsTrigger>
          <TabsTrigger value="text" className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Text
          </TabsTrigger>
          <TabsTrigger value="overlay" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Overlay
          </TabsTrigger>
        </TabsList>

        {/* Logo Settings */}
        <TabsContent value="logo" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Logo Watermark</CardTitle>
                  <CardDescription>Add your company logo to watermarked images</CardDescription>
                </div>
                <Switch
                  checked={settings.logo_enabled}
                  onCheckedChange={(checked) => updateSetting('logo_enabled', checked)}
                />
              </div>
            </CardHeader>
            {settings.logo_enabled && (
              <CardContent className="space-y-6">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>Custom Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center gap-1">
                      {!logoPreviewError ? (
                        <img
                          src={logoPreviewUrl}
                          alt="Current logo"
                          className="h-16 w-auto border rounded"
                          onError={() => setLogoPreviewError(true)}
                        />
                      ) : (
                        <div className="h-16 w-28 border rounded bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                          LOGO
                        </div>
                      )}
                      {isDefaultLogo && (
                        <span className="text-[10px] text-muted-foreground">Default REPRO-HQ logo</span>
                      )}
                    </div>
                    <div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadLogo(file);
                        }}
                        disabled={uploading}
                        className="max-w-xs"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG up to 5MB. Transparent PNG recommended.
                        <br />
                        Save changes to apply updates to unpaid client photos.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Position Presets */}
                <div className="space-y-2">
                  <Label>Position</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {positionPresets.map((preset) => (
                      <Button
                        key={preset.value}
                        variant={settings.logo_position === preset.value ? 'default' : 'outline'}
                        className="flex flex-col h-auto py-3"
                        onClick={() => updateSetting('logo_position', preset.value)}
                      >
                        <span className="text-lg">{preset.icon}</span>
                        <span className="text-xs mt-1">{preset.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Opacity Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Opacity</Label>
                    <span className="text-sm text-muted-foreground">{settings.logo_opacity}%</span>
                  </div>
                  <Slider
                    value={[settings.logo_opacity]}
                    onValueChange={(value) => updateSetting('logo_opacity', value[0])}
                    min={10}
                    max={100}
                    step={5}
                  />
                </div>

                {/* Size Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Size (% of image width)</Label>
                    <span className="text-sm text-muted-foreground">{settings.logo_size}%</span>
                  </div>
                  <Slider
                    value={[settings.logo_size]}
                    onValueChange={(value) => updateSetting('logo_size', value[0])}
                    min={5}
                    max={50}
                    step={1}
                  />
                </div>

                {/* Offset Controls */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Horizontal Offset</Label>
                      <span className="text-sm text-muted-foreground">{settings.logo_offset_x}%</span>
                    </div>
                    <Slider
                      value={[settings.logo_offset_x]}
                      onValueChange={(value) => updateSetting('logo_offset_x', value[0])}
                      min={0}
                      max={30}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Vertical Offset</Label>
                      <span className="text-sm text-muted-foreground">{settings.logo_offset_y}%</span>
                    </div>
                    <Slider
                      value={[settings.logo_offset_y]}
                      onValueChange={(value) => updateSetting('logo_offset_y', value[0])}
                      min={0}
                      max={30}
                      step={1}
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* Text Settings */}
        <TabsContent value="text" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Text Watermark</CardTitle>
                  <CardDescription>Add text watermark to images</CardDescription>
                </div>
                <Switch
                  checked={settings.text_enabled}
                  onCheckedChange={(checked) => updateSetting('text_enabled', checked)}
                />
              </div>
            </CardHeader>
            {settings.text_enabled && (
              <CardContent className="space-y-6">
                {/* Text Content */}
                <div className="space-y-2">
                  <Label>Watermark Text</Label>
                  <Input
                    value={settings.text_content || ''}
                    onChange={(e) => updateSetting('text_content', e.target.value)}
                    placeholder="e.g., © REPRO HQ - SAMPLE"
                  />
                </div>

                {/* Text Style */}
                <div className="space-y-2">
                  <Label>Style</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {textStyles.map((style) => (
                      <div
                        key={style.value}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          settings.text_style === style.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => updateSetting('text_style', style.value)}
                      >
                        <p className="font-medium">{style.label}</p>
                        <p className="text-xs text-muted-foreground">{style.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Text Color */}
                <div className="space-y-2">
                  <Label>Text Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={settings.text_color}
                      onChange={(e) => updateSetting('text_color', e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={settings.text_color}
                      onChange={(e) => updateSetting('text_color', e.target.value)}
                      className="max-w-32"
                    />
                  </div>
                </div>

                {/* Text Opacity */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Opacity</Label>
                    <span className="text-sm text-muted-foreground">{settings.text_opacity}%</span>
                  </div>
                  <Slider
                    value={[settings.text_opacity]}
                    onValueChange={(value) => updateSetting('text_opacity', value[0])}
                    min={10}
                    max={100}
                    step={5}
                  />
                </div>

                {/* Text Size */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Size (% of image width)</Label>
                    <span className="text-sm text-muted-foreground">{settings.text_size}%</span>
                  </div>
                  <Slider
                    value={[settings.text_size]}
                    onValueChange={(value) => updateSetting('text_size', value[0])}
                    min={5}
                    max={25}
                    step={1}
                  />
                </div>

                {/* Rotation (for repeated style) */}
                {settings.text_style === 'repeated' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Rotation</Label>
                      <span className="text-sm text-muted-foreground">{settings.text_angle}°</span>
                    </div>
                    <Slider
                      value={[settings.text_angle ?? -30]}
                      onValueChange={(value) => updateSetting('text_angle', value[0])}
                      min={-90}
                      max={90}
                      step={5}
                    />
                  </div>
                )}

                {/* Spacing (for repeated style) */}
                {settings.text_style === 'repeated' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Pattern Spacing (px)</Label>
                      <span className="text-sm text-muted-foreground">{settings.text_spacing}px</span>
                    </div>
                    <Slider
                      value={[settings.text_spacing]}
                      onValueChange={(value) => updateSetting('text_spacing', value[0])}
                      min={100}
                      max={400}
                      step={25}
                    />
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* Overlay Settings */}
        <TabsContent value="overlay" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Image Overlay</CardTitle>
                  <CardDescription>Add a semi-transparent overlay to the entire image</CardDescription>
                </div>
                <Switch
                  checked={settings.overlay_enabled}
                  onCheckedChange={(checked) => updateSetting('overlay_enabled', checked)}
                />
              </div>
            </CardHeader>
            {settings.overlay_enabled && (
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Overlay Color</Label>
                  <Input
                    value={settings.overlay_color}
                    onChange={(e) => updateSetting('overlay_color', e.target.value)}
                    placeholder="rgba(0, 0, 0, 0.1)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use RGBA format, e.g., rgba(0, 0, 0, 0.1) for 10% black overlay
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>
      </Tabs>
        </div>

        {/* Right Column - Live Preview */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Live Preview</CardTitle>
              <CardDescription className="text-xs">
                See how your watermark will appear on photos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Preview Container */}
              <div 
                className="relative w-full aspect-[3/2] rounded-lg overflow-hidden border bg-muted"
                style={{ minHeight: '200px' }}
              >
                {/* Demo Image */}
                <img
                  src={DEMO_IMAGE_URL}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to gradient if image fails to load
                    e.currentTarget.style.display = 'none';
                  }}
                />
                
                {/* Fallback gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-400 dark:from-slate-700 dark:to-slate-900 -z-10" />

                {/* Overlay Preview */}
                {settings.overlay_enabled && (
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{ backgroundColor: settings.overlay_color }}
                  />
                )}

                {/* Logo Preview */}
                {settings.logo_enabled && (
                  <div style={getLogoPreviewStyle} className="pointer-events-none">
                    {!logoPreviewError ? (
                      <img
                        src={logoPreviewUrl}
                        alt="Watermark logo"
                        className="w-full h-auto"
                        onError={() => setLogoPreviewError(true)}
                      />
                    ) : (
                      <div className="bg-white/80 dark:bg-black/80 rounded px-2 py-1 text-xs font-bold text-gray-800 dark:text-gray-200 border">
                        LOGO
                      </div>
                    )}
                  </div>
                )}

                {/* Text Preview */}
                {settings.text_enabled && settings.text_content && (
                  settings.text_style === 'repeated' ? (
                    // Repeated pattern preview - show multiple instances
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      {[...Array(5)].map((_, rowIndex) => (
                        <div 
                          key={rowIndex} 
                          className="flex gap-8 whitespace-nowrap"
                          style={{
                            transform: `rotate(${settings.text_angle ?? -30}deg) translateX(${rowIndex % 2 === 0 ? '0' : '40px'})`,
                            marginTop: `${rowIndex * 40}px`,
                            marginLeft: '-50px',
                          }}
                        >
                          {[...Array(6)].map((_, colIndex) => (
                            <span
                              key={colIndex}
                              style={{
                                color: settings.text_color,
                                opacity: settings.text_opacity / 100,
                                fontSize: `${Math.max(8, settings.text_size)}px`,
                                fontWeight: 'bold',
                                textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                              }}
                            >
                              {settings.text_content}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={getTextPreviewStyle} className="pointer-events-none">
                      {settings.text_content}
                    </div>
                  )
                )}
              </div>

              {/* Preview Legend */}
              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  {settings.logo_enabled && (
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-500" />
                      Logo: {settings.logo_position} @ {settings.logo_opacity}%
                    </span>
                  )}
                </div>
                {settings.text_enabled && (
                  <div className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-green-500" />
                    Text: {settings.text_style} style @ {settings.text_opacity}%
                  </div>
                )}
                {settings.overlay_enabled && (
                  <div className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-green-500" />
                    Overlay enabled
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Regenerate Watermarks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Apply Changes to Existing Photos
          </CardTitle>
          <CardDescription>
            After saving settings, click below to regenerate watermarks on all existing unpaid photos.
            New uploads will automatically use these settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {regenerating ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>{regenerateStatus}</span>
                <span className="text-muted-foreground">{regenerateProgress}%</span>
              </div>
              <Progress value={regenerateProgress} className="h-2" />
            </div>
          ) : (
            <Button 
              onClick={regenerateWatermarks}
              variant="outline"
              className="w-full sm:w-auto"
              disabled={saving || regenerating}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate All Watermarks
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            This will queue watermark regeneration for all existing photos. The process runs in the background.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
