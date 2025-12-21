import React from 'react';
import { Calendar, Bell, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { DashboardStats } from '@/types/dashboard';
import { StatBadge, Card } from './SharedComponents';

interface DashboardHeaderProps {
  stats?: DashboardStats;
  onRefresh?: () => void;
  loading?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  stats,
  onRefresh,
  loading,
}) => {
  const { user } = useAuth();

  return (
    <header className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Card className="p-0 w-12 h-12 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold border-none shadow-lg shadow-primary/30">
            EM
          </Card>
          <div>
            <p className="text-[11px] uppercase tracking-[0.5em] text-muted-foreground font-semibold">
              Control Center
            </p>
            <h1 className="text-2xl font-bold text-foreground">Shoot Operations</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search shoots, clients, addresses..."
              className="pl-12 pr-4 py-2.5 rounded-full border border-border bg-muted/60 text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none min-w-[280px]"
            />
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors bg-card"
          >
            <Calendar className="text-primary" size={16} />
            Today, {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </button>
          <button
            className="relative w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
          >
            <Bell size={18} />
            <span className="absolute top-3 right-2 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-card" />
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-border/50">
            <div className="text-right">
              <p className="text-xs font-semibold text-foreground">{user?.name}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="flex flex-col gap-2 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-transparent shadow-xl dark:from-card dark:to-card">
            <StatBadge label="Active Shoots" value={stats.totalShoots} accent="#fff" />
            <p className="text-sm text-white/70 dark:text-muted-foreground/80">Includes on-hold and scheduled</p>
          </Card>
          <Card className="flex flex-col gap-2">
            <StatBadge label="Scheduled Today" value={stats.scheduledToday} />
            <p className="text-sm text-muted-foreground">Ready for dispatch</p>
          </Card>
          <Card className="flex flex-col gap-2">
            <StatBadge label="Pending Review" value={stats.pendingReviews} />
            <p className="text-sm text-muted-foreground">Awaiting QC checks</p>
          </Card>
          <Card className="flex flex-col gap-2">
            <StatBadge label="Flagged" value={stats.flaggedShoots} accent="var(--destructive)" />
            <p className="text-sm text-muted-foreground">Issues needing attention</p>
          </Card>
        </div>
      )}
    </header>
  );
};

