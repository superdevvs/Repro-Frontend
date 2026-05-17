import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Bot, CheckCircle2, Code2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getVoiceHealth, getVoiceSettings } from '@/services/voice';

export default function CallsAssistant() {
  const settings = useQuery({ queryKey: ['voice-settings'], queryFn: getVoiceSettings });
  const health = useQuery({ queryKey: ['voice-health'], queryFn: getVoiceHealth });
  const bridgeTools = settings.data?.tool_allowlist ?? [];
  const confirmationGated = settings.data?.confirmation_gated_tools ?? [];
  const latestWebhook = health.data?.latest_webhook_event;
  const failedWebhook = health.data?.latest_failed_webhook;

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
          <Row label="Webhook URL" value={health.data?.webhook_url_configured ? 'Configured' : 'Missing'} />
          <Row
            label="Latest webhook"
            value={latestWebhook ? `${latestWebhook.event_type || 'unknown'} at ${formatDate(latestWebhook.received_at)}` : 'No voice webhooks received'}
          />
          <Row
            label="Last webhook error"
            value={failedWebhook ? `${failedWebhook.event_type || 'unknown'}: ${failedWebhook.processing_error || 'failed'}` : 'None'}
          />
          <Row label="Due callbacks" value={String(health.data?.scheduler?.due_scheduled_calls ?? 0)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Code2 className="h-4 w-4 text-blue-600" /> Tool Bridge Allowlist
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {bridgeTools.length > 0 ? bridgeTools.map((tool) => (
            <div key={tool} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{tool}</span>
              {confirmationGated.includes(tool) && <Badge variant="secondary" className="ml-auto text-[10px]">confirm</Badge>}
            </div>
          )) : (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground sm:col-span-2">
              <AlertCircle className="h-4 w-4" /> No tools are enabled.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Last Command Status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <pre className="overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
            {health.data?.latest_command_status ? JSON.stringify(health.data.latest_command_status, null, 2) : 'No Telnyx command status recorded.'}
          </pre>
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <Row
              label="Last failed tool"
              value={health.data?.latest_failed_tool ? `${health.data.latest_failed_tool.tool || 'unknown'}: ${health.data.latest_failed_tool.error_code || health.data.latest_failed_tool.status || 'failed'}` : 'None'}
            />
          </div>
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

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : 'unknown time';
}
