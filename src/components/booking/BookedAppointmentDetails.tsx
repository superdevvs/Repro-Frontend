import type { BookingAvailabilitySlot } from '@/types/availability';
import { to12Hour } from '@/utils/availabilityUtils';

/** Display only the details returned by the API; never look up another client's shoot. */
export function BookedAppointmentDetails({ slot }: { slot: BookingAvailabilitySlot }) {
  const location = [slot.address, slot.city, [slot.state, slot.zip].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ');
  const services = slot.services?.map(service => service.name?.trim()).filter(Boolean) ?? [];

  return (
    <div className="space-y-3 whitespace-normal text-left">
      <p className="text-sm font-semibold">Booked appointment</p>
      <dl className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-muted-foreground">Start</dt>
            <dd className="mt-1 font-medium tabular-nums">{to12Hour(slot.start_time)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">End</dt>
            <dd className="mt-1 font-medium tabular-nums">{to12Hour(slot.end_time)}</dd>
          </div>
        </div>
        {slot.client_name ? (
          <div>
            <dt className="text-muted-foreground">Client</dt>
            <dd className="mt-1 break-words font-medium">{slot.client_name}</dd>
          </div>
        ) : null}
        {location ? (
          <div>
            <dt className="text-muted-foreground">Address</dt>
            <dd className="mt-1 break-words leading-relaxed">{location}</dd>
          </div>
        ) : null}
        {services.length ? (
          <div>
            <dt className="text-muted-foreground">{services.length === 1 ? 'Service' : 'Services'}</dt>
            <dd className="mt-1 break-words leading-relaxed">{services.join(' · ')}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
