import type React from "react";

import { TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { DASHBOARD_MOBILE_TAB_TRIGGER_CLASS } from "../utils/dashboardMobilePanel";

type DashboardTabIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

/**
 * Mobile section tab. Inactive tabs are icon-only; the active tab keeps
 * icon + label. Tabs without an icon stay label-only (unchanged).
 * aria-label keeps the accessible name when the visible label is hidden.
 */
export function DashboardMobileTabTrigger({
  value,
  label,
  icon: Icon,
}: {
  value: string;
  label: string;
  icon?: DashboardTabIcon;
}) {
  return (
    <TabsTrigger
      value={value}
      aria-label={Icon ? label : undefined}
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
        </>
      ) : (
        label
      )}
    </TabsTrigger>
  );
}
