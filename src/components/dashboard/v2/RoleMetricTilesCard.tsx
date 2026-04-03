import React from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { Card } from "./SharedComponents";

export type DashboardMetricTile = {
  id: string;
  value: number | string;
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
  accent?: string;
  onClick?: () => void;
};

interface RoleMetricTilesCardProps {
  tiles: DashboardMetricTile[];
  title?: string;
  eyebrow?: string;
  emptyStateText?: string;
}

export const RoleMetricTilesCard: React.FC<RoleMetricTilesCardProps> = ({
  tiles,
  title,
  eyebrow,
  emptyStateText = "No metrics available right now.",
}) => (
  <Card className="hidden sm:flex flex-col gap-2.5 sm:gap-4 flex-shrink-0">
    {title || eyebrow ? (
      <div>
        {eyebrow && (
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-muted-foreground font-semibold">
            {eyebrow}
          </p>
        )}
        {title ? <h2 className="text-base sm:text-lg font-bold text-foreground">{title}</h2> : null}
      </div>
    ) : null}
    {tiles.length > 0 ? (
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={tile.onClick}
            className={cn(
              "group relative isolate overflow-hidden rounded-lg sm:rounded-2xl border-x border-t border-b-0 border-border/60 p-2.5 sm:p-3 text-left transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_16px_32px_rgba(148,163,184,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-white/10 dark:hover:shadow-[0_18px_42px_rgba(2,6,23,0.34)]",
              tile.accent
                ? `bg-gradient-to-tr ${tile.accent}`
                : "bg-muted/50 text-foreground dark:bg-secondary",
            )}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.08)_24%,rgba(255,255,255,0)_58%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.04)_24%,rgba(255,255,255,0)_58%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-black/8 dark:to-black/20"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:rounded-2xl bg-[linear-gradient(140deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.07)_26%,rgba(255,255,255,0)_52%)] dark:bg-[linear-gradient(140deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.05)_26%,rgba(255,255,255,0)_52%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:rounded-2xl bg-[radial-gradient(circle_at_14%_12%,rgba(255,255,255,0.16),transparent_34%)] dark:bg-[radial-gradient(circle_at_14%_12%,rgba(255,255,255,0.08),transparent_36%)]"
            />
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-2xl border border-white/45 bg-white/10 text-foreground flex-shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-md transition duration-300 group-hover:border-white/55 group-hover:bg-white/14 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_14px_28px_rgba(15,23,42,0.12)] dark:border-white/20 dark:bg-white/10 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(2,6,23,0.22)] dark:group-hover:border-white/24 dark:group-hover:bg-white/14 dark:group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_14px_28px_rgba(2,6,23,0.28)]">
                <span className="drop-shadow-[0_1px_1px_rgba(255,255,255,0.12)] dark:drop-shadow-none">{tile.icon}</span>
              </div>
              <ArrowRight
                size={14}
                className="text-muted-foreground flex-shrink-0 hidden transition duration-300 group-hover:text-foreground sm:block dark:text-white/60 dark:group-hover:text-white/80"
                aria-hidden="true"
              />
            </div>
            <div className="relative z-10 mt-2 sm:mt-3 space-y-0.5 sm:space-y-1">
              <p className="text-lg sm:text-2xl font-bold tracking-tight text-foreground dark:text-white">
                {typeof tile.value === "number" ? tile.value.toLocaleString() : tile.value}
              </p>
              <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] sm:text-sm font-semibold leading-tight text-foreground dark:text-white">
                {tile.label}
              </p>
              {tile.subtitle ? (
                <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[9px] sm:text-xs text-muted-foreground leading-snug dark:text-white/65">
                  {tile.subtitle}
                </p>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    ) : (
      <div className="text-center text-sm text-muted-foreground py-6">{emptyStateText}</div>
    )}
  </Card>
);
