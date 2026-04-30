import React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DashboardShootSummary } from "@/types/dashboard";

import { getClientPaymentBadgeInfo } from "../utils";

export const ClientPaymentPill: React.FC<{
  status: DashboardShootSummary["paymentStatus"] | null | undefined;
  overlay?: boolean;
  className?: string;
}> = ({ status, overlay = false, className }) => {
  const badge = getClientPaymentBadgeInfo(status);

  return (
    <Badge
      className={cn(
        "border font-semibold",
        overlay
          ? "backdrop-blur-sm text-[9px] h-4 px-1.5"
          : "text-[10px] sm:text-[11px] h-6 px-2.5",
        overlay ? badge.overlayClassName : badge.defaultClassName,
        className,
      )}
    >
      {badge.label}
    </Badge>
  );
};
