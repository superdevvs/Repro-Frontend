import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { getVoiceNumbers } from '@/services/voice';
import { usePermissions } from '@/context/PermissionsContext';
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
import CallsPeople from './CallsPeople';
import CallsFollowUps from './CallsFollowUps';
import './workspace/callsTheme.css';

const tabs = [
  { to: '/calls/inbox', label: 'Inbox' },
  { to: '/calls/people', label: 'People' },
  { to: '/calls/follow-ups', label: 'Follow-ups' },
  { to: '/calls/live', label: 'Team queue' },
  { to: '/calls/assistant', label: 'Robbie' },
  { to: '/calls/insights', label: 'Insights' },
  { to: '/calls/settings', label: 'Audio & alerts' },
  { to: '/calls/settings?section=business', label: 'Business settings' },
  { to: '/calls/schedule', label: 'Business hours' },
  { to: '/calls/automations', label: 'Automations' },
  { to: '/chat-with-reproai?tab=help', label: 'Help & guides' },
  { to: '/support', label: 'Support requests' },
];

function revealTab(navigation: HTMLElement, tab: HTMLElement) {
  const viewport = navigation.getBoundingClientRect();
  const bounds = tab.getBoundingClientRect();
  if (bounds.left < viewport.left) navigation.scrollLeft += bounds.left - viewport.left;
  else if (bounds.right > viewport.right) navigation.scrollLeft += bounds.right - viewport.right;
}

export default function CallsLayout() {
  const { pathname, search } = useLocation();
  const navigationRef = useRef<HTMLElement>(null);
  const [tabScroll, setTabScroll] = useState({ overflow: false, previous: false, next: false });
  const { can } = usePermissions();
  const numbers = useQuery({ queryKey: ['voice-numbers'], queryFn: getVoiceNumbers });
  const defaultNumber = numbers.data?.find((item) => item.is_default) ?? numbers.data?.[0];
  const active = (to: string) => to.includes('?') ? pathname === to.split('?')[0] && search.includes('section=business') : pathname.startsWith(to) && !(to === '/calls/settings' && search.includes('section=business'));
  useEffect(() => {
    const navigation = navigationRef.current;
    const current = navigation?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!navigation || !current) return;
    let disposed = false;
    const updateOverflow = () => {
      if (disposed) return;
      const maximum = navigation.scrollWidth - navigation.clientWidth;
      const next = { overflow: maximum > 1, previous: navigation.scrollLeft > 1, next: navigation.scrollLeft < maximum - 1 };
      setTabScroll(previous => previous.overflow === next.overflow && previous.previous === next.previous && previous.next === next.next ? previous : next);
    };
    const revealCurrent = () => {
      if (disposed) return;
      revealTab(navigation, current);
      updateOverflow();
    };
    revealCurrent();
    const observer = new ResizeObserver(revealCurrent);
    observer.observe(navigation);
    observer.observe(current);
    navigation.addEventListener('scroll', updateOverflow, { passive: true });
    void document.fonts.ready.then(revealCurrent);
    return () => { disposed = true; observer.disconnect(); navigation.removeEventListener('scroll', updateOverflow); };
  }, [pathname, search]);
  return <DashboardLayout hideFooter>
    <div className="calls-workspace calls-shell">
      <h1 className="sr-only">Calls</h1>
      <div className="calls-toolbar">
        {tabScroll.overflow && <Button variant="ghost" size="icon" className="h-10 w-7 shrink-0" aria-label="Earlier Calls tabs" title="Earlier Calls tabs" disabled={!tabScroll.previous} onClick={() => { const navigation = navigationRef.current; navigation?.scrollBy({ left: -navigation.clientWidth * 0.8 }); }}><ChevronLeft className="h-4 w-4" /></Button>}
        <nav ref={navigationRef} aria-label="Calls navigation" className="calls-tabs">
          {tabs.map((tab) => <Link key={tab.to} to={tab.to} aria-current={active(tab.to) ? 'page' : undefined} className="calls-nav-link" onFocus={(event) => { if (navigationRef.current) revealTab(navigationRef.current, event.currentTarget); }}>{tab.label}</Link>)}
        </nav>
        {tabScroll.overflow && <Button variant="ghost" size="icon" className="h-10 w-7 shrink-0" aria-label="More Calls tabs" title="More Calls tabs" disabled={!tabScroll.next} onClick={() => { const navigation = navigationRef.current; navigation?.scrollBy({ left: navigation.clientWidth * 0.8 }); }}><ChevronRight className="h-4 w-4" /></Button>}
        <NewCallDialog initialFrom={defaultNumber?.phone_number} trigger={<Button disabled={!can('voice-calls', 'operate')} className="calls-primary h-10 shrink-0 rounded-lg px-3 text-sm"><Plus className="h-4 w-4" />Call</Button>} />
      </div>
      <div className="calls-route-content">
          <Routes>
            <Route index element={<Navigate to={new URLSearchParams(search).has('offer') ? `live${search}` : 'inbox'} replace />} />
            <Route path="inbox" element={<CallsInbox />} /><Route path="inbox/:id" element={<CallsInbox />} /><Route path="inbox/:id/wrap-up" element={<CallsWrapUp />} />
            <Route path="people" element={<CallsPeople />} /><Route path="follow-ups" element={<CallsFollowUps />} />
            <Route path="live" element={<CallsLive />} /><Route path="live/:id" element={<CallLiveCockpit />} />
            <Route path="schedule" element={<CallsSchedule />} /><Route path="assistant" element={<CallsAssistant />} /><Route path="automations" element={<CallsAutomations />} /><Route path="insights" element={<CallsInsights />} /><Route path="settings" element={<CallsSettings />} />
            <Route path="overview" element={<Navigate to="/calls/inbox" replace />} /><Route path="log" element={<Navigate to="/calls/inbox" replace />} /><Route path="numbers" element={<Navigate to="/calls/settings?section=business" replace />} />
          </Routes>
      </div>
    </div>
  </DashboardLayout>;
}
