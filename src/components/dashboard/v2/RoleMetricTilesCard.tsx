import React from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { Card } from "./SharedComponents";
import styles from "./RoleMetricTilesCard.module.css";

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
  <Card className="hidden sm:flex flex-col gap-2 min-[1025px]:gap-4 flex-shrink-0 py-2.5 min-[1025px]:py-4">
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
      <div className="grid grid-cols-2 auto-rows-fr gap-1.5 min-[1025px]:gap-2">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={tile.onClick}
            className={cn(
              styles.tile,
              "group relative isolate overflow-hidden rounded-lg min-[1025px]:rounded-2xl border-x border-t border-b-0 border-border/60 p-1.5 min-[1025px]:p-3 text-left transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-white/10",
              tile.accent
                ? `bg-gradient-to-tr ${tile.accent}`
                : "bg-muted/50 text-foreground dark:bg-secondary",
            )}
          >
            <div
              aria-hidden="true"
              className={cn(styles.surfaceGloss, "pointer-events-none absolute inset-0")}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-black/8 dark:to-black/20"
            />
            <div
              aria-hidden="true"
              className={cn(styles.hoverSheen, "pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100 min-[1025px]:rounded-2xl")}
            />
            <div
              aria-hidden="true"
              className={cn(styles.hoverGlow, "pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100 min-[1025px]:rounded-2xl")}
            />
            <div className="relative z-10 flex items-center justify-between gap-2 min-[1025px]:hidden">
              <div className="min-w-0 flex-1 space-y-0">
                <p className="text-base font-bold tracking-tight text-foreground dark:text-white leading-tight">
                  {typeof tile.value === "number" ? tile.value.toLocaleString() : tile.value}
                </p>
                <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-tight text-foreground dark:text-white">
                  {tile.label}
                </p>
                {tile.subtitle ? (
                  <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-muted-foreground leading-snug dark:text-white/65">
                    {tile.subtitle}
                  </p>
                ) : null}
              </div>
              <div className={cn(styles.iconSurface, "inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/45 bg-white/10 text-foreground flex-shrink-0 backdrop-blur-md transition duration-300 group-hover:border-white/55 group-hover:bg-white/14 dark:border-white/20 dark:bg-white/10 dark:text-white dark:group-hover:border-white/24 dark:group-hover:bg-white/14")}>
                <span className={styles.iconGlyph}>{tile.icon}</span>
              </div>
            </div>
            <div className="relative z-10 hidden min-[1025px]:block">
              <div className="flex items-start justify-between gap-2">
                <div className={cn(styles.iconSurface, "inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-white/45 bg-white/10 text-foreground flex-shrink-0 backdrop-blur-md transition duration-300 group-hover:border-white/55 group-hover:bg-white/14 dark:border-white/20 dark:bg-white/10 dark:text-white dark:group-hover:border-white/24 dark:group-hover:bg-white/14")}>
                  <span className={styles.iconGlyph}>{tile.icon}</span>
                </div>
                <ArrowRight
                  size={14}
                  className="text-muted-foreground flex-shrink-0 transition duration-300 group-hover:text-foreground dark:text-white/60 dark:group-hover:text-white/80"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-2xl font-bold tracking-tight text-foreground dark:text-white leading-tight">
                  {typeof tile.value === "number" ? tile.value.toLocaleString() : tile.value}
                </p>
                <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-tight text-foreground dark:text-white">
                  {tile.label}
                </p>
                {tile.subtitle ? (
                  <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground leading-snug dark:text-white/65">
                    {tile.subtitle}
                  </p>
                ) : null}
              </div>
            </div>
          </button>
        ))}
      </div>
    ) : (
      <div className="text-center text-sm text-muted-foreground py-6">{emptyStateText}</div>
    )}
  </Card>
);
