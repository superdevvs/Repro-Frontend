import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ApplyAllServiceScheduleButtonProps = {
  /** Hide when only one service row exists. */
  visible: boolean;
  onApply: () => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Bulk-fill control: push this row's date+time onto every service schedule row.
 * Per-row edits remain available afterwards.
 */
export function ApplyAllServiceScheduleButton({
  visible,
  onApply,
  disabled = false,
  className,
}: ApplyAllServiceScheduleButtonProps) {
  if (!visible) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onApply}
      className={cn(
        'h-auto px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10 hover:text-primary',
        className,
      )}
      data-testid="apply-all-service-schedule"
      aria-label="Apply this date and time to all services"
      title="Apply this date and time to all services"
    >
      Apply all
    </Button>
  );
}
