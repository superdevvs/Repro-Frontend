import React, { useMemo, useState } from "react";
import {
  DollarSign,
  CheckCircle,
  CreditCard,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceData } from "@/utils/invoiceUtils";
import { cn } from "@/lib/utils";

/**
 * New: small SegmentedDays control (30 / 60 / 90)
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
      {opts.map((d, i) => {
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
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:bg-slate-700/60"
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

interface OverviewCardsProps {
  invoices: InvoiceData[];
  // optional legacy timeFilter you had — kept but not used for the 30/60/90 filter UI
  timeFilter?: "day" | "week" | "month" | "quarter" | "year";
}

export function OverviewCards({ invoices, timeFilter }: OverviewCardsProps) {
  // selected days window for Outstanding Invoices (default 30)
  const [daysWindow, setDaysWindow] = useState<number>(30);

  // helper to get date from invoice (attempt common fields)
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

  // basic totals (global - not filtered) — kept for other cards
  const totalRevenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount || 0), 0);

  const pendingInvoicesAll = invoices.filter((i) => i.status === "pending");
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const paidInvoices = invoices.filter((i) => i.status === "paid");

  // filter pending invoices by selected daysWindow (if invoice has a date)
  const pendingInvoicesFiltered = useMemo(() => {
    const now = new Date();
    return pendingInvoicesAll.filter((inv) => {
      const d = getInvoiceDate(inv);
      if (!d) {
        // if invoice has no date field, include it (fallback)
        return true;
      }
      return daysBetween(d) <= daysWindow;
    });
  }, [pendingInvoicesAll, daysWindow]);

  const pendingTotal = pendingInvoicesFiltered.reduce(
    (s, i) => s + Number(i.amount || 0),
    0
  );

  const overdueTotal = overdueInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const paidTotal = paidInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);

  // fake trend data (you can replace with real)
  const trends = {
    revenue: { value: 8.2, direction: "up" as const },
    pending: { value: -2.5, direction: "down" as const },
    overdue: { value: 4.1, direction: "up" as const },
    paid: { value: 12.5, direction: "up" as const },
  };

  return (
    <div className="space-y-4">
      {/* Segmented control row — aligned to Outstanding Invoices visually */}
      <div className="flex items-center justify-end gap-4">
        {/* <div className="text-sm text-muted-foreground">Outstanding window:</div> */}
        <SegmentedDays value={daysWindow} onChange={setDaysWindow} />
        <div className="ml-3 text-sm text-slate-600 dark:text-slate-400">Showing last {daysWindow} days</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <OverviewCard
          title="Total Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          description={`Current ${timeFilter ?? "period"}`}
          icon={<DollarSign className="h-4 w-4" />}
          trend={trends.revenue}
          color="blue"
          animated={true}
        />

        <OverviewCard
          title={`Outstanding Invoices (last ${daysWindow}d)`}
          value={`$${pendingTotal.toLocaleString()}`}
          description={`${pendingInvoicesFiltered.length} invoice${pendingInvoicesFiltered.length !== 1 ? "s" : ""}`}
          icon={<CreditCard className="h-4 w-4" />}
          trend={trends.pending}
          color="amber"
          animated={true}
        />

        <OverviewCard
          title="Paid"
          value={`$${paidTotal.toLocaleString()}`}
          description={`${paidInvoices.length} invoice${paidInvoices.length !== 1 ? "s" : ""}`}
          icon={<CheckCircle className="h-4 w-4" />}
          trend={trends.paid}
          color="emerald"
          animated={true}
        />
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
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{title}</p>
            <h3 className="text-2xl font-semibold tracking-tight">{value}</h3>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-xs text-slate-600 dark:text-slate-400">{description}</p>
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

export default OverviewCards;
