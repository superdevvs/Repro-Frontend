import { AlertCircle, Check, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { SmsNumberConfig } from '@/types/messaging';

interface SmsSettingsPanelProps {
  numbers: SmsNumberConfig[];
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
  onDeleteNumber: (index: number) => void;
}

export function SmsSettingsPanel({
  numbers,
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
  onDeleteNumber,
}: SmsSettingsPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Twilio Configuration</h2>
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
                <DialogTitle>Add Twilio Sender</DialogTitle>
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
                  <Label>Twilio Phone Number SID (Optional)</Label>
                  <Input value={newNumber.twilio_phone_number_sid ?? ''} onChange={(e) => onNewNumberChange({ ...newNumber, twilio_phone_number_sid: e.target.value })} placeholder="PNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" />
                  <p className="mt-1 text-xs text-muted-foreground">Leave blank to use the default `TWILIO_PHONE_NUMBER_SID` from the backend environment.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked disabled />
                  <Label>Single sender rollout: this number will be the default sender</Label>
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
            <span className="font-medium">{numbers.length > 0 ? 'Twilio Sender Configured' : 'Twilio Sender Not Configured'}</span>
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
                <p className="font-medium text-yellow-800">No Twilio sender configured</p>
                <p className="mt-1 text-sm text-yellow-700">Add your Twilio toll-free number to enable SMS notifications, reminders, and replies.</p>
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
                        <Badge variant="outline">{number.provider ?? 'TWILIO'}</Badge>
                      </div>
                      {number.label && <div className="mb-1 text-sm text-muted-foreground">{number.label}</div>}
                      <div className="text-xs text-muted-foreground">Phone Number SID: {number.twilio_phone_number_sid ? 'Configured' : 'Using backend default'}</div>
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
    </div>
  );
}
