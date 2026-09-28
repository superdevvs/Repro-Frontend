import type { CSSProperties } from 'react';
import type { ShootData } from '@/types/shoots';
import { getShootDetailsServiceNames } from '@/components/shoots/details/shootDetailsPresentation';
import { formatWorkflowStatus } from '@/utils/status';
import type { CalendarEntry } from './calendarModel';

export function calendarStatus(shoot: ShootData) {
  const status = String(shoot.status || shoot.workflowStatus || 'scheduled').toLowerCase();
  const tone = ['delivered', 'ready_for_client', 'admin_verified'].includes(status) ? 'teal'
    : ['editing', 'review', 'ready_for_review', 'pending_review', 'editing_uploaded'].includes(status) ? 'purple'
    : ['on_hold', 'hold_on', 'cancelled', 'canceled', 'declined'].includes(status) ? 'amber'
    : ['uploaded', 'in_progress', 'completed', 'raw_uploaded', 'photos_uploaded'].includes(status) ? 'amber'
    : status === 'requested' ? 'muted' : 'blue';
  return { label: formatWorkflowStatus(status), tone };
}

export const calendarEventStyle = (shoot: ShootData): CSSProperties => ({
  '--calendar-event': `var(--calendar-${calendarStatus(shoot).tone})`,
} as CSSProperties);

export const calendarAddress = (shoot: ShootData) => shoot.location?.address || shoot.location?.fullAddress || `Shoot #${shoot.id}`;
export const calendarPhotographer = (shoot: ShootData) => shoot.photographer?.name || 'Unassigned';
export const calendarInitials = (shoot: ShootData) => calendarPhotographer(shoot).split(/\s+/).map(part => part[0]).slice(0, 2).join('');

export function calendarServices(shoot: ShootData, canViewPrices: boolean): string[] {
  const names = getShootDetailsServiceNames(shoot);
  if (canViewPrices) return names;
  // Old service labels sometimes embed a price (e.g. "iGuide (Legacy $725)").
  return names.map(name => name.replace(/\s*\([^)]*[$£€][^)]*\)/g, '').replace(/[$£€]\s*\d[\d,.]*/g, '').trim());
}

export function calendarTimeLabel(entry: CalendarEntry, formatTime: (time: string) => string): string {
  return entry.time ? formatTime(entry.time) : 'Time not set';
}

export function calendarTimezone(shoot: ShootData): string | null {
  return shoot.timezone || shoot.scheduleTimezone || shoot.schedule_timezone || null;
}
