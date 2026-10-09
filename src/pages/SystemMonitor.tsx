import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { hasMonitorRole } from '@/features/server-monitor/client';
import OverviewWithServer from '@/features/server-monitor/OverviewWithServer';

export default function SystemMonitor() {
  const { user, role, isImpersonating } = useAuth();
  if (isImpersonating || !hasMonitorRole(role || user?.role, user?.secondary_roles)) return <Navigate to="/settings" replace />;
  return <DashboardLayout><div className="space-y-4">
    <PageHeader title="System Monitor" description="Application activity and server health." compactTitleOnMobile
      action={<Link to="/settings" className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="h-4 w-4" />Settings</Link>} />
    <OverviewWithServer />
  </div></DashboardLayout>;
}
