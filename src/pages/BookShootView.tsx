import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { BookingStepIndicator } from '@/components/booking/BookingStepIndicator';
import { BookingComplete } from '@/components/booking/BookingComplete';
import { BookingSummary } from '@/components/booking/BookingSummary';
import { BookingContentArea } from '@/components/booking/BookingContentArea';
import { BookingHeader } from '@/components/booking/BookingHeader';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';
import type { BookShootController } from './useBookShootController';
import { CompReshootBanner } from '@/features/complimentary-reshoots/CompReshootBanner';
import { CompReasonChangeDialog } from '@/features/complimentary-reshoots/CompReasonChangeDialog';
import { getBookingWizardConfig } from './bookShootModel';

export function BookShootView({ controller }: { controller: BookShootController }) {
  const {
    isMobile, isEditMode, editShootLoading, packages, packagesLoading, clients, client,
    setClient, address, setAddress, city, setCity, state, setState, zip, setZip, date,
    setDate, time, setTime, photographer, setPhotographer, servicePhotographers,
    setServicePhotographers, serviceSchedules, setServiceSchedules, selectedServices,
    handleSelectedServicesChange, shootType, handleShootTypeChange, propertyDetails,
    propertySqft, notes, companyNotes, photographerNotes, editorNotes, bypassPayment,
    setBypassPayment, sendNotification, setSendNotification, adjustedTotalInput,
    setAdjustedTotalInput, step, isComplete, completedBooking, isSubmitting,
    duplicateLocationDialogOpen, setDuplicateLocationDialogOpen, createdShootId, formErrors,
    setFormErrors, clientPropertyFormKey, toast, photographers, availablePhotographerIds,
    availabilityChecked, canAdjustBookingAmount, canCreateNoProductShoot, isClientAccount,
    isFormComplete, sameDayAddressShoot, sameAddressScheduledDates,
    addressScheduledWarningMessage, sameDayAddressWarningMessage,
    duplicateLocationPopupMessage, showAddressScheduledWarning, hasCachedData,
    handleClearCache, resetForm, getTotal, parsedTemperature, condition, summaryInfo,
    currentStepContent, clientPropertyFormData, handleAddressFieldsChange,
    handleClientChange, handlePropertyDraftChange, getPackagePrice, getPhotographerRate,
    getTax, getAvailablePhotographers, validateCurrentStep, goBack, handleSubmit,
    displayPricingBreakdown, pricingBreakdown, buildNormalizedAddress, user,
    shouldCacheForm, setNotes, duplicateLocationWarningAcceptedRef,
    compReshoot, isCompReshootMode, canSubmitBooking,
    positiveChargeDialogOpen, setPositiveChargeDialogOpen,
    exitCompDialogOpen, setExitCompDialogOpen, openCompReshootSource,
    confirmExitCompReshoot, convertToAdditionalWork,
  } = controller;
  const wizard = getBookingWizardConfig(isCompReshootMode);
  const finalStep = wizard.finalStep;
  return (
    <>
      <div className="space-y-6 px-1 py-4 sm:px-4 sm:py-6 lg:p-6">
          <AnimatePresence mode="wait">
            {isComplete ? (
              <BookingComplete 
                date={completedBooking?.date ?? date} 
                time={completedBooking?.time ?? time} 
                resetForm={resetForm} 
                isClientRequest={isClientAccount}
                shootId={completedBooking?.shootId ?? createdShootId}
                totalAmount={completedBooking?.totalAmount ?? getTotal()}
                pricing={completedBooking?.pricing ?? displayPricingBreakdown}
                shootAddress={completedBooking?.shootAddress ?? buildNormalizedAddress({ address, city, state, zip })}
                shootServices={completedBooking?.shootServices ?? selectedServices.map(s => s.name)}
                clientName={completedBooking?.clientName ?? user?.name}
                clientEmail={completedBooking?.clientEmail ?? user?.email}
                shoot={completedBooking?.shoot}
                isComplimentaryReshoot={isCompReshootMode}
                sourceShootId={compReshoot.sourceShootId}
              />
            ) : (
              <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <BookingHeader
                  title={currentStepContent.title}
                  description={currentStepContent.description}
                />
                {showAddressScheduledWarning && !isCompReshootMode && (
                  <div className="w-full rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-sm md:ml-auto md:max-w-xl">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-300" />
                      <p className="leading-5">
                        {addressScheduledWarningMessage}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {isCompReshootMode && (
                <CompReshootBanner
                  controller={compReshoot}
                  onOpenSource={openCompReshootSource}
                  onExit={() => setExitCompDialogOpen(true)}
                  onConvertToAdditionalWork={() => setPositiveChargeDialogOpen(true)}
                />
              )}
              <div className="flex items-center gap-3">
                <BookingStepIndicator currentStep={step} totalSteps={wizard.totalSteps} stepLabels={wizard.labels} />
                {step === 1 && !isCompReshootMode && shouldCacheForm && hasCachedData && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClearCache}
                    className="hidden h-[52px] gap-2 px-4 md:inline-flex"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear saved data
                  </Button>
                )}
              </div>
              </div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {!isComplete && (
              <div
                className={`grid grid-cols-1 ${{
                  true: 'lg:grid-cols-[minmax(0,1.85fr)_minmax(320px,0.95fr)]',
                  false: 'lg:grid-cols-1',
                }[String(!isMobile || step === finalStep) as 'true' | 'false']} gap-8 mt-2 items-start`}
              >
                <div className="order-2 lg:order-1 w-full">
                <BookingContentArea
                  step={step}
                  formErrors={formErrors}
                  setFormErrors={setFormErrors}
                  clientPropertyFormData={clientPropertyFormData}
                  onAddressFieldsChange={handleAddressFieldsChange}
                  onClientChange={handleClientChange}
                  onPropertyDraftChange={handlePropertyDraftChange}
                  date={date}
                  setDate={setDate}
                  time={time}
                  setTime={setTime}
                  selectedServices={selectedServices}
                  onSelectedServicesChange={handleSelectedServicesChange}
                  shootType={shootType}
                  onShootTypeChange={handleShootTypeChange}
                  canCreateNoProductShoot={canCreateNoProductShoot}
                  notes={notes}
                  setNotes={setNotes}
                  packages={packages}
                  packagesLoading={packagesLoading}
                  client={client}
                  address={address}
                  city={city}
                  state={state}
                  zip={zip}
                  setAddress={setAddress}
                  setCity={setCity}
                  setState={setState}
                  setZip={setZip}
                  photographer={photographer}
                  setPhotographer={setPhotographer}
                  servicePhotographers={servicePhotographers}
                  setServicePhotographers={setServicePhotographers}
                  serviceSchedules={serviceSchedules}
                  setServiceSchedules={setServiceSchedules}
                  bypassPayment={bypassPayment}
                  setBypassPayment={setBypassPayment}
                  sendNotification={sendNotification}
                  setSendNotification={setSendNotification}
                  getPackagePrice={getPackagePrice}
                  pricingBreakdown={displayPricingBreakdown}
                  originalPricingBreakdown={pricingBreakdown}
                  canAdjustAmount={canAdjustBookingAmount}
                  adjustedTotalInput={adjustedTotalInput}
                  setAdjustedTotalInput={setAdjustedTotalInput}
                  getPhotographerRate={getPhotographerRate}
                  clients={clients}
                  photographers={photographers}
                  handleSubmit={handleSubmit}
                  goBack={goBack}
                  sameDayAddressWarningMessage={sameDayAddressWarningMessage}
                  showClearSavedData={shouldCacheForm && hasCachedData}
                  onClearSavedData={handleClearCache}
                  compReshoot={compReshoot}
                  propertySqft={propertySqft}
                />
                </div>
                {(!isMobile || step === finalStep) && (
                  <div className="order-1 lg:order-2 lg:sticky lg:top-4 lg:max-w-sm w-full">
                    <BookingSummary
                      summaryInfo={summaryInfo}
                      selectedServices={selectedServices}
                      serviceSchedules={serviceSchedules}
                      onSubmit={step === finalStep ? handleSubmit : undefined}
                      isLastStep={step === finalStep}
                      canSubmit={canSubmitBooking}
                      isSubmitting={isSubmitting}
                      canAdjustAmount={canAdjustBookingAmount && !isCompReshootMode}
                      adjustedTotalInput={adjustedTotalInput}
                      setAdjustedTotalInput={setAdjustedTotalInput}
                      originalTotalQuote={pricingBreakdown.totalQuote}
                      showRepName={user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'photographer'}
                      weather={{ temperature: parsedTemperature, condition }}
                      isMobile={isMobile}
                      isComplimentaryReshoot={isCompReshootMode}
                    />
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
      </div>
      <AlertDialog open={duplicateLocationDialogOpen} onOpenChange={setDuplicateLocationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Possible duplicate shoot</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateLocationPopupMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                duplicateLocationWarningAcceptedRef.current = true;
                setDuplicateLocationDialogOpen(false);
                void handleSubmit();
              }}
            >
              Continue scheduling
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CompReasonChangeDialog controller={compReshoot} />
      <AlertDialog open={exitCompDialogOpen} onOpenChange={setExitCompDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit comp reshoot mode?</AlertDialogTitle>
            <AlertDialogDescription>
              The source link, reason, service mapping, and compensation choices will be cleared. You can continue with a normal booking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay in comp mode</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExitCompReshoot}>Exit mode</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={positiveChargeDialogOpen} onOpenChange={setPositiveChargeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to additional work?</AlertDialogTitle>
            <AlertDialogDescription>
              A complimentary reshoot must keep the client total at exactly $0. Continue as Reshoot / Additional Work to add a client charge while preserving the source-shoot relationship.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep complimentary</AlertDialogCancel>
            <AlertDialogAction onClick={convertToAdditionalWork}>Convert booking</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
