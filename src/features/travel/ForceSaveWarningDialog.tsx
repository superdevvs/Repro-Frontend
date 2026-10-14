import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { TravelOverrideSchedule } from './TravelOverrideSchedule';
import { TravelNotifications } from './TravelNotifications';
import type { TravelController } from './useTravelFeasibility';

function warningText(code: string) {
  if (/working_hours|outside_hours/.test(code)) return 'The appointment is outside the photographer’s working hours.';
  if (/location|building|geocod|address/.test(code)) return 'The travel check could not confirm the property location.';
  if (/insufficient_travel|short.*gap/.test(code)) return 'The proposed appointment leaves less travel time than recommended.';
  return code.replace(/_/g, ' ');
}

export function ForceSaveWarningDialog({ travel }: { travel: TravelController }) {
  const { open, reason, setReason, cancel, complete } = travel.forceSaveDialog;
  if (!open || !travel.canForceSave) return null;
  const warnings = [...new Set([...(travel.result?.reason_codes ?? []), ...(travel.result?.transitions ?? []).map(leg => leg.reason_code)])]
    .filter(code => code && code !== 'available' && code !== 'sufficient_travel_time');
  const visits = travel.result?.visits?.filter(visit => visit.is_target !== false) ?? [];
  const valid = reason.trim().length >= 5 && reason.trim().length <= 500;
  return <Dialog open onOpenChange={value => { if (!value) cancel(); }}><DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />Save changes with scheduling warning</DialogTitle>
      <DialogDescription>Review the warnings and proposed changes. Enter a reason to save this existing shoot anyway.</DialogDescription></DialogHeader>
    <section aria-label="Scheduling warnings" role="alert" className="rounded-lg border border-amber-500/60 bg-amber-500/10 p-3 text-sm">
      <p className="font-semibold">Warnings to acknowledge</p><ul className="mt-2 list-disc space-y-1 pl-5">{warnings.map(code => <li key={code}>{warningText(code)}</li>)}</ul>
      {warnings.some(code => /working_hours|outside_hours/.test(code)) && <p className="mt-2">Travel may remain unverified for this changed window.</p>}
    </section>
    {travel.warningChanges?.length ? <section aria-label="Proposed changes" className="space-y-2 text-sm"><p className="font-semibold">Proposed changes</p>
      {travel.warningChanges.map(change => <div key={change.label} className="rounded-lg border p-3"><p className="font-medium">{change.label}</p><p className="mt-1 break-words text-muted-foreground">Current: {change.before}</p><p className="mt-1 break-words">Proposed: {change.after}</p></div>)}
    </section> : null}
    {visits.length > 0 && <section aria-label="Proposed appointment" className="rounded-lg border p-3 text-sm"><p className="font-semibold">Proposed appointment</p>{visits.map((visit, index) => {
      const format = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: visit.timezone }).format(new Date(value));
      return <p key={index} className="mt-1">{format(visit.start)} – {format(visit.end)} · {visit.duration_minutes} min</p>;
    })}</section>}
    <TravelOverrideSchedule travel={travel} />
    <label className="space-y-1 text-sm font-medium">Reason for saving with warning<Textarea aria-label="Reason for saving with warning" value={reason} onChange={event => setReason(event.target.value)} minLength={5} maxLength={500} required rows={2} placeholder="Explain why these changes should be saved." /></label>
    {travel.notificationsSupported && <TravelNotifications value={travel.notifications} onChange={travel.setNotifications} />}
    <p className="text-xs text-muted-foreground">Your reason and these warnings are recorded with the shoot. Availability is checked again when saving.</p>
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={cancel}>Go back without saving</Button><Button className="bg-amber-600 text-white hover:bg-amber-700" disabled={!valid} onClick={complete}>Confirm and save with warning</Button></div>
  </DialogContent></Dialog>;
}
