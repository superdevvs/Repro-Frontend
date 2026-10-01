import { useRef, useState } from 'react';
import { Clock3, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import type { ShootData } from '@/types/shoots';
import type { CalendarEntry } from './calendarModel';
import { calendarAddress, calendarPhotographer, calendarStatus } from './calendarPresentation';
import { ShootActionRequestBadges } from '@/components/shoots/ShootActionRequests';

export function CalendarUntimedMenu({ entries, theme, onShootSelect }: {
  entries: CalendarEntry[]; theme: string; onShootSelect: (shoot: ShootData) => void;
}) {
  const [open, setOpen] = useState(false);
  const handingOff = useRef(false);
  const { formatDate } = useUserPreferences();
  if (!entries.length) return null;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className="shc-untimed-trigger" data-calendar-untimed-trigger
        aria-label={`Time not set, ${entries.length} ${entries.length === 1 ? 'shoot' : 'shoots'}`}>
        <Clock3 aria-hidden="true" /><span>Time not set</span><b>{entries.length}</b>
      </button>
    </PopoverTrigger>
    <PopoverContent className="shc shc-untimed-popover" data-theme={theme} align="start" aria-label="Shoots with time not set"
      onCloseAutoFocus={event => {
        if (handingOff.current) { event.preventDefault(); handingOff.current = false; }
      }}>
      <header><h3>Time not set <span>{entries.length}</span></h3><button type="button" aria-label="Close untimed shoots" onClick={() => setOpen(false)}><X aria-hidden="true" /></button></header>
      <p>These shoots have a date but still need a start time.</p>
      <div className="shc-untimed-menu-list">{entries.map(entry => <button type="button" key={entry.shoot.id}
        data-shoot-id={entry.shoot.id} data-calendar-focus-return="untimed-trigger"
        aria-label={`Open ${calendarAddress(entry.shoot)}, time not set, ${formatDate(entry.date)}`}
        onClick={() => { handingOff.current = true; setOpen(false); onShootSelect(entry.shoot); }}>
        <strong>{calendarAddress(entry.shoot)}</strong>
        <span>{formatDate(entry.date)} · {calendarStatus(entry.shoot).label}</span>
        <small>{calendarPhotographer(entry.shoot)}</small>
        <ShootActionRequestBadges shoot={entry.shoot} />
      </button>)}</div>
    </PopoverContent>
  </Popover>;
}
