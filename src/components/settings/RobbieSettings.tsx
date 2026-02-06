import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import { Bot, Send, Settings2, Sparkles, Shield, Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';

interface RobbieConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  tools: {
    enabled: boolean;
    allow: string[];
    deny: string[];
  };
  features: {
    voice: { enabled: boolean };
    media_links: { enabled: boolean };
  };
  system_prompt: string | null;
}

interface RobbieSettingsData {
  defaults: RobbieConfig;
  global: Partial<RobbieConfig>;
  role_configs: Record<string, Partial<RobbieConfig>>;
  merged_configs: Record<string, RobbieConfig>;
  roles: string[];
}

const AVAILABLE_TOOLS = [
  'get_property',
  'get_listing',
  'update_listing_copy',
  'get_portfolio_overview',
  'book_shoot',
  'get_shoot',
  'list_shoots',
  'reschedule_shoot',
  'cancel_shoot',
  'update_shoot_status',
  'get_payment_status',
  'create_checkout_link',
  'get_dashboard_stats',
  'submit_ai_editing',
  'get_ai_editing_status',
  'get_editing_types',
];

const AVAILABLE_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Faster)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Budget)' },
];

export function RobbieSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsData, setSettingsData] = useState<RobbieSettingsData | null>(null);
  const [selectedScope, setSelectedScope] = useState<'global' | string>('global');
  const [editedConfig, setEditedConfig] = useState<Partial<RobbieConfig>>({});
  
  // Chat-based configuration
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/robbie-settings');
      if (response.data.success) {
        setSettingsData(response.data.data);
        // Initialize with global config
        setEditedConfig(response.data.data.global || {});
      }
    } catch (error: any) {
      toast({
        title: 'Failed to load settings',
        description: error?.response?.data?.message || 'Could not load Robbie settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScopeChange = (scope: string) => {
    setSelectedScope(scope);
    if (scope === 'global') {
      setEditedConfig(settingsData?.global || {});
    } else {
      setEditedConfig(settingsData?.role_configs[scope] || {});
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        scope: selectedScope === 'global' ? 'global' : 'role',
        role: selectedScope === 'global' ? null : selectedScope,
        config: editedConfig,
      };
      
      const response = await apiClient.post('/admin/robbie-settings', payload);
      if (response.data.success) {
        toast({
          title: 'Settings saved',
          description: `Robbie ${selectedScope === 'global' ? 'global' : selectedScope} settings updated successfully.`,
        });
        fetchSettings(); // Refresh
      }
    } catch (error: any) {
      toast({
        title: 'Failed to save',
        description: error?.response?.data?.message || 'Could not save Robbie settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    // Process the chat message to update config
    setTimeout(() => {
      const response = processConfigChat(userMessage);
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setChatLoading(false);
    }, 500);
  };

  const processConfigChat = (message: string): string => {
    const lowerMsg = message.toLowerCase();
    
    // Model changes
    if (lowerMsg.includes('use gpt-4o-mini') || lowerMsg.includes('faster model') || lowerMsg.includes('budget model')) {
      setEditedConfig(prev => ({ ...prev, model: 'gpt-4o-mini' }));
      return "I've switched Robbie to use GPT-4o Mini. This is faster and more cost-effective. Don't forget to save your changes!";
    }
    if (lowerMsg.includes('use gpt-4o') || lowerMsg.includes('best model') || lowerMsg.includes('smartest')) {
      setEditedConfig(prev => ({ ...prev, model: 'gpt-4o' }));
      return "I've switched Robbie to use GPT-4o, the most capable model. Don't forget to save!";
    }
    
    // Temperature changes
    if (lowerMsg.includes('more creative') || lowerMsg.includes('less predictable')) {
      setEditedConfig(prev => ({ ...prev, temperature: 0.9 }));
      return "I've increased the temperature to 0.9 for more creative responses. Save to apply!";
    }
    if (lowerMsg.includes('more precise') || lowerMsg.includes('more accurate') || lowerMsg.includes('less creative')) {
      setEditedConfig(prev => ({ ...prev, temperature: 0.3 }));
      return "I've lowered the temperature to 0.3 for more precise, consistent responses. Save to apply!";
    }
    
    // Tool access
    if (lowerMsg.includes('disable all tools') || lowerMsg.includes('no tools')) {
      setEditedConfig(prev => ({
        ...prev,
        tools: { enabled: false, allow: [], deny: [] }
      }));
      return "I've disabled all tool access for Robbie. It will only be able to chat without taking actions. Save to apply!";
    }
    if (lowerMsg.includes('enable all tools') || lowerMsg.includes('full access')) {
      setEditedConfig(prev => ({
        ...prev,
        tools: { enabled: true, allow: [], deny: [] }
      }));
      return "I've enabled full tool access for Robbie. It can now use all available actions. Save to apply!";
    }
    if (lowerMsg.includes('disable booking') || lowerMsg.includes('no booking')) {
      const currentDeny = editedConfig.tools?.deny || [];
      setEditedConfig(prev => ({
        ...prev,
        tools: { 
          enabled: true, 
          allow: [], 
          deny: [...new Set([...currentDeny, 'book_shoot', 'reschedule_shoot', 'cancel_shoot'])]
        }
      }));
      return "I've disabled booking-related tools (book, reschedule, cancel). Save to apply!";
    }
    if (lowerMsg.includes('disable payment') || lowerMsg.includes('no payment')) {
      const currentDeny = editedConfig.tools?.deny || [];
      setEditedConfig(prev => ({
        ...prev,
        tools: { 
          enabled: true, 
          allow: [], 
          deny: [...new Set([...currentDeny, 'get_payment_status', 'create_checkout_link'])]
        }
      }));
      return "I've disabled payment-related tools. Save to apply!";
    }
    
    // Voice/media features
    if (lowerMsg.includes('enable voice')) {
      setEditedConfig(prev => ({
        ...prev,
        features: { ...prev.features, voice: { enabled: true }, media_links: prev.features?.media_links || { enabled: false } }
      }));
      return "I've enabled voice features for Robbie. Save to apply!";
    }
    if (lowerMsg.includes('disable voice')) {
      setEditedConfig(prev => ({
        ...prev,
        features: { ...prev.features, voice: { enabled: false }, media_links: prev.features?.media_links || { enabled: false } }
      }));
      return "I've disabled voice features. Save to apply!";
    }
    
    // System prompt
    if (lowerMsg.includes('be more formal') || lowerMsg.includes('professional tone')) {
      setEditedConfig(prev => ({
        ...prev,
        system_prompt: 'Always respond in a formal, professional tone. Avoid casual language and emojis.'
      }));
      return "I've added instructions for Robbie to be more formal and professional. Save to apply!";
    }
    if (lowerMsg.includes('be friendly') || lowerMsg.includes('casual tone')) {
      setEditedConfig(prev => ({
        ...prev,
        system_prompt: 'Be friendly, warm, and conversational. Use emojis occasionally to add personality.'
      }));
      return "I've added instructions for Robbie to be more friendly and casual. Save to apply!";
    }
    if (lowerMsg.includes('clear instructions') || lowerMsg.includes('reset prompt')) {
      setEditedConfig(prev => ({ ...prev, system_prompt: null }));
      return "I've cleared the custom system prompt. Robbie will use default behavior. Save to apply!";
    }
    
    // Help
    if (lowerMsg.includes('help') || lowerMsg.includes('what can')) {
      return `You can configure Robbie by telling me things like:
      
**Model & Performance:**
• "Use GPT-4o-mini" or "Use the faster model"
• "Use GPT-4o" or "Use the best model"
• "Be more creative" or "Be more precise"

**Tool Access:**
• "Disable all tools" or "Enable all tools"
• "Disable booking tools" or "Disable payment tools"

**Features:**
• "Enable voice" or "Disable voice"

**Behavior:**
• "Be more formal" or "Be friendly"
• "Clear instructions" to reset

What would you like to configure?`;
    }
    
    return "I'm not sure how to apply that configuration. Try asking for 'help' to see what I can configure, or use the manual settings on the left.";
  };

  const getMergedConfig = (): RobbieConfig => {
    if (!settingsData) return settingsData?.defaults as RobbieConfig;
    const base = settingsData.defaults;
    const global = settingsData.global;
    const role = selectedScope !== 'global' ? settingsData.role_configs[selectedScope] : {};
    return { ...base, ...global, ...role, ...editedConfig } as RobbieConfig;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const mergedConfig = getMergedConfig();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Robbie AI Configuration
          </CardTitle>
          <CardDescription>
            Configure how Robbie responds and what actions it can perform for each role
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="chat" className="space-y-4">
            <TabsList>
              <TabsTrigger value="chat" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Chat Config
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Manual Config
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chat Interface */}
                <Card className="border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ReproAiIcon className="h-5 w-5" />
                      Configure via Chat
                    </CardTitle>
                    <CardDescription>
                      Tell Robbie how you want it to behave
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col h-[400px]">
                      <div className="flex-1 overflow-y-auto space-y-3 mb-4 p-3 bg-muted/30 rounded-lg">
                        {chatMessages.length === 0 && (
                          <div className="text-center text-muted-foreground text-sm py-8">
                            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Ask me to configure Robbie!</p>
                            <p className="text-xs mt-1">Try: "help" to see options</p>
                          </div>
                        )}
                        {chatMessages.map((msg, i) => (
                          <div
                            key={i}
                            className={cn(
                              "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
                              msg.role === 'user'
                                ? "ml-auto bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Thinking...
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                      <form onSubmit={handleChatSubmit} className="flex gap-2">
                        <Input
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="e.g., 'Use the faster model' or 'Disable booking tools'"
                          disabled={chatLoading}
                        />
                        <Button type="submit" size="icon" disabled={chatLoading || !chatInput.trim()}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </Card>

                {/* Current Config Preview */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Current Configuration
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Label className="text-sm">Scope:</Label>
                      <Select value={selectedScope} onValueChange={handleScopeChange}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="global">Global (All Roles)</SelectItem>
                          {settingsData?.roles.map(role => (
                            <SelectItem key={role} value={role}>
                              {role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Model</span>
                        <Badge variant="secondary">{mergedConfig?.model || 'gpt-4o'}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Temperature</span>
                        <Badge variant="secondary">{mergedConfig?.temperature ?? 0.7}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Max Tokens</span>
                        <Badge variant="secondary">{mergedConfig?.max_tokens || 2000}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Tools</span>
                        <Badge variant={mergedConfig?.tools?.enabled !== false ? 'default' : 'destructive'}>
                          {mergedConfig?.tools?.enabled !== false ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      {mergedConfig?.tools?.deny?.length > 0 && (
                        <div className="pt-2 border-t">
                          <span className="text-muted-foreground text-xs">Denied tools:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {mergedConfig.tools.deny.map(tool => (
                              <Badge key={tool} variant="outline" className="text-xs">
                                <X className="h-3 w-3 mr-1 text-red-500" />
                                {tool}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Voice</span>
                        <Badge variant={mergedConfig?.features?.voice?.enabled ? 'default' : 'secondary'}>
                          {mergedConfig?.features?.voice?.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      {mergedConfig?.system_prompt && (
                        <div className="pt-2 border-t">
                          <span className="text-muted-foreground text-xs">Custom Instructions:</span>
                          <p className="text-xs mt-1 p-2 bg-muted rounded">{mergedConfig.system_prompt}</p>
                        </div>
                      )}
                    </div>
                    <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                      Save Configuration
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Model & Performance */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Model & Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Select
                        value={editedConfig.model || mergedConfig?.model || 'gpt-4o'}
                        onValueChange={(v) => setEditedConfig(prev => ({ ...prev, model: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_MODELS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Temperature: {editedConfig.temperature ?? mergedConfig?.temperature ?? 0.7}</Label>
                      <Slider
                        value={[editedConfig.temperature ?? mergedConfig?.temperature ?? 0.7]}
                        onValueChange={([v]) => setEditedConfig(prev => ({ ...prev, temperature: v }))}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                      <p className="text-xs text-muted-foreground">Lower = more precise, Higher = more creative</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Max Tokens</Label>
                      <Input
                        type="number"
                        value={editedConfig.max_tokens ?? mergedConfig?.max_tokens ?? 2000}
                        onChange={(e) => setEditedConfig(prev => ({ ...prev, max_tokens: parseInt(e.target.value) || 2000 }))}
                        min={100}
                        max={8000}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Tool Access */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Tool Access</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Enable Tools</Label>
                      <Switch
                        checked={editedConfig.tools?.enabled ?? mergedConfig?.tools?.enabled ?? true}
                        onCheckedChange={(v) => setEditedConfig(prev => ({
                          ...prev,
                          tools: { ...prev.tools, enabled: v, allow: prev.tools?.allow || [], deny: prev.tools?.deny || [] }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Denied Tools</Label>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                        {AVAILABLE_TOOLS.map(tool => {
                          const isDenied = (editedConfig.tools?.deny || mergedConfig?.tools?.deny || []).includes(tool);
                          return (
                            <Badge
                              key={tool}
                              variant={isDenied ? 'destructive' : 'outline'}
                              className="cursor-pointer text-xs"
                              onClick={() => {
                                const currentDeny = editedConfig.tools?.deny || [];
                                const newDeny = isDenied
                                  ? currentDeny.filter(t => t !== tool)
                                  : [...currentDeny, tool];
                                setEditedConfig(prev => ({
                                  ...prev,
                                  tools: { ...prev.tools, enabled: prev.tools?.enabled ?? true, allow: [], deny: newDeny }
                                }));
                              }}
                            >
                              {isDenied && <X className="h-3 w-3 mr-1" />}
                              {tool}
                            </Badge>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">Click to toggle tool access</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Features */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Voice Chat</Label>
                      <Switch
                        checked={editedConfig.features?.voice?.enabled ?? mergedConfig?.features?.voice?.enabled ?? false}
                        onCheckedChange={(v) => setEditedConfig(prev => ({
                          ...prev,
                          features: { ...prev.features, voice: { enabled: v }, media_links: prev.features?.media_links || { enabled: false } }
                        }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Media Link Uploads</Label>
                      <Switch
                        checked={editedConfig.features?.media_links?.enabled ?? mergedConfig?.features?.media_links?.enabled ?? false}
                        onCheckedChange={(v) => setEditedConfig(prev => ({
                          ...prev,
                          features: { ...prev.features, media_links: { enabled: v }, voice: prev.features?.voice || { enabled: false } }
                        }))}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Custom Instructions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Custom Instructions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={editedConfig.system_prompt ?? mergedConfig?.system_prompt ?? ''}
                      onChange={(e) => setEditedConfig(prev => ({ ...prev, system_prompt: e.target.value || null }))}
                      placeholder="Add custom instructions for Robbie's behavior..."
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      These instructions will be added to Robbie's system prompt
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditedConfig({})}>
                  Reset Changes
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Save Configuration
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
