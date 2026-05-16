import { useQuery } from '@tanstack/react-query';
import { Bot, CheckCircle2, Code2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getVoiceSettings } from '@/services/voice';

const bridgeTools = [
  'verify_caller',
  'get_shoot_details',
  'list_shoots',
  'get_payment_status',
  'get_availability',
  'book_shoot',
  'reschedule_shoot',
  'cancel_shoot',
  'create_payment_link',
  'handoff_to_staff',
  'transfer_to_staff',
];
const confirmationGated = ['book_shoot', 'reschedule_shoot', 'cancel_shoot', 'create_payment_link'];

export default function CallsAssistant() {
  const settings = useQuery({ queryKey: ['voice-settings'], queryFn: getVoiceSettings });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-blue-600" /> Active AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Assistant ID" value={settings.data?.assistant_id || 'Not configured'} />
          <Row label="Voice enabled" value={settings.data?.enabled ? 'Enabled' : 'Disabled'} />
          <Row label="Webhook URL" value={settings.data?.webhook_url || 'Not configured'} />
          <Row label="Recording" value={settings.data?.recording_enabled ? 'Enabled' : 'Disabled'} />
          <Row label="Support number" value={settings.data?.support_handoff_number || 'Not configured'} />
          <Row label="Quiet hours" value={settings.data?.quiet_hours?.enabled ? `${settings.data.quiet_hours.start}-${settings.data.quiet_hours.end} ${settings.data.quiet_hours.timezone}` : 'Disabled'} />
          <Row label="Webhook health" value={settings.data?.webhook_url ? 'Configured' : 'Missing webhook URL'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Code2 className="h-4 w-4 text-blue-600" /> Tool Bridge Allowlist
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {bridgeTools.map((tool) => (
            <div key={tool} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{tool}</span>
              {confirmationGated.includes(tool) && <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">confirm</span>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Disclosure Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            {settings.data?.disclosure_text || 'Disclosure text not configured.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
