import React, { useMemo } from "react";
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

export const DAYS_WINDOW_OPTIONS = [30, 60, 90, 365] as const;

export function SegmentedDays({
  value,
  onChange,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {DAYS_WINDOW_OPTIONS.map((d) => {
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
            {d}d
          </button>
        );
      })}
    </div>
  );
}

interface OverviewCardsProps {
  invoices: InvoiceData[];
  timeFilter?: "day" | "week" | "month" | "quarter" | "year";
  leftElement?: React.ReactNode;
  daysWindow?: number;
}

const parseInvoiceDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const getInvoiceWindowDate = (invoice: InvoiceData): Date | null => {
  const legacyInvoice = invoice as InvoiceData & Record<string, unknown>;
  const candidates =
    invoice.status === "paid"
      ? [
          invoice.paidAt,
          legacyInvoice.paid_at,
          legacyInvoice.updated_at,
          legacyInvoice.updatedAt,
          invoice.issueDate,
          invoice.date,
          invoice.createdAt,
          legacyInvoice.created_at,
        ]
      : [
          invoice.dueDate,
          invoice.issueDate,
          invoice.date,
          invoice.createdAt,
          legacyInvoice.created_at,
        ];

  for (const candidate of candidates) {
    const parsed = parseInvoiceDate(candidate);
    if (parsed) return parsed;
  }

  return null;
};

const isWithinDaysWindow = (date: Date, daysWindow: number) => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (daysWindow - 1));

  return date >= start && date <= end;
};

export function OverviewCards({ invoices, timeFilter, leftElement, daysWindow = 30 }: OverviewCardsProps) {
  const windowedInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const invoiceDate = getInvoiceWindowDate(invoice);
        return invoiceDate ? isWithinDaysWindow(invoiceDate, daysWindow) : true;
      }),
    [invoices, daysWindow]
  );

  const revenueInvoices = windowedInvoices.filter((invoice) => invoice.status === "paid");
  const outstandingInvoices = windowedInvoices.filter(
    (invoice) => invoice.status === "pending" || invoice.status === "overdue"
  );
  const paidInvoices = windowedInvoices.filter((invoice) => invoice.status === "paid");

  const totalRevenue = revenueInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.amountPaid ?? invoice.amount ?? 0),
    0
  );
  const pendingTotal = outstandingInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.balance ?? invoice.amount ?? 0),
    0
  );
  const paidTotal = paidInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.amountPaid ?? invoice.amount ?? 0),
    0
  );

  // fake trend data (you can replace with real)
  const trends = {
    revenue: { value: 8.2, direction: "up" as const },
    pending: { value: -2.5, direction: "down" as const },
    overdue: { value: 4.1, direction: "up" as const },
    paid: { value: 12.5, direction: "up" as const },
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <OverviewCard
          title="Total Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          description={`${revenueInvoices.length} paid invoice${revenueInvoices.length !== 1 ? "s" : ""} in last ${daysWindow} days`}
          icon={<DollarSign className="h-4 w-4" />}
          trend={trends.revenue}
          color="blue"
          animated={true}
        />

        <OverviewCard
          title={`Outstanding Invoices (last ${daysWindow}d)`}
          value={`$${pendingTotal.toLocaleString()}`}
          description={`${outstandingInvoices.length} invoice${outstandingInvoices.length !== 1 ? "s" : ""}`}
          icon={<CreditCard className="h-4 w-4" />}
          trend={trends.pending}
          color="amber"
          animated={true}
        />

        <OverviewCard
          title={`Paid (last ${daysWindow}d)`}
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
