import React from "react";

import { cn } from "@/lib/utils";

interface CollapsibleColumnHandleProps {
  /** Which side of the center column this handle sits on. */
  side: "left" | "right";
  /** Effective hidden state of the column this handle controls. */
  hidden: boolean;
  /** True while the handle is briefly hidden after a toggle (animation settle). */
  settling: boolean;
  /** Toggle callback. */
  onToggle: () => void;
  /** Optional indicator badge count (used by the right "requests" handle). */
  indicatorCount?: number;
}

/**
 * The hover-revealed pill button that collapses/expands a dashboard side
 * column. It is positioned absolutely against the center column's edge so it
 * always sits centered in the column gap regardless of viewport width.
 *
 * Per-side class strings are written out in full so Tailwind's JIT scanner can
 * see the dynamic group-hover variants (`group-hover/left-handle`,
 * `group-hover/right-handle`).
 */
export const CollapsibleColumnHandle: React.FC<CollapsibleColumnHandleProps> = ({
  side,
  hidden,
  settling,
  onToggle,
  indicatorCount = 0,
}) => {
  const hasIndicator = indicatorCount > 0;

  if (side === "left") {
    return (
      <div
        style={{ visibility: settling ? "hidden" : "visible" }}
        className={cn(
          "group/left-handle absolute -left-6 bottom-0 top-0 z-10 hidden w-6 items-start justify-center pt-2 md:flex",
          settling && "pointer-events-none !opacity-0",
        )}
      >
        <button
          type="button"
          aria-label={hidden ? "Show left dashboard column" : "Hide left dashboard column"}
          onClick={onToggle}
          className={cn(
            "pointer-events-auto flex h-16 w-6 translate-y-0 items-center justify-center rounded-full border border-primary/25 bg-background/95 text-primary opacity-0 shadow-lg shadow-primary/10 backdrop-blur transition-opacity duration-150 group-hover/left-handle:opacity-100",
            settling && "opacity-0 group-hover/left-handle:opacity-0",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "h-0 w-0 border-y-[7px] border-y-transparent",
              hidden ? "border-l-[9px] border-l-current" : "border-r-[9px] border-r-current",
            )}
          />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ visibility: settling ? "hidden" : "visible" }}
      className={cn(
        "group/right-handle absolute -right-6 bottom-0 top-0 z-10 hidden w-6 items-start justify-center pt-2 md:flex",
        settling && "pointer-events-none !opacity-0",
      )}
    >
      {hasIndicator && (
        <span className="pointer-events-none absolute left-1/2 top-5 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-primary-foreground shadow-lg shadow-primary/30 opacity-0 transition-opacity duration-150 group-hover/right-handle:opacity-100">
          {indicatorCount > 9 ? "9+" : indicatorCount}
        </span>
      )}
      <button
        type="button"
        aria-label={hidden ? "Show right dashboard column" : "Hide right dashboard column"}
        onClick={onToggle}
        className={cn(
          "pointer-events-auto mt-9 flex h-16 w-6 items-center justify-center rounded-full border border-primary/25 bg-background/95 text-primary opacity-0 shadow-lg shadow-primary/10 backdrop-blur transition-opacity duration-150 group-hover/right-handle:opacity-100",
          settling && "opacity-0 group-hover/right-handle:opacity-0",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "h-0 w-0 border-y-[7px] border-y-transparent",
            hidden ? "border-r-[9px] border-r-current" : "border-l-[9px] border-l-current",
          )}
        />
      </button>
    </div>
  );
};
