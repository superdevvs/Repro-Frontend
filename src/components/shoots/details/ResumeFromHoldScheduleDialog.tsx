import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { buildServiceTimeOptions, ServiceDatePicker, ServiceTimePicker } from '@/components/shoots/ServiceSchedulePicker';
import type { ShootData } from '@/types/shoots';
import {
  getResumeScheduleDialogDefaults,
  getShootServiceScheduleHints,
  resolveResumePhotographerId,
  shootNeedsResumeSchedule,
  type ResumeSchedulePayload,
} from '@/utils/shootResumeSchedule';
import { getShootSchedule } from '@/utils/shootSchedule';
import { getShootAssignedPhotographers } from '@/utils/shootPhotographerAssignments';

type ResumeFromHoldScheduleDialogProps = {
  open: boolean;
  shoot: ShootData;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: ResumeSchedulePayload) => void | Promise<void>;
};

/**
 * Collect/confirm date/time before resuming an on-hold shoot.
 * Emits BE shape 2: { scheduled_date, time, photographer_id? }.
 */
export function ResumeFromHoldScheduleDialog({
  open,
  shoot,
  isSubmitting = false,
  onOpenChange,
  onConfirm,
}: ResumeFromHoldScheduleDialogProps) {
  const defaults = getResumeScheduleDialogDefaults(shoot);
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time || '10:00');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = getResumeScheduleDialogDefaults(shoot);
    setDate(next.date);
    setTime(next.time || '10:00');
    setError(null);
  }, [open, shoot]);

  const photographerId = resolveResumePhotographerId(shoot) ?? null;
  const hasPhotographer = photographerId != null && photographerId > 0;
  const photographerLabel =
    getShootAssignedPhotographers(shoot).find((person) => String(person.id) === String(photographerId))?.name
    || (shoot.photographer && String(shoot.photographer.id) === String(photographerId)
      ? shoot.photographer.name
      : null);

  const headerDate = getShootSchedule(shoot).date;
  const serviceHints = getShootServiceScheduleHints(shoot);
  const hasMismatch =
    Boolean(headerDate) &&
    serviceHints.some((hint) => hint.date !== headerDate);
  const isUndated = shootNeedsResumeSchedule(shoot);

  const handleConfirm = async () => {
    if (!date) {
      setError('Choose a scheduled date before resuming.');
      return;
    }
    if (!time) {
      setError('Choose a scheduled time before resuming.');
      return;
    }
    setError(null);
    await onConfirm({
      scheduled_date: date,
      time,
      ...(hasPhotographer ? { photographer_id: photographerId as number } : {}),
    });
  };

  const description = isUndated
    ? 'This on-hold shoot has no date assigned. Choose a date and time to move it back to scheduled.'
    : hasMismatch
      ? `Shoot header date (${headerDate}) does not match service schedules (${serviceHints.map((h) => h.date).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'none'}). Confirm the appointment to resume.`
      : 'The saved appointment is in the past. Confirm a new date and time to resume this shoot.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="resume-from-hold-schedule-dialog">
        <DialogHeader>
          <DialogTitle>Set schedule to resume</DialogTitle>
          <DialogDescription>
            {description}
            {!hasPhotographer && ' A photographer can be assigned after resume if needed.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Date *</Label>
            <ServiceDatePicker
              value={date}
              onChange={setDate}
              triggerClassName="h-9 w-full rounded-lg px-2"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Time *</Label>
            <ServiceTimePicker
              value={time}
              options={buildServiceTimeOptions(time)}
              onChange={setTime}
              triggerClassName="h-9 w-full rounded-lg px-2"
            />
          </div>
        </div>

        {hasPhotographer && (
          <p className="text-xs text-muted-foreground">
            Photographer: {photographerLabel || `#${photographerId}`}
          </p>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={() => void handleConfirm()}>
            {isSubmitting ? 'Resuming…' : 'Resume with schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
