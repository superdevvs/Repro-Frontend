import React from 'react';

import { cn } from '@/lib/utils';

import {
  STUDIO_ASIDE_CLASSES,
  STUDIO_COLUMNS_CLASSES,
  STUDIO_MAIN_CLASSES,
  STUDIO_MEDIA_FRAME_CLASSES,
  STUDIO_SECTION_CLASSES,
  STUDIO_SHELL_CLASSES,
  studioAspectRatioStyle,
  studioCardGridClasses,
  type StudioAspectRatio,
} from './studioLayoutLogic';

/**
 * Reusable Studio layout primitives (ai-editing-studio-revamp, task 16.1).
 *
 * Other Studio components compose these instead of writing their own responsive
 * classes, so the deep-navy palette (Req 11.1), the breakpoint contract
 * (Req 11.3–11.5), viewport fit next to the collapsed/expanded Application_Sidebar
 * (Req 11.6), and aspect-ratio reservation (Req 11.8) are applied uniformly.
 *
 * Every primitive renders a single DOM tree and switches arrangement through
 * media queries alone — no subtree is remounted at a breakpoint, which is what
 * keeps filters, selections, pending media, and launcher state alive across
 * reflow (Req 11.7).
 */

export interface StudioLayoutRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Studio root: publishes the `--studio-*` palette custom properties and fits the
 * viewport width the Application_Sidebar leaves behind, collapsed or expanded.
 */
export function StudioLayoutRoot({
  children,
  className,
  style,
  ...rest
}: StudioLayoutRootProps) {
  return (
    <div
      data-studio-layout="root"
      className={cn(STUDIO_SHELL_CLASSES, className)}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface StudioColumnsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** Primary content + Live_Queue rail: stacked below `xl`, side by side from `xl`. */
export function StudioColumns({ children, className, ...rest }: StudioColumnsProps) {
  return (
    <div
      data-studio-layout="columns"
      className={cn(STUDIO_COLUMNS_CLASSES, className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Primary column. */
export function StudioMain({ children, className, ...rest }: StudioColumnsProps) {
  return (
    <div data-studio-layout="main" className={cn(STUDIO_MAIN_CLASSES, className)} {...rest}>
      {children}
    </div>
  );
}

/** Secondary rail (Live_Queue). Reading order stays after the primary column. */
export function StudioAside({ children, className, ...rest }: StudioColumnsProps) {
  return (
    <aside data-studio-layout="aside" className={cn(STUDIO_ASIDE_CLASSES, className)} {...rest}>
      {children}
    </aside>
  );
}

export interface StudioSectionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  children: React.ReactNode;
  /** Optional visible section heading. */
  title?: React.ReactNode;
  /** Optional supporting copy under the heading. */
  description?: React.ReactNode;
  /** Optional controls rendered opposite the heading. */
  actions?: React.ReactNode;
}

/** Navy section shell with an optional header row. */
export function StudioSection({
  children,
  className,
  title,
  description,
  actions,
  ...rest
}: StudioSectionProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <section
      data-studio-layout="section"
      className={cn(STUDIO_SECTION_CLASSES, className)}
      {...rest}
    >
      {hasHeader && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {title && (
              <h2 className="truncate text-base font-semibold text-studio-text">{title}</h2>
            )}
            {description && <p className="text-sm text-studio-text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export interface StudioCardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Columns used from `xl` upward. */
  columns?: 2 | 3 | 4;
}

/** Card grid that collapses to one column below `md` and never overflows. */
export function StudioCardGrid({
  children,
  className,
  columns = 3,
  ...rest
}: StudioCardGridProps) {
  return (
    <div
      data-studio-layout="card-grid"
      className={cn(studioCardGridClasses(columns), className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface StudioMediaFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Aspect ratio reserved before the media loads (Req 11.8). */
  ratio?: StudioAspectRatio;
  children?: React.ReactNode;
}

/**
 * Reserves aspect-ratio space for an image or video region so the layout does
 * not shift when the media finishes loading — and so skeleton, error, and
 * placeholder states occupy the same box as the loaded media.
 */
export function StudioMediaFrame({
  ratio = '16/9',
  children,
  className,
  style,
  ...rest
}: StudioMediaFrameProps) {
  return (
    <div
      data-studio-layout="media-frame"
      data-studio-aspect-ratio={ratio}
      className={cn(STUDIO_MEDIA_FRAME_CLASSES, className)}
      style={{ ...studioAspectRatioStyle(ratio), ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
