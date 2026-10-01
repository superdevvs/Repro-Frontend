import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BarChart3, BookOpen, Bot, CalendarClock, Clock3, Headphones, LifeBuoy, MoreHorizontal, PhoneCall, Plus, Radio, Settings2, Users, Workflow } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
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

const primary = [
  { to: '/calls/inbox', label: 'Calls', icon: PhoneCall },
  { to: '/calls/people', label: 'People', icon: Users },
  { to: '/calls/follow-ups', label: 'Follow-ups', icon: CalendarClock },
];
const manage = [
  { to: '/calls/live', label: 'Team queue', icon: Radio },
  { to: '/calls/assistant', label: 'Robbie', icon: Bot },
  { to: '/calls/insights', label: 'Insights', icon: BarChart3 },
  { to: '/calls/settings', label: 'Audio & alerts', icon: Headphones },
  { to: '/calls/settings?section=business', label: 'Business settings', icon: Settings2 },
  { to: '/calls/schedule', label: 'Business hours', icon: Clock3 },
  { to: '/calls/automations', label: 'Automations', icon: Workflow },
];
const help = [
  { to: '/chat-with-reproai?tab=help', label: 'Help & guides', icon: BookOpen },
  { to: '/support', label: 'Support requests', icon: LifeBuoy },
];

export default function CallsLayout() {
  const { pathname, search } = useLocation();
  const { can } = usePermissions();
  const phone = useBrowserPhone();
  const numbers = useQuery({ queryKey: ['voice-numbers'], queryFn: getVoiceNumbers });
  const defaultNumber = numbers.data?.find((item) => item.is_default) ?? numbers.data?.[0];
  const active = (to: string) => to.includes('?') ? pathname === to.split('?')[0] && search.includes('section=business') : pathname.startsWith(to) && !(to === '/calls/settings' && search.includes('section=business'));
  const moreActive = !primary.some((item) => active(item.to));
  return <DashboardLayout hideFooter>
    <div className="calls-workspace calls-shell">
      <header className="calls-appbar">
        <div className="flex min-w-0 items-center gap-2"><Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Back to dashboard"><Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link></Button><h1 className="text-lg font-semibold">Calls</h1><span className="hidden truncate text-xs text-[var(--calls-muted)] sm:block">/ {defaultNumber?.label || 'Business calls'}</span></div>
        <div className="flex shrink-0 items-center gap-2"><span className={`calls-chip hidden sm:inline-flex ${phone.status === 'ready' ? 'calls-chip-success' : 'calls-chip-neutral'}`}>{phone.active ? 'In call' : phone.status === 'ready' ? 'Browser ready' : phone.configLoading ? 'Checking calling…' : phone.config?.ready ? 'Ready when you call' : 'Calling setup needed'}</span><Button asChild variant="ghost" className="hidden h-11 sm:inline-flex"><Link to="/calls/settings"><Headphones className="h-4 w-4" />Audio & alerts</Link></Button><NewCallDialog initialFrom={defaultNumber?.phone_number} trigger={<Button disabled={!can('voice-calls', 'operate')} className="calls-primary h-11 rounded-xl px-4"><Plus className="h-4 w-4" />Call</Button>} /></div>
      </header>
      <div className="calls-shell-body">
        <nav aria-label="Calls navigation" className="calls-sidebar">
          <p className="calls-nav-caption">Workspace</p>
          {[...primary, ...manage.slice(0, 1)].map((item) => <Link className="calls-route" aria-current={active(item.to) ? 'page' : undefined} key={item.to} to={item.to}><item.icon className="h-4 w-4" />{item.label}</Link>)}
          <p className="calls-nav-caption mt-3">Manage</p>
          {manage.slice(1).map((item) => <Link className="calls-route" aria-current={active(item.to) ? 'page' : undefined} key={item.to} to={item.to}><item.icon className="h-4 w-4" />{item.label}</Link>)}
          <div className="mt-auto border-t border-[var(--calls-border)] pt-2">{help.map((item) => <Link className="calls-route" key={item.to} to={item.to}><item.icon className="h-4 w-4" />{item.label}</Link>)}</div>
        </nav>
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
      <nav className="calls-mobile-nav" aria-label="Calls mobile navigation">{primary.map((item) => <Link className="calls-route" aria-current={active(item.to) ? 'page' : undefined} key={item.to} to={item.to}><item.icon className="h-4 w-4" />{item.label}</Link>)}<DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="calls-route" data-active={moreActive} aria-label="More Calls pages"><MoreHorizontal className="h-4 w-4" />More</button></DropdownMenuTrigger><DropdownMenuContent align="end" side="top" className="calls-workspace mb-2 max-h-[70dvh] overflow-y-auto">{[...manage, ...help].map((item) => <DropdownMenuItem key={item.to} asChild><Link className="min-h-11" to={item.to}><item.icon className="mr-2 h-4 w-4" />{item.label}</Link></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></nav>
    </div>
  </DashboardLayout>;
}
