import React, { useMemo, useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useShoots } from '@/context/ShootsContext';
import type { ShootData } from '@/types/shoots';

const TIME_NOT_SPECIFIED = 'time not specified';

type AlternateScope = 'main' | 'all_services';

export interface AlternateDateFieldProps {
  shoot: ShootData;
  formatDate: (d?: string | null) => string;
  formatTime: (t?: string | null) => string;
  /** Hide controls in read-only contexts (e.g. client view); default true for editors. */
  showControls?: boolean;
  /**
   * Render only the apply controls and omit the read-only "Alternate:" presentation
   * row. Used where a surface already shows the alternate date text (e.g. the
   * external booking mapping panel) and only needs the reusable controls.
   */
  controlsOnly?: boolean;
  onApplied?: (updated: ShootData) => void;
}

/**
 * Reads the already-normalized alternate fields off `ShootData`, tolerating the
 * camelCase aliases that appear elsewhere in the codebase. The serialized
 * resource uses snake_case (`alternate_scheduled_date`, ...), but some normalized
 * shapes carry camelCase, so we accept both.
 */
const readAlternate = (shoot: ShootData) => {
  const aliased = shoot as unknown as Record<string, unknown>;
  const pick = (snake: string, camel: string): string | null => {
    const value = aliased[snake] ?? aliased[camel];
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  };
  return {
    date: pick('alternate_scheduled_date', 'alternateScheduledDate'),
    time: pick('alternate_time', 'alternateTime'),
    scheduledAt: pick('alternate_scheduled_at', 'alternateScheduledAt'),
  };
};

/**
 * Counts the services attached to a shoot, preferring the richer service-object
 * arrays and falling back to the lightweight `services` string array.
 */
const countServices = (shoot: ShootData): number => {
  const objects =
    shoot.serviceObjects ?? shoot.serviceItems ?? shoot.service_items ?? null;
  if (Array.isArray(objects) && objects.length > 0) {
    return objects.length;
  }
  return Array.isArray(shoot.services) ? shoot.services.length : 0;
};

/**
 * Shared, low-profile presentation + controls for a shoot's alternate date/time.
 * Renders nothing when no alternate date is stored (Req 1.4 / 7.2).
 */
export function AlternateDateField({
  shoot,
  formatDate,
  formatTime,
  showControls = true,
  controlsOnly = false,
  onApplied,
}: AlternateDateFieldProps) {
  const { toast } = useToast();
  const { applyAlternateDate } = useShoots();
  const [applyingScope, setApplyingScope] = useState<AlternateScope | null>(null);

  const alternate = useMemo(() => readAlternate(shoot), [shoot]);
  const serviceCount = useMemo(() => countServices(shoot), [shoot]);

  // Req 1.4 / 7.2 — render nothing when there is no stored alternate date.
  if (!alternate.date) {
    return null;
  }

  const isApplying = applyingScope !== null;

  // In controls-only mode there is nothing to render when controls are hidden.
  if (controlsOnly && !showControls) {
    return null;
  }

  const handleApply = async (scope: AlternateScope) => {
    if (isApplying) return;
    setApplyingScope(scope);
    try {
      // Delegate to the central context method so it POSTs, normalizes, and
      // refreshes all shoot state consistently. It returns the normalized shoot.
      const updated = await applyAlternateDate(shoot.id, scope);
      onApplied?.(updated);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to apply the alternate date',
        variant: 'destructive',
      });
    } finally {
      setApplyingScope(null);
    }
  };

  const controls = showControls ? (
    <div
      className={
        controlsOnly
          ? 'flex flex-wrap items-center gap-2'
          : 'flex flex-wrap items-center gap-2 pt-0.5'
      }
    >
      {/* Req 7.1 / 7.5 — default control, always shown when an alternate exists. */}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={isApplying}
        onClick={() => handleApply('main')}
      >
        {applyingScope === 'main' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Use as main date
      </Button>

      {/* Req 7.3 / 7.4 — secondary control, only for multi-service shoots. */}
      {serviceCount > 1 && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isApplying}
          onClick={() => handleApply('all_services')}
        >
          {applyingScope === 'all_services' && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Apply to all services
        </Button>
      )}
    </div>
  ) : null;

  // Controls-only: reuse just the apply controls without duplicating the
  // read-only "Alternate:" presentation that the host surface already renders.
  if (controlsOnly) {
    return (
      <div className="text-xs" data-section="alternate-date-field-controls">
        {controls}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 text-xs" data-section="alternate-date-field">
      <div className="flex justify-between items-start gap-2">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5 flex-shrink-0" />
          Alternate:
        </span>
        <span className="font-medium text-right">
          {formatDate(alternate.date)}
          {' · '}
          {alternate.time ? (
            formatTime(alternate.time)
          ) : (
            <span className="italic text-muted-foreground">{TIME_NOT_SPECIFIED}</span>
          )}
        </span>
      </div>

      {controls}
    </div>
  );
}

export default AlternateDateField;
