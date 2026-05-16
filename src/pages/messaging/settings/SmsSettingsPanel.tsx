import { AlertCircle, Check, Loader2, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { SmsAiSettings, SmsNumberConfig } from '@/types/messaging';

interface SmsSettingsPanelProps {
  numbers: SmsNumberConfig[];
  aiSettings?: SmsAiSettings;
  aiDraft?: SmsAiSettings;
  smsLoading: boolean;
  showTestSend: boolean;
  showAddNumber: boolean;
  newNumber: SmsNumberConfig;
  testPhone: string;
  testMessage: string;
  testingConnection: boolean;
  testingSend: boolean;
  savePending: boolean;
  onShowTestSendChange: (open: boolean) => void;
  onShowAddNumberChange: (open: boolean) => void;
  onNewNumberChange: (value: SmsNumberConfig) => void;
  onTestPhoneChange: (value: string) => void;
  onTestMessageChange: (value: string) => void;
  onTestConnection: () => void;
  onTestSend: () => void;
  onAddNumber: () => void;
  onEditNumber: (index: number) => void;
  onToggleNumberAi: (index: number, enabled: boolean) => void;
  onAiDraftChange: (value: SmsAiSettings) => void;
  onSaveAiSettings: () => void;
  onDeleteNumber: (index: number) => void;
}

export function SmsSettingsPanel({
  numbers,
  aiSettings,
  aiDraft,
  smsLoading,
  showTestSend,
  showAddNumber,
  newNumber,
  testPhone,
  testMessage,
  testingConnection,
  testingSend,
  savePending,
  onShowTestSendChange,
  onShowAddNumberChange,
  onNewNumberChange,
  onTestPhoneChange,
  onTestMessageChange,
  onTestConnection,
  onTestSend,
  onAddNumber,
  onEditNumber,
  onToggleNumberAi,
  onAiDraftChange,
  onSaveAiSettings,
  onDeleteNumber,
}: SmsSettingsPanelProps) {
  const effectiveAi = aiDraft ?? aiSettings;
  const toolOptions = [
    'get_shoot_details',
    'list_shoots',
    'get_payment_status',
    'get_availability',
    'get_property',
    'get_listing',
    'get_editing_types',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Telnyx Configuration</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onTestConnection} disabled={testingConnection}>
            {testingConnection ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Testing...</> : 'Test Connection'}
          </Button>
          <Dialog open={showTestSend} onOpenChange={onShowTestSendChange}>
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
                  <Input value={testPhone} onChange={(e) => onTestPhoneChange(e.target.value)} placeholder="+1 (555) 123-4567" />
                </div>
                <div>
                  <Label>Message</Label>
                  <Input value={testMessage} onChange={(e) => onTestMessageChange(e.target.value)} placeholder="Test message" />
                </div>
                <Button onClick={onTestSend} disabled={testingSend || !testPhone} className="w-full">
                  {testingSend ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : <><Send className="mr-2 h-4 w-4" />Send Test SMS</>}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showAddNumber} onOpenChange={onShowAddNumberChange}>
            <DialogTrigger asChild>
              <Button disabled={numbers.length >= 1}>
                <Plus className="mr-2 h-4 w-4" />
                Add Sender
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Telnyx Sender</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Phone Number</Label>
                  <Input value={newNumber.phone_number} onChange={(e) => onNewNumberChange({ ...newNumber, phone_number: e.target.value })} placeholder="(202) 868-1663" />
                </div>
                <div>
                  <Label>Label (Optional)</Label>
                  <Input value={newNumber.label} onChange={(e) => onNewNumberChange({ ...newNumber, label: e.target.value })} placeholder="e.g., Main Number" />
                </div>
                <div>
                  <Label>Telnyx Phone Number ID (Optional)</Label>
                  <Input value={newNumber.telnyx_phone_number_id ?? ''} onChange={(e) => onNewNumberChange({ ...newNumber, telnyx_phone_number_id: e.target.value })} placeholder="phone-number-uuid" />
                  <p className="mt-1 text-xs text-muted-foreground">Leave blank to use the default <code>TELNYX_PHONE_NUMBER_ID</code> from the backend environment.</p>
                </div>
                <div>
                  <Label>Messaging Profile ID (Optional)</Label>
                  <Input value={newNumber.messaging_profile_id ?? ''} onChange={(e) => onNewNumberChange({ ...newNumber, messaging_profile_id: e.target.value })} placeholder="messaging-profile-uuid" />
                  <p className="mt-1 text-xs text-muted-foreground">Leave blank to use the default <code>TELNYX_MESSAGING_PROFILE_ID</code> from the backend environment.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked disabled />
                  <Label>Single sender rollout: this number will be the default sender</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newNumber.sms_ai_enabled !== false}
                    onCheckedChange={(checked) => onNewNumberChange({ ...newNumber, sms_ai_enabled: checked })}
                  />
                  <Label>Allow Robbie AI replies for this sender</Label>
                </div>
                <Button onClick={onAddNumber} disabled={savePending || !newNumber.phone_number} className="w-full">
                  {savePending ? 'Saving...' : 'Save Sender'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${numbers.length > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="font-medium">{numbers.length > 0 ? 'Telnyx Sender Configured' : 'Telnyx Sender Not Configured'}</span>
          </div>

          {smsLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-3/4 rounded bg-muted" />
            </div>
          ) : numbers.length === 0 ? (
            <div className="flex gap-3 rounded border border-yellow-200 bg-yellow-50 p-4">
              <AlertCircle className="h-5 w-5 shrink-0 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">No Telnyx sender configured</p>
                <p className="mt-1 text-sm text-yellow-700">Add your Telnyx number to enable SMS notifications, reminders, and replies.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Label>Configured Sender</Label>
              {numbers.map((number, idx) => (
                <Card key={number.id || idx} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <div className="font-medium">{number.phone_number}</div>
                        {number.is_default && (
                          <Badge variant="secondary">
                            <Check className="mr-1 h-3 w-3" />
                            Default
                          </Badge>
                        )}
                        <Badge variant="outline">{number.provider ?? 'TELNYX'}</Badge>
                      </div>
                      {number.label && <div className="mb-1 text-sm text-muted-foreground">{number.label}</div>}
                      <div className="text-xs text-muted-foreground">Phone Number ID: {number.telnyx_phone_number_id ? 'Configured' : 'Using backend default'}</div>
                      <div className="text-xs text-muted-foreground">Messaging Profile: {number.messaging_profile_id ? 'Configured' : 'Using backend default'}</div>
                      <div className="mt-3 flex items-center gap-2">
                        <Switch
                          checked={number.sms_ai_enabled !== false}
                          onCheckedChange={(checked) => onToggleNumberAi(idx, checked)}
                        />
                        <span className="text-xs text-muted-foreground">Robbie AI replies for this sender</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => onEditNumber(idx)}>Edit</Button>
                      <Button variant="outline" size="sm" onClick={() => onDeleteNumber(idx)}>
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

      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Robbie AI SMS Agent</h3>
                <p className="text-sm text-muted-foreground">Responds to inbound Telnyx SMS with compliance-aware AI replies.</p>
              </div>
            </div>
            <div className="grid gap-2 pt-2 text-sm text-muted-foreground sm:grid-cols-2">
              <div>Staff takeover pause: {effectiveAi?.takeover_pause_minutes ?? 120} min</div>
              <div>Idle session TTL: {effectiveAi?.idle_ttl_minutes ?? 1440} min</div>
              <div>Pending action TTL: {effectiveAi?.pending_action_ttl_minutes ?? 10} min</div>
              <div>Max reply segments: {effectiveAi?.max_segments ?? 3}</div>
              <div>Rate limit: {effectiveAi?.max_replies_per_hour ?? 20}/hour</div>
            </div>
          </div>
          <Badge variant={aiSettings?.enabled ? 'default' : 'outline'} className="w-fit">
            {aiSettings?.enabled ? 'Enabled' : 'Disabled by env'}
          </Badge>
        </div>
        <div className="mt-4 rounded-lg border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
          Configure rollout with <code>TELNYX_AI_SMS_ENABLED</code>. Per-contact opt-out and staff takeover controls are enforced automatically.
        </div>
        {effectiveAi && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>STOP reply</Label>
                <Textarea
                  value={effectiveAi.static_replies.stop}
                  onChange={(event) => onAiDraftChange({
                    ...effectiveAi,
                    static_replies: { ...effectiveAi.static_replies, stop: event.target.value },
                  })}
                />
              </div>
              <div>
                <Label>START reply</Label>
                <Textarea
                  value={effectiveAi.static_replies.start}
                  onChange={(event) => onAiDraftChange({
                    ...effectiveAi,
                    static_replies: { ...effectiveAi.static_replies, start: event.target.value },
                  })}
                />
              </div>
              <div>
                <Label>HELP reply</Label>
                <Textarea
                  value={effectiveAi.static_replies.help}
                  onChange={(event) => onAiDraftChange({
                    ...effectiveAi,
                    static_replies: { ...effectiveAi.static_replies, help: event.target.value },
                  })}
                />
              </div>
            </div>
            <div>
              <Label>Default read-only SMS tools</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {toolOptions.map((tool) => (
                  <label key={tool} className="flex items-center gap-2 rounded-md border border-border/70 p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={effectiveAi.allowed_tools.includes(tool)}
                      onChange={(event) => {
                        const nextTools = event.target.checked
                          ? [...effectiveAi.allowed_tools, tool]
                          : effectiveAi.allowed_tools.filter((item) => item !== tool);

                        onAiDraftChange({ ...effectiveAi, allowed_tools: nextTools });
                      }}
                    />
                    <span>{tool}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={onSaveAiSettings} disabled={savePending}>
              {savePending ? 'Saving...' : 'Save AI SMS Agent Settings'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
