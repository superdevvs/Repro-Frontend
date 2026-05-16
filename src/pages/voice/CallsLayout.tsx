import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  Bot,
  BriefcaseBusiness,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Hash,
  PhoneCall,
  RefreshCw,
  Settings,
  UserPlus,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CallsOverview from './CallsOverview';
import CallsLog from './CallsLog';
import CallsAssistant from './CallsAssistant';
import CallsNumbers from './CallsNumbers';
import CallsAutomations from './CallsAutomations';
import CallsSettings from './CallsSettings';

const tabs = [
  { to: '/calls/overview', label: 'Overview', icon: PhoneCall },
  { to: '/calls/log', label: 'Call Log', icon: ClipboardList },
  { to: '/calls/assistant', label: 'AI Assistant', icon: Bot },
  { to: '/calls/numbers', label: 'Numbers', icon: Hash },
  { to: '/calls/automations', label: 'Automations', icon: Workflow },
  { to: '/calls/settings', label: 'Settings', icon: Settings },
];

export default function CallsLayout() {
  const { pathname } = useLocation();

  return (
    <DashboardLayout>
      <div className="min-w-0 bg-background pb-24 text-foreground sm:pb-6">
        <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3 text-card-foreground xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-primary" />
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Calls</h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage all voice calls, Robbie conversations, transcripts, recordings, and follow-ups.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="h-8 gap-2 border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Voice Service: Connected
            </Badge>
            <Button size="sm" variant="outline" className="h-8 rounded-md px-3 text-xs">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" variant="outline" className="h-8 rounded-md px-3 text-xs">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Process
            </Button>
            <Button size="sm" variant="outline" className="h-8 rounded-md px-3 text-xs">
              <UserPlus className="mr-2 h-4 w-4" />
              Assign
            </Button>
            <Button size="sm" variant="outline" className="h-8 rounded-md px-3 text-xs">
              <BriefcaseBusiness className="mr-2 h-4 w-4" />
              Convert To
              <ChevronDown className="ml-2 h-3.5 w-3.5" />
            </Button>
            <Button asChild size="sm" className="h-8 rounded-md px-4 text-xs shadow-sm">
              <Link to="/calls/log">
                <PhoneCall className="mr-2 h-4 w-4" />
                Make Test Call
              </Link>
            </Button>
          </div>
        </div>

        <nav className="flex gap-6 overflow-x-auto border-b border-border bg-card px-4 text-card-foreground">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 sm:px-4">
          <Routes>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<CallsOverview />} />
            <Route path="log" element={<CallsLog />} />
            <Route path="assistant" element={<CallsAssistant />} />
            <Route path="numbers" element={<CallsNumbers />} />
            <Route path="automations" element={<CallsAutomations />} />
            <Route path="settings" element={<CallsSettings />} />
          </Routes>
        </div>
      </div>
    </DashboardLayout>
  );
}
