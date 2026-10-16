import type { BookShootController } from '@/pages/useBookShootController';
import { getSchedulingStepErrors, toDateInputValue } from '@/pages/bookShootModel';
import { resolveServicePhotographerId, serviceRequiresPhotographer } from '@/utils/photographerAssignment';
import { resolveServiceShootDuration } from '@/utils/shootDuration';
import { normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';
import type { SentenceSection } from './BookingSentenceDialog';
import { clientAccountPropertyFormSchema, adminPropertyFormSchema } from '../clientPropertySchemas';
import { z } from 'zod';

type SentenceDraft = Pick<BookShootController, 'client' | 'isClientAccount' | 'address' | 'city' | 'state' | 'zip' | 'selectedServices' | 'canCreateNoProductShoot' | 'date' | 'time' | 'photographer' | 'servicePhotographers' | 'serviceSchedules' | 'unitBooking' | 'propertyDetails' | 'propertySqft'>;

export function sentenceDraftIssue(c: SentenceDraft): { section: SentenceSection; message: string } | null {
  if ((!c.client && !c.isClientAccount) || ![c.address, c.city, c.state, c.zip].every(value => value.trim())) {
    return { section: 'property', message: 'Choose a client and complete the property address.' };
  }
  const baseSchema = c.isClientAccount ? clientAccountPropertyFormSchema : adminPropertyFormSchema;
  const schema = c.unitBooking.enabled ? baseSchema.extend({ sqft: z.number().optional() }) : baseSchema;
  const property = schema.safeParse({ clientId: c.client, propertyAddress: c.address, propertyCity: c.city,
    propertyState: c.state, propertyZip: c.zip, sqft: c.propertySqft ?? undefined,
    propertyType: c.propertyDetails?.propertyType || 'residential', listingType: c.propertyDetails?.listingType,
    bedRooms: c.propertyDetails?.bedrooms ?? c.propertyDetails?.bedRooms,
    bathRooms: c.propertyDetails?.bathrooms ?? c.propertyDetails?.bathRooms,
  });
  if (!property.success) return { section: 'property', message: property.error.issues[0].message };
  if (!c.selectedServices.length && (c.isClientAccount || !c.canCreateNoProductShoot)) {
    return { section: 'services', message: 'Choose at least one service before reviewing your booking.' };
  }
  if (c.unitBooking.enabled) {
    const propertyIssue = Object.values(c.unitBooking.propertyErrors).flat()[0];
    if (propertyIssue) return { section: 'property', message: propertyIssue };
    const unitIssue = Object.values(c.unitBooking.errors).flat()[0];
    if (unitIssue) return { section: 'services', message: unitIssue };
    if (c.unitBooking.schedule.errors.length) return { section: 'schedule', message: c.unitBooking.schedule.errors[0] };
    return null;
  }
  if (!c.propertyDetails?.presenceOption) return { section: 'services', message: 'Choose who will be at the property.' };
  const errors = getSchedulingStepErrors(c);
  return Object.keys(errors).length ? { section: 'schedule', message: Object.values(errors)[0] } : null;
}

export function sentenceVisitLines(c: Pick<BookShootController, 'selectedServices' | 'serviceSchedules' | 'servicePhotographers' | 'photographer' | 'photographers' | 'unitBooking' | 'date' | 'time' | 'propertySqft' | 'propertyDetails'>) {
  const photographerName = (id: string | null) => c.photographers.find(p => p.id === id)?.name || 'Choose photographer';
  if (c.unitBooking.enabled) return c.unitBooking.schedule.lines.map(line => {
    const service = c.unitBooking.catalog.find(s => s.id === line.service_id);
    return {
      key: line.client_key, name: service?.name || 'Service unavailable', quantity: normalizeBookingQuantity(line.quantity),
      unit: c.unitBooking.draft.units.find(u => u.client_key === line.unit_client_key)?.label || 'Unit',
      date: line.scheduled_date, time: line.start_time, duration: line.duration,
      person: service && !serviceRequiresPhotographer(service) ? 'No on-site photographer' : photographerName(line.photographer_id),
    };
  });
  return c.selectedServices.map(service => ({
    key: service.id, name: service.name, quantity: normalizeBookingQuantity(service.quantity),
    unit: String(c.propertyDetails?.aptSuite || ''),
    date: c.serviceSchedules[service.id]?.date || (c.date ? toDateInputValue(c.date) : ''),
    time: c.serviceSchedules[service.id]?.time || c.time,
    duration: serviceRequiresPhotographer(service) ? resolveServiceShootDuration(service, c.propertySqft, c.serviceSchedules[service.id]?.duration_minutes) : 0,
    person: serviceRequiresPhotographer(service) ? photographerName(resolveServicePhotographerId(service, c.servicePhotographers, c.photographer)) : 'No on-site photographer',
  }));
}
