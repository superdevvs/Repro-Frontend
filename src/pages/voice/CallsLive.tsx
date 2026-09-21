import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock3, Phone, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageLoading } from '@/hooks/use-page-loading';
import { getScheduleState, getVoiceCalls, getVoiceHealth, getVoiceSettings } from '@/services/voice';
import { CallsAvatar, EmptyCalls } from './workspace/bits';
import { callerInitials, callerName, formatDuration, relatedShoot } from './workspace/callDisplay';
import { usePermissions } from '@/context/PermissionsContext';
import CallBrowserPanel from '@/components/voice/CallBrowserPanel';
import { BrowserPhoneConnectButton } from '@/components/voice/BrowserPhoneControls';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';

export default function CallsLive() {
  const { can } = usePermissions();
  const canOperate = can('voice-calls', 'operate');
  const phone = useBrowserPhone();
  const live = useQuery({
    queryKey: ['voice-calls', 'live'],
    queryFn: () => getVoiceCalls({ per_page: 25, filter: 'live' }),
    refetchInterval: 8000,
  });
  const schedule = useQuery({ queryKey: ['voice-schedule-state'], queryFn: () => getScheduleState() });
  const settings = useQuery({ queryKey: ['voice-settings'], queryFn: getVoiceSettings });
  const health = useQuery({ queryKey: ['voice-health'], queryFn: getVoiceHealth });
  usePageLoading(live.isLoading || schedule.isLoading);

  const rows = live.data?.data ?? [];
  const yours = rows.filter((call) => call.handled_by === 'human' || call.handled_by === 'mixed' || call.status === 'human_handoff');
  const others = rows.filter((call) => !yours.includes(call));
  const coverage = schedule.data?.state;
  const afterHours = coverage?.state === 'quiet_hours' || coverage?.state === 'holiday_closed' || coverage?.state === 'override_closed' || coverage?.state === 'ai_only';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[28px] font-semibold leading-9">Who is speaking, right now.</h2>
        <p className="mt-1 text-sm text-[var(--calls-muted)]">
          {rows.length === 0 ? 'No live conversations.' : `${rows.length} live conversation${rows.length === 1 ? '' : 's'}.`}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {yours.map((call) => (
            <div key={call.id} className="calls-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CallsAvatar initials={callerInitials(call)} size={40} />
                  <div>
                    <p className="text-lg font-semibold">{callerName(call)}</p>
                    <p className="text-xs text-[var(--calls-muted)]">Team conversation · {formatDuration(call.duration_seconds)}</p>
                  </div>
                </div>
                <span className="calls-chip calls-chip-success">{call.status.replace(/_/g, ' ')}</span>
              </div>
              <p className="mt-3 text-sm text-[var(--calls-muted)]">{relatedShoot(call)?.address || call.intent?.replace(/_/g, ' ') || call.live_transcript_preview || 'Connected.'}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild className="calls-primary h-11 rounded-lg">
                  <Link to={`/calls/live/${call.id}`}>Open live</Link>
                </Button>
                <Button asChild variant="outline" className="calls-secondary h-11 rounded-lg">
                  <Link to={`/calls/inbox/${call.id}/wrap-up`}>{canOperate ? 'Prepare wrap-up' : 'Review wrap-up'}</Link>
                </Button>
                <CallBrowserPanel callId={call.id} compact />
              </div>
            </div>
          ))}

          {others.map((call) => (
            <div key={call.id} className="calls-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CallsAvatar initials={callerInitials(call)} size={40} />
                  <div>
                    <p className="text-lg font-semibold">{callerName(call)}</p>
                    <p className="text-xs text-[var(--calls-muted)]">
                      {call.handled_by === 'ai' ? 'Robbie' : 'Team'} · {formatDuration(call.duration_seconds)}
                    </p>
                  </div>
                </div>
                <span className="calls-chip calls-chip-neutral">{call.status.replace(/_/g, ' ')}</span>
              </div>
              <p className="mt-3 text-sm text-[var(--calls-muted)]">{call.live_transcript_preview || relatedShoot(call)?.address || 'Listening for transcript…'}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild className="calls-primary h-11 rounded-lg">
                  <Link to={`/calls/live/${call.id}`}>Open</Link>
                </Button>
                <CallBrowserPanel callId={call.id} compact />
              </div>
            </div>
          ))}

          {live.isError && (
            <div role="alert" className="calls-panel p-4 text-sm text-[var(--calls-danger)]">
              Could not load live calls.
              <Button variant="outline" className="mt-3 calls-secondary" onClick={() => void live.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {!live.isLoading && !live.isError && rows.length === 0 && (
            <div className="calls-panel p-8">
              <EmptyCalls title="No one is on a call" description="When Robbie or the team connects, the conversation will appear here." />
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <section className="calls-panel p-4">
            <p className="text-sm font-medium">Coverage now</p>
            <p className="mt-2 text-lg font-semibold">{coverage?.label || 'Checking coverage…'}</p>
            <p className="mt-1 text-sm text-[var(--calls-muted)]">
              {rows.length} live · {health.data?.can_place_calls ? 'Outbound ready' : 'Outbound not ready'}
            </p>
            {coverage?.until && <p className="mt-2 text-xs text-[var(--calls-muted)]">Until {new Date(coverage.until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>}
            <Button asChild variant="outline" className="calls-secondary mt-4 h-11 w-full rounded-lg">
              <Link to="/calls/schedule">Open schedule</Link>
            </Button>
          </section>
          <section className="calls-panel p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Clock3 className="h-4 w-4" />
              After hours
            </p>
            <p className="mt-2 text-sm text-[var(--calls-muted)]">
              {afterHours
                ? settings.data?.out_of_hours_message || coverage?.label || 'Robbie is covering after hours.'
                : 'Team hours are open. After-hours messages wait until coverage closes.'}
            </p>
          </section>
          <section className="calls-panel p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <UserPlus className="h-4 w-4" />
              Team live
            </p>
            <p className="mt-2 text-sm text-[var(--calls-muted)]">
              {phone.config?.ready ? 'Connect your phone to answer team calls. Authorized supervisors can listen, coach only the staff member, or join supported conversations.' : phone.config?.blockers?.[0] || 'Browser calling readiness is unavailable. Open a call to review its available actions.'}
            </p>
            <div className="mt-3"><BrowserPhoneConnectButton /></div>
            <p className="mt-3 flex items-center gap-2 text-xs text-[var(--calls-muted)]">
              <Phone className="h-3.5 w-3.5" />
              {settings.data?.support_handoff_number || 'No support handoff number configured'}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
