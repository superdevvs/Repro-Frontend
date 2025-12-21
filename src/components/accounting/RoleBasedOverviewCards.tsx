import React, { useMemo, useState } from "react";
import {
  DollarSign,
  CheckCircle,
  CreditCard,
  ChevronUp,
  ChevronDown,
  Clock,
  Camera,
  TrendingUp,
  Calendar,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceData } from "@/utils/invoiceUtils";
import { cn } from "@/lib/utils";
import { AccountingMode } from "@/config/accountingConfig";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * SegmentedDays control (30 / 60 / 90)
 */
function SegmentedDays({
  value,
  onChange,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  const opts = [30, 60, 90];
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {opts.map((d) => {
        const active = d === value;
        return (
          <button
            key={d}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(d)}
            className={cn(
              "text-sm px-3 py-1 rounded-md transition focus:outline-none focus:ring-2 focus:ring-offset-1",
              active
                ? "bg-blue-500 text-white shadow-md ring-blue-400"
                : "bg-white/5 text-white/90 hover:bg-white/10 dark:bg-slate-800/40 dark:hover:bg-slate-700/60"
            )}
            style={{ minWidth: 44 }}
          >
            {d === 30 ? "30d" : d === 60 ? "60d" : "90d"}
          </button>
        );
      })}
    </div>
  );
}

interface RoleBasedOverviewCardsProps {
  invoices: InvoiceData[];
  mode: AccountingMode;
  timeFilter?: "day" | "week" | "month" | "quarter" | "year";
  // Role-specific data
  shoots?: any[];
  editingJobs?: any[];
}

export function RoleBasedOverviewCards({ 
  invoices, 
  mode, 
  timeFilter,
  shoots = [],
  editingJobs = [],
}: RoleBasedOverviewCardsProps) {
  const { user } = useAuth();
  const [daysWindow, setDaysWindow] = useState<number>(30);

  // Helper to get date from invoice
  const getInvoiceDate = (inv: any): Date | null => {
    const maybe = inv.dueDate ?? inv.date ?? inv.createdAt ?? inv.created_at;
    if (!maybe) return null;
    const d = new Date(maybe);
    return isNaN(d.getTime()) ? null : d;
  };

  const daysBetween = (d: Date) => {
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // Calculate metrics based on mode
  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    switch (mode) {
      case 'admin': {
        const totalRevenue = invoices
          .filter((i) => i.status === "paid")
          .reduce((s, i) => s + Number(i.amount || 0), 0);

        const pendingInvoicesAll = invoices.filter((i) => i.status === "pending");
        const pendingInvoicesFiltered = pendingInvoicesAll.filter((inv) => {
          const d = getInvoiceDate(inv);
          if (!d) return true;
          return daysBetween(d) <= daysWindow;
        });

        const pendingTotal = pendingInvoicesFiltered.reduce(
          (s, i) => s + Number(i.amount || 0),
          0
        );

        const paidInvoices = invoices.filter((i) => i.status === "paid");
        const paidTotal = paidInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);

        return {
          totalRevenue: { value: totalRevenue, count: paidInvoices.length },
          outstanding: { value: pendingTotal, count: pendingInvoicesFiltered.length },
          paid: { value: paidTotal, count: paidInvoices.length },
        };
      }

      case 'photographer': {
        // Filter shoots for this photographer
        const myShoots = shoots.filter((s: any) => s.photographer_id === user?.id || s.photographerId === user?.id);
        const completedThisMonth = myShoots.filter((s: any) => {
          const completed = s.completed_at || s.completedAt;
          if (!completed) return false;
          const d = new Date(completed);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const totalEarnings = completedThisMonth.reduce((sum: number, s: any) => {
          // Use photographer pay from services (automatically calculated)
          const photographerPay = s.photographerPay || s.totalPhotographerPay || s.photographer_fee || s.photographerFee || 0;
          return sum + Number(photographerPay);
        }, 0);

        const pendingPayouts = myShoots
          .filter((s: any) => {
            const status = s.payout_status || s.payoutStatus || s.payment_status || s.paymentStatus;
            return (s.completed_at || s.completedAt) && (status === 'pending' || status === 'unpaid');
          })
          .reduce((sum: number, s: any) => {
            // Use photographer pay from services (automatically calculated)
            const photographerPay = s.photographerPay || s.totalPhotographerPay || s.photographer_fee || s.photographerFee || 0;
            return sum + Number(photographerPay);
          }, 0);

        const avgShootValue = completedThisMonth.length > 0 
          ? totalEarnings / completedThisMonth.length 
          : 0;

        return {
          totalEarnings: { value: totalEarnings, count: completedThisMonth.length },
          pendingPayouts: { value: pendingPayouts, count: 0 },
          shootsCompleted: { value: completedThisMonth.length, count: 0 },
          avgShootValue: { value: avgShootValue, count: 0 },
        };
      }

      case 'editor': {
        // Filter editing jobs for this editor
        const myJobs = editingJobs.filter((j: any) => j.editor_id === user?.id || j.editorId === user?.id);
        const completedThisMonth = myJobs.filter((j: any) => {
          const completed = j.completed_at || j.completedAt;
          if (!completed) return false;
          const d = new Date(completed);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const totalEarnings = completedThisMonth.reduce((sum: number, j: any) => {
          return sum + (Number(j.pay || j.payAmount || 0));
        }, 0);

        const pendingPayouts = myJobs
          .filter((j: any) => {
            const status = j.payout_status || j.payoutStatus;
            return (j.completed_at || j.completedAt) && (status === 'pending' || status === 'unpaid');
          })
          .reduce((sum: number, j: any) => {
            return sum + (Number(j.pay || j.payAmount || 0));
          }, 0);

        const avgPayPerJob = completedThisMonth.length > 0 
          ? totalEarnings / completedThisMonth.length 
          : 0;

        return {
          totalEarnings: { value: totalEarnings, count: completedThisMonth.length },
          pendingPayouts: { value: pendingPayouts, count: 0 },
          editsCompleted: { value: completedThisMonth.length, count: 0 },
          avgPayPerJob: { value: avgPayPerJob, count: 0 },
        };
      }

      case 'client': {
        // Filter invoices for this client
        const myInvoices = invoices.filter((i) => i.client === user?.name || i.client_id === user?.id);
        
        const outstandingBalance = myInvoices
          .filter((i) => i.status === "pending" || i.status === "overdue")
          .reduce((s, i) => s + Number(i.amount || 0), 0);

        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);
        const paidLast30Days = myInvoices
          .filter((i) => {
            if (i.status !== "paid") return false;
            const d = getInvoiceDate(i);
            return d && d >= last30Days;
          })
          .reduce((s, i) => s + Number(i.amount || 0), 0);

        const totalSpend = myInvoices
          .filter((i) => {
            if (i.status !== "paid") return false;
            const d = getInvoiceDate(i);
            return d && d.getFullYear() === currentYear;
          })
          .reduce((s, i) => s + Number(i.amount || 0), 0);

        const upcomingCharges = myInvoices
          .filter((i) => i.status === "pending")
          .reduce((s, i) => s + Number(i.amount || 0), 0);

        return {
          outstandingBalance: { value: outstandingBalance, count: 0 },
          paidLast30Days: { value: paidLast30Days, count: 0 },
          totalSpend: { value: totalSpend, count: 0 },
          upcomingCharges: { value: upcomingCharges, count: 0 },
        };
      }

      case 'rep': {
        // Filter invoices for clients assigned to this rep
        const myClientInvoices = invoices.filter((i) => {
          // This would need to check rep assignment - for now, using a simple filter
          // In real implementation, you'd check i.rep_id === user?.id
          return true; // Placeholder
        });

        const totalRevenue = myClientInvoices
          .filter((i) => {
            const d = getInvoiceDate(i);
            return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
          })
          .reduce((s, i) => s + Number(i.amount || 0), 0);

        const outstanding = myClientInvoices
          .filter((i) => i.status === "pending" || i.status === "overdue")
          .reduce((s, i) => s + Number(i.amount || 0), 0);

        // Commission calculation (placeholder - would need actual commission rate)
        const commission = totalRevenue * 0.1; // 10% placeholder

        const newClients = 0; // Would need to calculate from client data

        return {
          totalRevenue: { value: totalRevenue, count: 0 },
          outstanding: { value: outstanding, count: 0 },
          commission: { value: commission, count: 0 },
          newClients: { value: newClients, count: 0 },
        };
      }

      default:
        return {};
    }
  }, [mode, invoices, shoots, editingJobs, user, daysWindow]);

  // Fake trend data (replace with real data)
  const trends = {
    revenue: { value: 8.2, direction: "up" as const },
    pending: { value: -2.5, direction: "down" as const },
    overdue: { value: 4.1, direction: "up" as const },
    paid: { value: 12.5, direction: "up" as const },
  };

  // Render cards based on mode
  const renderCards = () => {
    switch (mode) {
      case 'admin':
        return (
          <>
            <OverviewCard
              title="Total Revenue"
              value={`$${metrics.totalRevenue?.value.toLocaleString() || 0}`}
              description={`Current ${timeFilter ?? "period"}`}
              icon={<DollarSign className="h-4 w-4" />}
              trend={trends.revenue}
              color="blue"
              animated={true}
            />
            <OverviewCard
              title={`Outstanding Invoices (last ${daysWindow}d)`}
              value={`$${metrics.outstanding?.value.toLocaleString() || 0}`}
              description={`${metrics.outstanding?.count || 0} invoice${(metrics.outstanding?.count || 0) !== 1 ? "s" : ""}`}
              icon={<CreditCard className="h-4 w-4" />}
              trend={trends.pending}
              color="amber"
              animated={true}
            />
            <OverviewCard
              title="Paid"
              value={`$${metrics.paid?.value.toLocaleString() || 0}`}
              description={`${metrics.paid?.count || 0} invoice${(metrics.paid?.count || 0) !== 1 ? "s" : ""}`}
              icon={<CheckCircle className="h-4 w-4" />}
              trend={trends.paid}
              color="emerald"
              animated={true}
            />
          </>
        );

      case 'photographer':
        return (
          <>
            <OverviewCard
              title="Total Earnings (This Month)"
              value={`$${metrics.totalEarnings?.value.toLocaleString() || 0}`}
              description="Completed shoots"
              icon={<DollarSign className="h-4 w-4" />}
              trend={trends.revenue}
              color="blue"
              animated={true}
            />
            <OverviewCard
              title="Pending Payouts"
              value={`$${metrics.pendingPayouts?.value.toLocaleString() || 0}`}
              description="Awaiting payment"
              icon={<Clock className="h-4 w-4" />}
              trend={trends.pending}
              color="amber"
              animated={true}
            />
            <OverviewCard
              title="Shoots Completed (This Month)"
              value={`${metrics.shootsCompleted?.value || 0}`}
              description="Total completed"
              icon={<Camera className="h-4 w-4" />}
              trend={trends.paid}
              color="emerald"
              animated={true}
            />
            <OverviewCard
              title="Average Shoot Value"
              value={`$${Math.round(metrics.avgShootValue?.value || 0).toLocaleString()}`}
              description="Per shoot"
              icon={<TrendingUp className="h-4 w-4" />}
              trend={trends.revenue}
              color="blue"
              animated={true}
            />
          </>
        );

      case 'editor':
        return (
          <>
            <OverviewCard
              title="Total Editing Earnings (This Month)"
              value={`$${metrics.totalEarnings?.value.toLocaleString() || 0}`}
              description="Completed jobs"
              icon={<DollarSign className="h-4 w-4" />}
              trend={trends.revenue}
              color="blue"
              animated={true}
            />
            <OverviewCard
              title="Pending Editing Payouts"
              value={`$${metrics.pendingPayouts?.value.toLocaleString() || 0}`}
              description="Awaiting payment"
              icon={<Clock className="h-4 w-4" />}
              trend={trends.pending}
              color="amber"
              animated={true}
            />
            <OverviewCard
              title="Edits Completed"
              value={`${metrics.editsCompleted?.value || 0}`}
              description="This month"
              icon={<CheckCircle className="h-4 w-4" />}
              trend={trends.paid}
              color="emerald"
              animated={true}
            />
            <OverviewCard
              title="Average Pay per Job"
              value={`$${Math.round(metrics.avgPayPerJob?.value || 0).toLocaleString()}`}
              description="Per job"
              icon={<TrendingUp className="h-4 w-4" />}
              trend={trends.revenue}
              color="blue"
              animated={true}
            />
          </>
        );

      case 'client':
        return (
          <>
            <OverviewCard
              title="Outstanding Balance"
              value={`$${metrics.outstandingBalance?.value.toLocaleString() || 0}`}
              description="Unpaid invoices"
              icon={<CreditCard className="h-4 w-4" />}
              trend={trends.pending}
              color="amber"
              animated={true}
            />
            <OverviewCard
              title="Paid (Last 30 Days)"
              value={`$${metrics.paidLast30Days?.value.toLocaleString() || 0}`}
              description="Recent payments"
              icon={<CheckCircle className="h-4 w-4" />}
              trend={trends.paid}
              color="emerald"
              animated={true}
            />
            <OverviewCard
              title="Total Spend (This Year)"
              value={`$${metrics.totalSpend?.value.toLocaleString() || 0}`}
              description="All payments"
              icon={<DollarSign className="h-4 w-4" />}
              trend={trends.revenue}
              color="blue"
              animated={true}
            />
            <OverviewCard
              title="Upcoming Charges"
              value={`$${metrics.upcomingCharges?.value.toLocaleString() || 0}`}
              description="Pending invoices"
              icon={<Calendar className="h-4 w-4" />}
              trend={trends.pending}
              color="rose"
              animated={true}
            />
          </>
        );

      case 'rep':
        return (
          <>
            <OverviewCard
              title="Total Revenue (This Month - My Clients)"
              value={`$${metrics.totalRevenue?.value.toLocaleString() || 0}`}
              description="From my clients"
              icon={<DollarSign className="h-4 w-4" />}
              trend={trends.revenue}
              color="blue"
              animated={true}
            />
            <OverviewCard
              title="Outstanding Invoices (My Clients)"
              value={`$${metrics.outstanding?.value.toLocaleString() || 0}`}
              description="Unpaid"
              icon={<CreditCard className="h-4 w-4" />}
              trend={trends.pending}
              color="amber"
              animated={true}
            />
            <OverviewCard
              title="Commission (This Month)"
              value={`$${metrics.commission?.value.toLocaleString() || 0}`}
              description="Earned"
              icon={<TrendingUp className="h-4 w-4" />}
              trend={trends.paid}
              color="emerald"
              animated={true}
            />
            <OverviewCard
              title="New Clients (This Month)"
              value={`${metrics.newClients?.value || 0}`}
              description="Added"
              icon={<Users className="h-4 w-4" />}
              trend={trends.revenue}
              color="blue"
              animated={true}
            />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {mode === 'admin' && (
        <div className="flex items-center justify-end gap-4">
          <SegmentedDays value={daysWindow} onChange={setDaysWindow} />
          <div className="ml-3 text-sm text-slate-400">Showing last {daysWindow} days</div>
        </div>
      )}

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${mode === 'admin' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
        {renderCards()}
      </div>
    </div>
  );
}

interface OverviewCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  color?: "blue" | "emerald" | "amber" | "rose";
  animated?: boolean;
}

function OverviewCard({
  title,
  value,
  description,
  icon,
  trend,
  color = "blue",
  animated = false,
}: OverviewCardProps) {
  const colorStyles = {
    blue: {
      iconBg: "bg-blue-500/10",
      iconText: "text-blue-500",
      trendUp: "text-blue-600",
      trendDown: "text-blue-600 opacity-80",
    },
    emerald: {
      iconBg: "bg-emerald-500/10",
      iconText: "text-emerald-500",
      trendUp: "text-emerald-600",
      trendDown: "text-emerald-600 opacity-80",
    },
    amber: {
      iconBg: "bg-amber-500/10",
      iconText: "text-amber-500",
      trendUp: "text-amber-600",
      trendDown: "text-amber-600 opacity-80",
    },
    rose: {
      iconBg: "bg-rose-500/10",
      iconText: "text-rose-500",
      trendUp: "text-rose-600",
      trendDown: "text-rose-600 opacity-80",
    },
  };

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all border",
        animated && "hover:shadow-md hover:-translate-y-0.5"
      )}
    >
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <h3 className="text-2xl font-semibold tracking-tight">{value}</h3>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-xs text-muted-foreground">{description}</p>
              {trend && (
                <div
                  className={cn(
                    "flex items-center text-xs font-medium gap-1",
                    trend.direction === "up"
                      ? colorStyles[color].trendUp
                      : colorStyles[color].trendDown
                  )}
                >
                  {trend.direction === "up" ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {Math.abs(trend.value)}%
                </div>
              )}
            </div>
          </div>

          <div
            className={cn(
              "h-8 w-8 rounded-md flex items-center justify-center",
              colorStyles[color].iconBg,
              colorStyles[color].iconText
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default RoleBasedOverviewCards;


