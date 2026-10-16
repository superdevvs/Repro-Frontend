import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight, Bell, CalendarDays, Camera, Check, ChevronDown, Clock3, FileText, FlaskConical, Grid2X2, Home, KeyRound, Plus, Settings2, UserRound } from 'lucide-react';
import type { BookShootController } from '@/pages/useBookShootController';
import { BookShootView } from '@/pages/BookShootView';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/utils/defaultAvatars';
import { formatPrice } from '@/utils/servicePricing';
import { formatTimeForDisplay } from '@/utils/availabilityUtils';
import { normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';
import { parseLocalYmd } from '@/utils/shootLocalDate';
import { serviceRequiresPhotographer, resolveServicePhotographerId } from '@/utils/photographerAssignment';
import { MultiUnitBookingContext } from '@/features/shoot-units/useMultiUnitBooking';
import { BookingUnitManager } from '@/features/shoot-units/BookingUnitControls';
import { TravelFeasibilityPanel } from '@/features/travel/TravelFeasibilityPanel';
import { BookingSentenceDialog, type SentenceSection } from './BookingSentenceDialog';
import { sentenceDraftIssue, sentenceVisitLines } from './bookingSentenceModel';
import { ServicePickerIcon } from '../ServicePickerIcon';
import { serviceCategoryIcon } from '../serviceCategoryIcon';
import './booking-sentence.css';

function Field({ children, icon, onClick, label, small = false }: { children: ReactNode; icon: ReactNode; onClick: () => void; label: string; small?: boolean }) {
  return <button type="button" aria-label={label} onClick={onClick} className={`sentence-field${small ? ' sentence-field-small' : ''}`}>
    {icon}<span>{children}</span><ChevronDown className="sentence-chevron" />
  </button>;
}

function PersonAvatar({ name, avatar, id, role }: { name: string; avatar?: string; id?: string; role: 'client' | 'photographer' }) {
  return <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={getAvatarUrl(avatar, role, undefined, id)} alt="" /><AvatarFallback className="bg-primary/10 text-xs text-primary">{name.split(' ').map(v => v[0]).join('').slice(0, 2) || <UserRound />}</AvatarFallback></Avatar>;
}

export function BookingSentenceView({ controller: c }: { controller: BookShootController }) {
  const location = useLocation();
  const [review, setReview] = useState(false);
  const [section, setSection] = useState<SentenceSection | null>(null);
  const [issue, setIssue] = useState('');
  // Scheduling remains active while composing so changes invalidate and refresh checks.
  useEffect(() => {
    if (!review && !c.isComplete && !c.isCompReshootMode && c.step !== 3) c.editBookingStep(3);
  }, [review, c]);
  useEffect(() => { if (c.unitBooking.managerOpen) setSection(null); }, [c.unitBooking.managerOpen]);
  const closePanel = () => { setSection(null); c.editBookingStep(3); };
  const openPanel = (next: SentenceSection) => {
    const prerequisite = sentenceDraftIssue(c);
    const needsProperty = (next === 'services' || next === 'schedule') && prerequisite?.section === 'property';
    const needsServices = next === 'schedule' && prerequisite?.section === 'services';
    if (prerequisite && (needsProperty || needsServices)) {
      setIssue(prerequisite.message); next = prerequisite.section;
    }
    setReview(false); setSection(next); c.editBookingStep(3);
  };
  const reviewBooking = () => {
    const problem = sentenceDraftIssue(c);
    if (problem) { setIssue(problem.message); openPanel(problem.section); return; }
    setIssue(''); setSection(null); c.editBookingStep(4); setReview(true);
  };
  const testNotice = <div className="sentence-test-notice"><span><FlaskConical size={16} /><strong>Booking test page</strong><span>Connected to live bookings. Confirmation sends the selected notifications.</span></span><Link to={`/book-shoot${location.search}`}>Use current booking page <ArrowRight size={14} /></Link></div>;

  if (c.isEditMode && c.editShootLoading) return <div className="p-6" role="status">Loading shoot…</div>;
  // Special reshoots retain the complete reason, source mapping and compensation workflow.
  if (c.isCompReshootMode || c.isComplete || review) return <div className="sentence-booking">
    {testNotice}
    <BookShootView singlePage={!c.isCompReshootMode} controller={c.isCompReshootMode ? c : { ...c,
      goBack: () => { setReview(false); c.editBookingStep(3); },
      editBookingStep: step => openPanel(step === 1 ? 'property' : step === 2 ? 'services' : 'schedule'),
      resetForm: () => { setReview(false); setSection(null); c.resetForm(); },
    }} />
  </div>;

  const clientName = c.selectedClientData?.name || 'Choose client';
  const required = c.selectedServices.filter(serviceRequiresPhotographer);
  const personIds = [...new Set(required.map(service => resolveServicePhotographerId(service, c.servicePhotographers, c.photographer)).filter(Boolean))];
  const person = c.photographers.find(p => p.id === (personIds.length === 1 ? personIds[0] : c.photographer));
  const personLabel = c.unitBooking.enabled ? 'Team & assignments' : personIds.length > 1 ? `${personIds.length} photographers` : person?.name || 'Choose photographer';
  const lines = sentenceVisitLines(c);
  const totalMinutes = lines.reduce((n, line) => n + line.duration, 0);
  const unitLabel = c.unitBooking.enabled ? `${c.unitBooking.draft.units.length} units / areas` : c.propertyDetails?.aptSuite ? `Unit ${c.propertyDetails.aptSuite}` : 'Unit / areas';
  const dateValues = [...new Set(lines.map(line => line.date).filter(Boolean))];
  const timeValues = [...new Set(lines.map(line => line.time).filter(Boolean))];
  const displayDate = dateValues[0] ? parseLocalYmd(dateValues[0]) : c.date;
  const dateLabel = dateValues.length > 1 ? `${dateValues.length} dates` : displayDate ? format(displayDate, 'EEE, MMM d') : 'Choose date';
  const timeLabel = timeValues.length > 1 ? 'Per-service times' : timeValues[0] ? formatTimeForDisplay(timeValues[0]) : c.time ? formatTimeForDisplay(c.time) : 'Choose time';
  const unitAction = () => c.unitBooking.enabled ? c.unitBooking.setManagerOpen(true) : openPanel('property');

  return <MultiUnitBookingContext.Provider value={c.unitBooking}>
    <BookingUnitManager photographers={c.photographers} />
    <div className="sentence-booking">
      {testNotice}
      <div className="sentence-heading"><div><p className="sentence-eyebrow">YOUR NEXT SHOOT</p><h1>{c.isEditMode ? 'Update your shoot.' : 'A few choices. A clear plan.'}</h1><p>Tap any detail. Everything else stays right here.</p></div><div className="sentence-steps"><strong>1 · Details</strong><span />2 · Review</div></div>
      <div className="sentence-card">
        <div className="sentence-card-head"><span><Camera size={16} /> One page. Your whole shoot.</span><span>{c.shouldCacheForm ? 'Draft kept on this device' : 'Changes saved on confirmation'}{c.shouldCacheForm && c.hasCachedData && <button onClick={c.handleClearCache}>Clear draft</button>}</span></div>
        <div className="sentence-grid">
          <div className="sentence-composer">
            <div className="sentence-clause"><span>I’m booking</span><Field label="Choose client and property" onClick={() => openPanel('property')} icon={<PersonAvatar name={clientName} avatar={c.selectedClientData?.avatar ?? undefined} id={c.client} role="client" />}>{clientName}</Field></div>
            <div><div className="sentence-clause"><span>at</span><Field label="Edit property address" icon={<Home />} onClick={() => openPanel('property')}>{c.address || 'Choose property address'}</Field><Field small label="Edit units and common areas" icon={<Grid2X2 />} onClick={unitAction}>{unitLabel}</Field></div><p className="sentence-address">{[c.city, c.state, c.zip].filter(Boolean).join(', ') || 'Address lookup or manual entry'}{c.propertySqft ? ` · ${c.propertySqft.toLocaleString()} sq ft` : ''}</p></div>
            <div className="sentence-clause sentence-services"><span>for</span>{c.selectedServices.slice(0, 4).map(service => <Field key={service.id} small label={`Edit ${service.name}`} icon={<ServicePickerIcon name={serviceCategoryIcon(service.category?.name || service.name)} small />} onClick={() => openPanel('services')}>{service.name}{normalizeBookingQuantity(service.quantity) > 1 ? ` × ${normalizeBookingQuantity(service.quantity)}` : ''}</Field>)}{c.selectedServices.length > 4 && <button className="sentence-more" onClick={() => openPanel('services')}>+{c.selectedServices.length - 4} more</button>}<button className="sentence-add" aria-label="Choose services" onClick={() => openPanel('services')}><Plus size={20} />{!c.selectedServices.length && <span>Choose services</span>}</button></div>
            <div className="sentence-clause"><span>with</span>{required.length || !c.selectedServices.length ? <Field label="Choose photographers and assignments" icon={<PersonAvatar name={personLabel} avatar={person?.avatar} id={person?.id} role="photographer" />} onClick={() => openPanel('schedule')}>{personLabel}</Field> : <span className="sentence-offsite"><Check size={18} /> No on-site photographer needed</span>}</div>
            <div className="sentence-clause"><div className="sentence-part"><span>on</span><Field label="Choose date" icon={<CalendarDays />} onClick={() => openPanel('schedule')}>{dateLabel}</Field></div><div className="sentence-part"><span>at</span><Field label="Choose time" icon={<Clock3 />} onClick={() => openPanel('schedule')}>{timeLabel}</Field></div></div>
            <div className="sentence-plan"><Check size={15} /><span>{c.isEditMode ? c.travel.timezone : 'Eastern time'} · {lines.length} service {lines.length === 1 ? 'line' : 'lines'}{totalMinutes > 0 ? ` · ${totalMinutes} min of work` : ''}</span><button onClick={() => openPanel('schedule')}>Split services / team</button></div>
          </div>
          <aside className="sentence-visit"><h2>Your visit <span>{c.unitBooking.enabled ? `${c.unitBooking.draft.units.length} units` : '1 property'}</span></h2><div className="sentence-visit-lines">{lines.length ? lines.map(line => <div className="sentence-visit-line" key={line.key}><small>{line.date || 'Date to choose'}{line.time ? ` · ${formatTimeForDisplay(line.time)}` : ''}</small><strong>{line.name}{line.quantity > 1 ? ` × ${line.quantity}` : ''}</strong><p>{line.unit ? `${line.unit} · ` : ''}{line.person}{line.duration ? ` · ${line.duration} min` : ''}</p></div>) : <p className="text-sm text-muted-foreground">Your services and appointments will appear here.</p>}</div><p>Every service keeps its own assignment.</p><button onClick={() => openPanel('schedule')}>Edit the service plan <ArrowRight size={14} /></button></aside>
        </div>
        <div className="sentence-details">
          <button onClick={() => openPanel('services')}><KeyRound /><span><strong>Property & access</strong><small>{String(c.propertyDetails?.presenceOption || 'Add access instructions')}</small></span></button>
          <button onClick={() => openPanel('services')}><FileText /><span><strong>Notes & instructions</strong><small>{[c.notes, c.companyNotes, c.photographerNotes, c.editorNotes].filter(Boolean).length} notes · by audience</small></span></button>
          <button onClick={() => openPanel('options')}><Bell /><span><strong>Notifications</strong><small>Review recipients</small></span></button>
          <button onClick={() => openPanel('options')}><Settings2 /><span><strong>More options</strong><small>Payment & billing</small></span></button>
        </div>
      </div>
      {c.showAddressScheduledWarning && <p className="sentence-warning" role="status">{c.addressScheduledWarningMessage}</p>}
      <div className="mt-4"><TravelFeasibilityPanel issuesOnly showNotifications={false} travel={c.travel} durationAdjuster={c.travelDurationAdjuster} /></div>
      {issue && <p className="sentence-warning" role="alert">{issue}</p>}
      <div className="sentence-checkout"><button onClick={reviewBooking} aria-label="Review pricing breakdown"><strong>{formatPrice(c.getTotal())}</strong><span>total incl. tax <ChevronDown size={12} /></span></button><div className="sentence-checkout-caption"><strong>{c.travel.blocked ? 'Your schedule needs review' : 'Your booking, at a glance'}</strong><span>{c.isEditMode ? 'Review changes before saving.' : 'Review everything before confirming.'}</span></div><Button onClick={reviewBooking} disabled={c.packagesLoading || c.isSubmitting}>{c.isEditMode ? 'Review changes' : 'Review booking'}<ArrowRight size={16} /></Button></div>
      <p className="sentence-footnote">{c.isClientAccount ? 'Confirmation submits a request for team approval.' : 'Nothing is booked until you confirm on the next page.'}</p>
    </div>
    <BookingSentenceDialog controller={c} section={section} onClose={closePanel} />
  </MultiUnitBookingContext.Provider>;
}
