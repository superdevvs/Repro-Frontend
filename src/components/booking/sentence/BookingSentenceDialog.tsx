import type { BookShootController } from '@/pages/useBookShootController';
import { BookingContentArea } from '../BookingContentArea';
import { TravelFeasibilityPanel } from '@/features/travel/TravelFeasibilityPanel';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type SentenceSection = 'property' | 'services' | 'schedule' | 'options';
const sectionStep: Record<SentenceSection, number> = { property: 1, services: 2, schedule: 3, options: 4 };
const sectionTitle: Record<SentenceSection, string> = {
  property: 'Client & property', services: 'Services, access & notes', schedule: 'Schedule & photographers', options: 'Payment & notifications',
};

/** Reuse the production fields and pickers; closing a panel never submits a shoot. */
export function BookingSentenceDialog({ controller: c, section, onClose }: {
  controller: BookShootController; section: SentenceSection | null; onClose: () => void;
}) {
  return <Dialog open={Boolean(section)} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="sentence-booking-dialog flex max-h-[90dvh] max-w-5xl flex-col overflow-hidden p-0">
      <DialogHeader className="shrink-0 border-b px-5 py-4 sm:px-6">
        <DialogTitle>{section ? sectionTitle[section] : 'Booking details'}</DialogTitle>
        <DialogDescription>Update your draft here. Review the complete booking before confirming.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
        {section && <BookingContentArea
          schedulingContinueLabel="Done"
          step={sectionStep[section]}
          clientPropertyFormData={{ ...c.clientPropertyFormData, onComplete: data => { c.clientPropertyFormData.onComplete(data); onClose(); } }}
          onAddressFieldsChange={c.handleAddressFieldsChange} onClientChange={c.handleClientChange} onPropertyDraftChange={c.handlePropertyDraftChange}
          formErrors={c.formErrors} setFormErrors={c.setFormErrors}
          date={c.date} setDate={c.setDate} time={c.time} setTime={c.setTime}
          selectedServices={c.selectedServices} onSelectedServicesChange={c.handleSelectedServicesChange}
          shootType={c.shootType} onShootTypeChange={c.handleShootTypeChange} canCreateNoProductShoot={c.canCreateNoProductShoot}
          notes={c.notes} setNotes={c.setNotes} packages={c.packages} packagesLoading={c.packagesLoading}
          client={c.client} address={c.address} city={c.city} state={c.state} zip={c.zip}
          setAddress={c.setAddress} setCity={c.setCity} setState={c.setState} setZip={c.setZip}
          photographer={c.photographer} setPhotographer={c.setPhotographer}
          servicePhotographers={c.servicePhotographers} setServicePhotographers={c.setServicePhotographers}
          serviceSchedules={c.serviceSchedules} setServiceSchedules={c.setServiceSchedules}
          bypassPayment={c.bypassPayment} setBypassPayment={c.setBypassPayment}
          sendNotification={c.sendNotification} setSendNotification={c.setSendNotification}
          notificationControls={c.travel.notificationsSupported ? { value: c.travel.notifications, onChange: c.travel.setNotifications } : undefined}
          getPackagePrice={c.getPackagePrice} getPhotographerRate={c.getPhotographerRate}
          pricingBreakdown={c.displayPricingBreakdown} originalPricingBreakdown={c.pricingBreakdown}
          canAdjustAmount={c.canAdjustBookingAmount} adjustedTotalInput={c.adjustedTotalInput} setAdjustedTotalInput={c.setAdjustedTotalInput}
          clients={c.clients} photographers={c.photographers} schedulingPhotographers={c.photographers}
          handleSubmit={onClose} goBack={onClose} sameDayAddressWarningMessage={c.sameDayAddressWarningMessage}
          showClearSavedData={false} propertySqft={c.propertySqft}
          enforceNewBookingEligibility={!c.isEditMode} hybridTravelEnabled={c.travel.enabled}
          afterCalendar={<TravelFeasibilityPanel issuesOnly showNotifications={false} travel={c.travel} durationAdjuster={c.travelDurationAdjuster} />}
        />}
      </div>
    </DialogContent>
  </Dialog>;
}
