import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ImageIcon, RotateCcw, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import {
  BeforeAfterControl,
  DEFAULT_BEFORE_AFTER_POSITION,
  clampBoundaryPosition,
} from './BeforeAfterControl';

/**
 * HeroPreview — the Command_Center's Hero_Preview
 * (ai-editing-studio-revamp, task 12.1).
 *
 * Shows matched original and processed property media inside one comparison
 * frame (Req 2.1) whose visible boundary follows the draggable
 * `BeforeAfterControl` clamped to 0–100 (Req 2.2), labels the two regions
 * "Before" and "After" (Req 2.3), and exposes the primary action that opens the
 * Project_Launcher through the `onOpenProjectLauncher` callback (Req 2.4 — the
 * launcher itself is task 12.3).
 *
 * The frame always reserves its aspect-ratio space, so the Skeleton_State shown
 * while images load (Req 2.6, 11.8), the placeholder shown before the
 * Asset_Integration_Process has produced any Generated_Property_Image (task 19),
 * and the Error_State shown when an image fails to load (Req 2.5) all occupy the
 * same box and never collapse the frame.
 *
 * Image sources are resolved through {@link resolveStudioAssetSrc}: only
 * application-controlled asset paths are rendered, so a remote temporary URL can
 * never reach the DOM (Req 2.7, design Property 6). An unusable source is
 * treated as "no asset assigned" and falls back to the placeholder.
 */

/** Comparison-frame aspect ratio, reserved before any image loads (Req 2.6, 11.8). */
export const HERO_PREVIEW_ASPECT_RATIO = '16 / 9';

export interface HeroPreviewImage {
  /** Application-controlled asset path (e.g. `/storage/studio/hero-before.jpg`). */
  src: string;
  /** Descriptive, context-based alternative text. */
  alt: string;
}

export interface HeroPreviewProps {
  /** Original ("Before") property image. */
  before?: HeroPreviewImage | null;
  /** Processed ("After") property image. */
  after?: HeroPreviewImage | null;
  /** Forces the Skeleton_State while the owning section awaits server data. */
  isLoading?: boolean;
  /** Initial Before_After_Control position; clamped to 0–100. */
  initialPosition?: number;
  /** Opens the Project_Launcher (Req 2.4). */
  onOpenProjectLauncher?: () => void;
  /** Label of the primary Hero_Preview action. */
  actionLabel?: string;
  /** Hide the section copy/action when composed inside the dense Command Center workspace. */
  showHeader?: boolean;
  className?: string;
}

type ImageLoadState = 'loading' | 'loaded' | 'error';

/**
 * Resolves an assigned image source to an application-controlled asset path.
 *
 * Returns `null` for anything that is not application-controlled — remote
 * origins, protocol-relative hosts, and `data:`/`blob:` temporaries — so the
 * caller renders its fallback instead (Req 2.7).
 */
export function resolveStudioAssetSrc(src: string | null | undefined): string | null {
  if (typeof src !== 'string') return null;
  const trimmed = src.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('//')) return null;

  const scheme = /^([a-zA-Z][a-zA-Z\d+\-.]*):/.exec(trimmed);
  if (scheme) {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    if (!origin) return null;
    try {
      const url = new URL(trimmed);
      if (url.origin !== origin) return null;
      return `${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  }

  return trimmed;
}

export function HeroPreview({
  before,
  after,
  isLoading = false,
  initialPosition = DEFAULT_BEFORE_AFTER_POSITION,
  onOpenProjectLauncher,
  actionLabel = 'New AI Project',
  showHeader = true,
  className,
}: HeroPreviewProps) {
  const [position, setPosition] = useState(() => clampBoundaryPosition(initialPosition));
  const [attempt, setAttempt] = useState(0);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const beforeSrc = resolveStudioAssetSrc(before?.src);
  const afterSrc = resolveStudioAssetSrc(after?.src);
  const hasAssets = Boolean(beforeSrc && afterSrc);

  const [loadState, setLoadState] = useState<Record<'before' | 'after', ImageLoadState>>({
    before: 'loading',
    after: 'loading',
  });

  // Restart load tracking whenever the assigned assets (or a retry) change.
  useEffect(() => {
    setLoadState({ before: 'loading', after: 'loading' });
  }, [beforeSrc, afterSrc, attempt]);

  const boundary = clampBoundaryPosition(position);

  const status = useMemo<'skeleton' | 'placeholder' | 'error' | 'ready'>(() => {
    if (isLoading) return 'skeleton';
    if (!hasAssets) return 'placeholder';
    if (loadState.before === 'error' || loadState.after === 'error') return 'error';
    if (loadState.before === 'loaded' && loadState.after === 'loaded') return 'ready';
    return 'skeleton';
  }, [hasAssets, isLoading, loadState]);

  const setImageState = useCallback((key: 'before' | 'after', next: ImageLoadState) => {
    setLoadState((current) => (current[key] === next ? current : { ...current, [key]: next }));
  }, []);

  /** Pointer dragging anywhere on the frame moves the boundary (Req 2.2). */
  const handlePointerBoundary = useCallback((clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    setPosition(clampBoundaryPosition(((clientX - rect.left) / rect.width) * 100));
  }, []);

  return (
    <section className={cn('space-y-4', className)} aria-labelledby="hero-preview-heading">
      {showHeader ? <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 id="hero-preview-heading" className="text-lg font-semibold tracking-tight">
            See the AI difference
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Drag the divider to compare an original property photo with its AI-processed result.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          onClick={() => onOpenProjectLauncher?.()}
          data-testid="hero-preview-primary-action"
        >
          <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
          {actionLabel}
        </Button>
      </div> : null}

      <div
        ref={frameRef}
        data-testid="hero-preview-frame"
        data-boundary-position={String(boundary)}
        data-status={status}
        style={{ aspectRatio: HERO_PREVIEW_ASPECT_RATIO }}
        className="relative w-full overflow-hidden rounded-xl border border-border bg-muted"
        onPointerDown={(event) => handlePointerBoundary(event.clientX)}
        onPointerMove={(event) => {
          if (event.buttons === 1) handlePointerBoundary(event.clientX);
        }}
      >
        {hasAssets && (
          <>
            <img
              key={`before-${attempt}-${beforeSrc}`}
              src={beforeSrc ?? undefined}
              alt={before?.alt ?? 'Original property photo'}
              data-testid="hero-preview-before-image"
              className="absolute inset-0 h-full w-full select-none object-cover"
              draggable={false}
              onLoad={() => setImageState('before', 'loaded')}
              onError={() => setImageState('before', 'error')}
            />
            <div
              data-testid="hero-preview-after-clip"
              className="absolute inset-0"
              style={{ clipPath: `inset(0 0 0 ${boundary}%)` }}
            >
              <img
                key={`after-${attempt}-${afterSrc}`}
                src={afterSrc ?? undefined}
                alt={after?.alt ?? 'AI-processed property photo'}
                data-testid="hero-preview-after-image"
                className="absolute inset-0 h-full w-full select-none object-cover"
                draggable={false}
                onLoad={() => setImageState('after', 'loaded')}
                onError={() => setImageState('after', 'error')}
              />
            </div>
          </>
        )}

        {/* Region labels stay visible in every state (Req 2.3). */}
        <span className="absolute left-3 top-3 z-30 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-foreground">
          Before
        </span>
        <span className="absolute right-3 top-3 z-30 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-foreground">
          After
        </span>

        {status === 'ready' && (
          <BeforeAfterControl
            position={boundary}
            onPositionChange={(next) => setPosition(next)}
          />
        )}

        {status === 'skeleton' && (
          <div
            className="absolute inset-0 z-20"
            role="status"
            aria-label="Loading before and after preview"
            data-testid="hero-preview-skeleton"
          >
            <Skeleton className="h-full w-full rounded-none" />
          </div>
        )}

        {status === 'placeholder' && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-muted text-center text-sm text-muted-foreground"
            data-testid="hero-preview-placeholder"
          >
            <ImageIcon className="h-6 w-6" aria-hidden="true" />
            <span>Before and after preview imagery isn’t available yet.</span>
          </div>
        )}

        {status === 'error' && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-muted p-6 text-center text-sm"
            role="alert"
            data-testid="hero-preview-error"
          >
            <span className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              Couldn’t load the before and after preview images.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAttempt((value) => value + 1)}
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export default HeroPreview;
