import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AutomationScheduleJson } from '@/types/messaging';
import { isTimedShootReminder } from './automationSchedule';

const hasDailySchedule = (trigger: string) => ['PROPERTY_CONTACT_REMINDER', 'INVOICE_DUE', 'INVOICE_OVERDUE', 'SHOOT_PAYMENT_REMINDER'].includes(trigger);

export function AutomationScheduleFields({ trigger, value = {}, onChange, disabled = false }: {
  trigger: string;
  value?: AutomationScheduleJson;
  onChange: (value: AutomationScheduleJson) => void;
  disabled?: boolean;
}) {
  const shootPayment = trigger === 'SHOOT_PAYMENT_REMINDER';
  const savedDays = (shootPayment ? value.reminder_days ?? [1, 3, 7, 14, 21, 28] : value.overdue_days ?? [1, 3, 7, 14, 30]).join(', ');
  const [daysText, setDaysText] = useState(savedDays);
  useEffect(() => setDaysText(savedDays), [savedDays]);
  if (isTimedShootReminder(trigger)) {
    const offset = value.offset?.match(/^-(\d+)([mhd])$/);
    const minutes = offset ? Number(offset[1]) * (offset[2] === 'd' ? 1440 : offset[2] === 'h' ? 60 : 1) : trigger === 'PHOTOGRAPHER_SHOOT_REMINDER' ? 120 : 1440;
    return (
      <div className="space-y-2 rounded-xl border p-4">
        <Label htmlFor="reminder-lead-minutes">Send before shoot (minutes)</Label>
        <Input id="reminder-lead-minutes" type="number" min="1" step="1" value={minutes} disabled={disabled}
          onChange={(event) => onChange({ offset: `-${Math.max(1, Number(event.target.value))}m` })} />
        <p className="text-xs text-muted-foreground">120 minutes = 2 hours. 1,440 minutes = 24 hours. The current shoot time is checked before sending.</p>
      </div>
    );
  }
  if (trigger === 'WEEKLY_PAYOUT_DIGEST') return (
    <div className="space-y-2 rounded-xl border p-4">
      <Label htmlFor="payout-accounting-email">Accounting email</Label>
      <Input id="payout-accounting-email" type="email" value={value.accounting_email ?? ''} placeholder="Use the configured accounting address" disabled={disabled}
        onChange={(event) => onChange({ accounting_email: event.target.value })} />
      <p className="text-xs text-muted-foreground">The Accounting recipient uses this address. Leave blank to use the business accounting address.</p>
    </div>
  );
  if (!hasDailySchedule(trigger)) return null;
  const invoice = trigger.startsWith('INVOICE_');
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <p className="text-sm font-medium">Reminder schedule</p>
      <p className="text-xs text-muted-foreground">Times use the business timezone. Eligibility is checked again before sending.</p>
      <div>
        <Label htmlFor="reminder-send-time">{shootPayment ? 'Monthly send time' : 'Send time'}</Label>
        <Input id="reminder-send-time" type="time" value={value.time ?? (invoice ? '09:30' : '09:00')} disabled={disabled}
          onChange={(event) => onChange({ time: event.target.value })} />
      </div>
      {trigger !== 'INVOICE_OVERDUE' && !shootPayment ? (
        <div>
          <Label htmlFor="reminder-days-before">Days before {invoice ? 'due date' : 'shoot'}</Label>
          <Input id="reminder-days-before" type="number" min="0" step="1" value={value.days_before ?? 0} disabled={disabled}
            onChange={(event) => onChange({ days_before: Math.max(0, Number(event.target.value)) })} />
          <p className="mt-1 text-xs text-muted-foreground">Use 0 for the day itself.</p>
        </div>
      ) : (
        <>
          <div>
            <Label htmlFor="reminder-overdue-days">{shootPayment ? 'Days after photos ready' : 'Days after due date'}</Label>
            <Input id="reminder-overdue-days" value={daysText} placeholder="1, 3, 7, 14, 30" disabled={disabled}
              onChange={(event) => setDaysText(event.target.value)}
              onBlur={() => {
                const days = daysText.split(',').map((day) => Number(day.trim()));
                if (days.length && days.every((day) => Number.isInteger(day) && day > 0)) {
                  onChange({ [shootPayment ? 'reminder_days' : 'overdue_days']: [...new Set(days)].sort((a, b) => a - b) });
                } else setDaysText(savedDays);
              }} />
          </div>
          {shootPayment ? <div>
            <Label htmlFor="reminder-monthly-weekday">Then monthly on the last</Label>
            <select id="reminder-monthly-weekday" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={value.monthly_day_of_week ?? 0} disabled={disabled}
              onChange={(event) => onChange({ monthly_day_of_week: Number(event.target.value) })}>
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}
            </select>
          </div> : <div>
            <Label htmlFor="reminder-repeat-days">Then repeat every (days)</Label>
            <Input id="reminder-repeat-days" type="number" min="1" step="1" value={value.repeat_every_days ?? 30} disabled={disabled}
              onChange={(event) => onChange({ repeat_every_days: Math.max(1, Number(event.target.value)) })} />
          </div>}
        </>
      )}
    </div>
  );
}
