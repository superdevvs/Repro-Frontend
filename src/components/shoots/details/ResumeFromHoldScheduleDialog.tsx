import { useEffect, useMemo, useState } from 'react';
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
import { getShootSchedule } from '@/utils/shootSchedule';
import type { ResumeSchedulePayload } from '@/utils/shootResumeSchedule';

type ResumeFromHoldScheduleDialogProps = {
  open: boolean;
  shoot: ShootData;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: ResumeSchedulePayload) => void | Promise<void>;
};

/**
 * Collect date/time before resuming an undated on-hold import.
 * Emits BE shape 2: { scheduled_date, time, photographer_id? }.
 */
export function ResumeFromHoldScheduleDialog({
  open,
  shoot,
  isSubmitting = false,
  onOpenChange,
  onConfirm,
}: ResumeFromHoldScheduleDialogProps) {
  const existing = useMemo(() => getShootSchedule(shoot), [shoot]);
  const [date, setDate] = useState(existing.date);
  const [time, setTime] = useState(existing.time || '10:00');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const schedule = getShootSchedule(shoot);
    setDate(schedule.date);
    setTime(schedule.time || '10:00');
    setError(null);
  }, [open, shoot]);

  const photographerIdRaw = shoot.photographer?.id ?? shoot.photographer_id;
  const photographerId =
    photographerIdRaw === null || photographerIdRaw === undefined || photographerIdRaw === ''
      ? null
      : Number(photographerIdRaw);
  const hasPhotographer = Number.isFinite(photographerId) && (photographerId as number) > 0;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="resume-from-hold-schedule-dialog">
        <DialogHeader>
          <DialogTitle>Set schedule to resume</DialogTitle>
          <DialogDescription>
            This on-hold shoot has no date assigned. Choose a date and time to move it back to scheduled.
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
            Photographer: {shoot.photographer?.name || `#${photographerId}`}
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
