import { useEffect, useRef } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, PhoneCall, Plus } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import OngoingCallPopup from '@/components/voice/OngoingCallPopup';
import { BrowserPhoneConnectButton } from '@/components/voice/BrowserPhoneControls';
import { getVoiceCalls, getVoiceHealth, getVoiceNumbers } from '@/services/voice';
import { usePermissions } from '@/context/PermissionsContext';
import { availabilityLabel } from './workspace/callDisplay';
import NewCallDialog from './workspace/NewCallDialog';
import CallsInbox from './CallsInbox';
import CallsWrapUp from './CallsWrapUp';
import CallsLive from './CallsLive';
import CallLiveCockpit from './CallLiveCockpit';
import CallsAssistant from './CallsAssistant';
import CallsAutomations from './CallsAutomations';
import CallsInsights from './CallsInsights';
import CallsSchedule from './CallsSchedule';
import CallsSettings from './CallsSettings';
import './workspace/callsTheme.css';

const tabs = [
  { to: '/calls/inbox', label: 'Inbox', match: (path: string) => path.startsWith('/calls/inbox') },
  { to: '/calls/live', label: 'Live', match: (path: string) => path.startsWith('/calls/live') },
  { to: '/calls/schedule', label: 'Schedule', match: (path: string) => path.startsWith('/calls/schedule') },
  { to: '/calls/assistant', label: 'Robbie AI', match: (path: string) => path.startsWith('/calls/assistant') },
  { to: '/calls/automations', label: 'Automations', match: (path: string) => path.startsWith('/calls/automations') },
  { to: '/calls/insights', label: 'Insights', match: (path: string) => path.startsWith('/calls/insights') },
  { to: '/calls/settings', label: 'Numbers & settings', match: (path: string) => path.startsWith('/calls/settings') || path.startsWith('/calls/numbers') },
];

export default function CallsLayout() {
  const { pathname } = useLocation();
  const navigationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const navigation = navigationRef.current;
    const activeTab = navigation?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!navigation || !activeTab) return;
    const viewport = navigation.getBoundingClientRect();
    const tab = activeTab.getBoundingClientRect();
    if (tab.left < viewport.left) navigation.scrollLeft += tab.left - viewport.left;
    else if (tab.right > viewport.right) navigation.scrollLeft += tab.right - viewport.right;
  }, [pathname]);
  const { can } = usePermissions();
  const canOperate = can('voice-calls', 'operate');
  const numbers = useQuery({ queryKey: ['voice-numbers'], queryFn: getVoiceNumbers });
  const health = useQuery({ queryKey: ['voice-health'], queryFn: getVoiceHealth, refetchInterval: 30000 });
  const live = useQuery({
    queryKey: ['voice-calls', 'live-count'],
    queryFn: () => getVoiceCalls({ per_page: 10, filter: 'live' }),
    refetchInterval: 15000,
  });
  const defaultNumber = numbers.data?.find((item) => item.is_default) ?? numbers.data?.[0];
  const liveCount = live.data?.total ?? live.data?.data?.length ?? 0;
  const statusUnknown = !health.data || health.isLoading || live.isLoading;
  const statusError = health.isError || live.isError;
  const badge = statusError ? 'Status unavailable' : statusUnknown ? 'Checking…' : availabilityLabel(liveCount, health.data.can_place_calls, health.data.outbound_mode);
  const badgeTone = statusError ? 'warning' : statusUnknown ? 'neutral' : health.data?.outbound_mode === 'none' || !health.data?.can_place_calls ? 'warning' : 'success';

  return (
    <DashboardLayout>
      <div className="calls-workspace min-w-0 pb-6 text-[var(--calls-text)]">
        <div className="flex min-w-0 flex-col gap-4 pb-0 pt-3 md:px-4 md:pt-6 xl:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <PhoneCall className="h-6 w-6 text-[var(--calls-brand)]" />
                <h1 className="text-[28px] font-semibold leading-9 tracking-tight">Calls</h1>
              </div>
              <p className="mt-1 text-xs text-[var(--calls-muted)]">A little more human. A lot more connected.</p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <span role="status" className={`calls-chip calls-chip-${badgeTone}`}>{badge}</span>
              <BrowserPhoneConnectButton />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="calls-secondary h-11 min-w-0 max-w-[min(100%,16rem)] rounded-lg px-3 text-[13px]">
                    <span className="truncate">{defaultNumber?.label || 'Main line'}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="calls-workspace min-w-56 max-w-[calc(100vw-24px)]">
                  {(numbers.data ?? []).map((item) => (
                    <DropdownMenuItem key={item.id} asChild>
                      <Link to="/calls/settings">{item.label || 'Line'} · {item.phone_number}</Link>
                    </DropdownMenuItem>
                  ))}
                  {(numbers.data ?? []).length === 0 && <DropdownMenuItem disabled>No numbers configured</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
              <NewCallDialog
                initialFrom={defaultNumber?.phone_number}
                trigger={
                  <Button disabled={!canOperate} className="calls-primary h-11 rounded-lg px-3 text-[13px] shadow-none">
                    <Plus className="h-4 w-4" />
                    New call
                  </Button>
                }
              />
            </div>
          </div>

          <nav ref={navigationRef} aria-label="Calls navigation" className="flex min-w-0 gap-5 overflow-x-auto border-b border-[var(--calls-border)] sm:gap-6">
            {tabs.map((tab) => (
              <Link key={tab.to} to={tab.to} data-active={tab.match(pathname)} aria-current={tab.match(pathname) ? 'page' : undefined} className="calls-nav-link shrink-0 whitespace-nowrap">
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="min-w-0 py-4 md:px-4 xl:px-6">
          <Routes>
            <Route index element={<Navigate to="inbox" replace />} />
            <Route path="inbox" element={<CallsInbox />} />
            <Route path="inbox/:id" element={<CallsInbox />} />
            <Route path="inbox/:id/wrap-up" element={<CallsWrapUp />} />
            <Route path="live" element={<CallsLive />} />
            <Route path="live/:id" element={<CallLiveCockpit />} />
            <Route path="schedule" element={<CallsSchedule />} />
            <Route path="assistant" element={<CallsAssistant />} />
            <Route path="automations" element={<CallsAutomations />} />
            <Route path="insights" element={<CallsInsights />} />
            <Route path="settings" element={<CallsSettings />} />
            <Route path="overview" element={<Navigate to="/calls/inbox" replace />} />
            <Route path="log" element={<Navigate to="/calls/inbox" replace />} />
            <Route path="numbers" element={<Navigate to="/calls/settings" replace />} />
          </Routes>
        </div>
      </div>
      <OngoingCallPopup />
    </DashboardLayout>
  );
}
