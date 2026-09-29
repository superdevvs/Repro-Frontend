import React from 'react';
import { ArrowUpRight, Camera, MapPin, User } from 'lucide-react';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import type { ShootData } from '@/types/shoots';
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary';
import { formatCurrency } from '../shootHistoryUtils';
import type { CalendarEntry } from './calendarModel';
import { calendarAddress, calendarEventStyle, calendarInitials, calendarPhotographer, calendarServices, calendarStatus, calendarTimeLabel, calendarTimezone } from './calendarPresentation';

interface ShootButtonProps {
  entry: CalendarEntry;
  onShootSelect: (shoot: ShootData) => void;
  compact?: boolean;
  style?: React.CSSProperties;
  selected?: boolean;
}

export function CalendarShootButton({ entry, onShootSelect, compact = false, style, selected }: ShootButtonProps) {
  const { formatTime } = useUserPreferences();
  const { shoot } = entry;
  const status = calendarStatus(shoot);
  const time = calendarTimeLabel(entry, formatTime);
  return <button type="button" className={`shc-event${compact ? ' shc-event-compact' : ''}${selected ? ' is-selected' : ''}`}
    style={{ ...calendarEventStyle(shoot), ...style }} data-shoot-id={shoot.id}
    aria-label={`Open ${calendarAddress(shoot)}, ${time}, ${status.label}`}
    title={`${time} · ${calendarAddress(shoot)} · ${status.label}${calendarTimezone(shoot) ? ` · ${calendarTimezone(shoot)}` : ''}`}
    onClick={() => onShootSelect(shoot)}>
    <time className="shc-event-time">{time}</time>
    <strong className="shc-event-address">{calendarAddress(shoot)}</strong>
    {!compact && <span className="shc-event-person"><span>{calendarInitials(shoot)}</span>{calendarPhotographer(shoot)}</span>}
  </button>;
}

export function CalendarAgenda({ entries, onShootSelect, empty = 'No shoots scheduled for this day.' }: {
  entries: CalendarEntry[];
  onShootSelect: (shoot: ShootData) => void;
  empty?: string;
}) {
  const { formatTime } = useUserPreferences();
  if (!entries.length) return <p className="shc-empty-copy">{empty}</p>;
  return <div className="shc-agenda-list">{entries.map(entry => <button type="button" className="shc-agenda-card" key={entry.shoot.id}
    style={calendarEventStyle(entry.shoot)} data-shoot-id={entry.shoot.id} onClick={() => onShootSelect(entry.shoot)}
    aria-label={`Open ${calendarAddress(entry.shoot)}, ${calendarTimeLabel(entry, formatTime)}, ${calendarStatus(entry.shoot).label}`}>
    <time>{calendarTimeLabel(entry, formatTime)}</time>
    <span><strong>{calendarAddress(entry.shoot)}</strong><small>{calendarPhotographer(entry.shoot)} · {calendarStatus(entry.shoot).label}</small></span>
    <ArrowUpRight aria-hidden="true" />
  </button>)}</div>;
}

export function CalendarInspector({ entry, onShootSelect, hideClientDetails, canViewPrices }: {
  entry: CalendarEntry | null;
  onShootSelect: (shoot: ShootData) => void;
  hideClientDetails: boolean;
  canViewPrices: boolean;
}) {
  const { formatDate, formatTime } = useUserPreferences();
  if (!entry) return <section className="shc-brief"><h3>Shoot brief</h3><p className="shc-empty-copy">Select a day to see its shoots.</p></section>;
  const { shoot } = entry;
  const status = calendarStatus(shoot);
  const services = calendarServices(shoot, canViewPrices);
  return <section className="shc-brief" aria-label="Selected shoot" style={calendarEventStyle(shoot)}>
    <h3>Shoot brief <ArrowUpRight aria-hidden="true" /></h3>
    <button type="button" className="shc-open" data-shoot-id={shoot.id} onClick={() => onShootSelect(shoot)}>Open shoot overview <ArrowUpRight aria-hidden="true" /></button>
    <div className="shc-brief-body">
      <span className="shc-status"><i aria-hidden="true" />{status.label}</span>
      <h4>{calendarAddress(shoot)}</h4>
      <p className="shc-location"><MapPin aria-hidden="true" />{[shoot.location?.city, shoot.location?.state].filter(Boolean).join(', ') || 'Location not set'}</p>
      <div className="shc-brief-time"><strong>{entry.date ? formatDate(entry.date) : 'Date not set'}</strong><span>{calendarTimeLabel(entry, formatTime)}{calendarTimezone(shoot) && ` · ${calendarTimezone(shoot)}`}</span></div>
      <dl className="shc-people">
        {!hideClientDetails && <div><User aria-hidden="true" /><dt>Client</dt><dd>{shoot.client?.name || 'Unassigned'}</dd></div>}
        <div><Camera aria-hidden="true" /><dt>Photographer</dt><dd>{calendarPhotographer(shoot)}</dd></div>
      </dl>
      {services.length > 0 && <><h5>Booked services</h5><div className="shc-services">{services.map((service, index) => <span key={`${service}-${index}`}>{service}</span>)}</div></>}
      {canViewPrices && <div className="shc-price"><span>Total</span><strong>{formatCurrency(normalizeShootPaymentSummary(shoot).totalQuote)}</strong></div>}
    </div>
  </section>;
}
