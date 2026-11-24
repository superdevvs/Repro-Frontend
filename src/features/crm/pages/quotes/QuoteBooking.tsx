import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { crmApi } from '../../api';
import { useCrmMutation } from '../../hooks';
import type { Quote } from '../../types';
import { Field, TextInput, Select } from '../../ui/fields';
import { US_STATES } from '../../ui/usStates';
import { Card, Note } from '../../ui/primitives';

interface Location { city: string; state: string; zip: string }

export function PropertyLocation({ value, onChange, disabled = false }: { value: Location; onChange: (v: Location) => void; disabled?: boolean }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
    <Field label="City" className="max-sm:col-span-2">{(id) => <TextInput id={id} autoComplete="address-level2" value={value.city} disabled={disabled} onChange={(e) => onChange({ ...value, city: e.target.value })} />}</Field>
    <Field label="State">{(id) => <Select id={id} value={value.state} disabled={disabled} placeholder="Select" options={US_STATES.map((state) => ({ value: state, label: state }))} onChange={(e) => onChange({ ...value, state: e.target.value })} />}</Field>
    <Field label="ZIP code">{(id) => <TextInput id={id} autoComplete="postal-code" maxLength={10} value={value.zip} disabled={disabled} onChange={(e) => onChange({ ...value, zip: e.target.value })} />}</Field>
  </div>;
}

export function QuoteBooking({ quote, canEdit }: { quote: Quote; canEdit: boolean }) {
  const [mode, setMode] = useState<'address' | 'link'>('address');
  const [address, setAddress] = useState(quote.property_address ?? '');
  const [location, setLocation] = useState({ city: quote.property_city ?? '', state: quote.property_state ?? '', zip: quote.property_zip ?? '' });
  const [shoot, setShoot] = useState('');
  const submit = useCrmMutation(() => crmApi.post(`/quotes/${quote.id}/complete-booking`, mode === 'link' ? { shoot_id: Number(shoot) } : {
    property_address: address, property_city: location.city, property_state: location.state, property_zip: location.zip,
  }));
  if (quote.booking_status === 'requested' || quote.booking_status === 'linked') return <Note tone="ok">{quote.booking_status === 'linked' ? 'Booking linked.' : 'Booking requested.'} {quote.booking_shoot_id && <Link className="font-medium underline" to={`/shoots/${quote.booking_shoot_id}`}>Open shoot #{quote.booking_shoot_id}</Link>}</Note>;
  if (quote.booking_status !== 'needs_review') return null;
  return <Card title="Booking needs review" bodyClassName="space-y-3">
    {quote.booking_review_reason && <p>{quote.booking_review_reason}</p>}
    {canEdit && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit.mutate(undefined); }}>
      <Field label="Complete booking">{(id) => <Select id={id} value={mode} options={[{ value: 'address', label: 'Request a shoot at this address' }, { value: 'link', label: 'Link an existing shoot' }]} onChange={(e) => setMode(e.target.value === 'link' ? 'link' : 'address')} />}</Field>
      {mode === 'address' ? <><Field label="Street address">{(id) => <TextInput required id={id} value={address} onChange={(e) => setAddress(e.target.value)} />}</Field><PropertyLocation value={location} onChange={setLocation} /></> :
        <Field label="Shoot ID for this client">{(id) => <TextInput id={id} type="number" required min="1" value={shoot} onChange={(e) => setShoot(e.target.value)} />}</Field>}
      <Button type="submit" size="sm" disabled={submit.isPending || (mode === 'address' ? !address.trim() || !location.city.trim() || !location.state || !location.zip.trim() : !Number(shoot))}>{mode === 'address' ? 'Request booking' : 'Link shoot'}</Button>
    </form>}
  </Card>;
}
