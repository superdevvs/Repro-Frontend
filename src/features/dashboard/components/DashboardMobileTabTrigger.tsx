import type React from "react";

import { TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { DASHBOARD_MOBILE_TAB_TRIGGER_CLASS } from "../utils/dashboardMobilePanel";

type DashboardTabIcon = React.ComponentType<{ className?: string; "aria-hidden"?: React.AriaAttributes['aria-hidden'] }>;

function formatTabCount(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

/**
 * Mobile section tab. Inactive tabs are icon-only (+ count badge when set);
 * the active tab keeps icon + label + count. Tabs without an icon stay
 * label-only (unchanged). aria-label keeps the accessible name when the
 * visible label is hidden.
 */
export function DashboardMobileTabTrigger({
  value,
  label,
  icon: Icon,
  count,
}: {
  value: string;
  label: string;
  icon?: DashboardTabIcon;
  /** When > 0, shown on both active and inactive (icon-only) tabs. */
  count?: number;
}) {
  const showCount = typeof count === "number" && count > 0;
  const countLabel = showCount ? formatTabCount(count) : null;
  const ariaLabel = Icon
    ? showCount
      ? `${label}, ${count}`
      : label
    : undefined;

  return (
    <TabsTrigger
      value={value}
      aria-label={ariaLabel}
      className={cn(
        DASHBOARD_MOBILE_TAB_TRIGGER_CLASS,
        Icon && "group px-2.5 group-data-[state=active]:px-3",
      )}
    >
      {Icon ? (
        <>
          <Icon
            className="h-3.5 w-3.5 shrink-0 group-data-[state=active]:mr-1.5"
            aria-hidden
          />
          <span className="hidden group-data-[state=active]:inline">{label}</span>
          {countLabel ? (
            <span
              className={cn(
                "ml-1 inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none tabular-nums",
                // Inactive icon-only: primary badge stays visible without the label.
                // Active (primary fill): soft invert so the badge reads on the pill.
                "bg-primary text-primary-foreground group-data-[state=active]:bg-primary-foreground/25 group-data-[state=active]:text-primary-foreground",
              )}
            >
              {countLabel}
            </span>
          ) : null}
        </>
      ) : (
        <>
          {label}
          {countLabel ? (
            <span className="ml-1 inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none tabular-nums text-primary-foreground group-data-[state=active]:bg-primary-foreground/25 group-data-[state=active]:text-primary-foreground">
              {countLabel}
            </span>
          ) : null}
        </>
      )}
    </TabsTrigger>
  );
}
