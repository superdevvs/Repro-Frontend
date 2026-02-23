import React from 'react';

import { ClientPropertyForm } from './ClientPropertyForm';
import { SchedulingForm } from './SchedulingForm';
import { ReviewForm } from './ReviewForm';

type SelectedService = {
  id: string;
  name: string;
  description: string;
  price: number;
  category?: { id: string; name: string };
};

interface BookingContentAreaProps {
  step: number;
  formErrors: Record<string, string>;
  setFormErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  clientPropertyFormData: any;
  onAddressFieldsChange?: (fields: { address: string; city: string; state: string; zip: string }) => void;
  onClientChange?: (clientId: string) => void;
  date: Date | undefined;
  setDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  time: string;
  setTime: React.Dispatch<React.SetStateAction<string>>;
  selectedServices: SelectedService[];
  onSelectedServicesChange: (services: SelectedService[]) => void;
  notes: string;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  packages: any[];
  packagesLoading: boolean;
  client: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  setAddress?: React.Dispatch<React.SetStateAction<string>>;
  setCity?: React.Dispatch<React.SetStateAction<string>>;
  setState?: React.Dispatch<React.SetStateAction<string>>;
  setZip?: React.Dispatch<React.SetStateAction<string>>;
  photographer: string;
  setPhotographer: React.Dispatch<React.SetStateAction<string>>;
  servicePhotographers: Record<string, string>;
  setServicePhotographers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  bypassPayment: boolean;
  setBypassPayment: React.Dispatch<React.SetStateAction<boolean>>;
  sendNotification: boolean;
  setSendNotification: React.Dispatch<React.SetStateAction<boolean>>;
  getPackagePrice: () => number;
  getPhotographerRate: () => number;
  clients: any[];
  photographers: any[];
  handleSubmit: () => void;
  goBack: () => void;
  showClearSavedData?: boolean;
  onClearSavedData?: () => void;
}

export function BookingContentArea({
  step,
  formErrors,
  setFormErrors,
  clientPropertyFormData,
  onAddressFieldsChange,
  onClientChange,
  date,
  setDate,
  time,
  setTime,
  selectedServices,
  onSelectedServicesChange,
  notes,
  setNotes,
  packages,
  packagesLoading,
  client,
  address,
  city,
  state,
  zip,
  setAddress,
  setCity,
  setState,
  setZip,
  photographer,
  setPhotographer,
  servicePhotographers,
  setServicePhotographers,
  bypassPayment,
  setBypassPayment,
  sendNotification,
  setSendNotification,
  getPackagePrice,
  getPhotographerRate,
  clients,
  photographers,
  handleSubmit,
  goBack,
  showClearSavedData = false,
  onClearSavedData,
}: BookingContentAreaProps) {
  
  return (
    <div className="space-y-6">
      {step === 1 && clientPropertyFormData && (
        <ClientPropertyForm
          initialData={clientPropertyFormData.initialData}
          onComplete={clientPropertyFormData.onComplete}
          packages={packages}
          isClientAccount={clientPropertyFormData.isClientAccount}
          clients={clients}
          onAddressFieldsChange={onAddressFieldsChange}
          onClientChange={onClientChange}
          selectedServices={selectedServices}
          onSelectedServicesChange={onSelectedServicesChange}
          packagesLoading={packagesLoading}
          showClearSavedData={showClearSavedData}
          onClearSavedData={onClearSavedData}
        />
      )}
      
      {step === 2 && (
        <SchedulingForm
          date={date}
          setDate={setDate}
          time={time}
          setTime={setTime}
          formErrors={formErrors}
          setFormErrors={setFormErrors}
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
          selectedServices={selectedServices}
          photographers={photographers}
          handleSubmit={handleSubmit}
          goBack={goBack}
        />
      )}
      
      {step === 3 && (
        <ReviewForm
          client={client}
          clientName={clients.find(c => c.id === client)?.name || undefined}
          address={address}
          city={city}
          state={state}
          zip={zip}
          date={date}
          time={time}
          photographer={photographer}
          setPhotographer={setPhotographer}
          servicePhotographers={servicePhotographers}
          setServicePhotographers={setServicePhotographers}
          bypassPayment={bypassPayment}
          setBypassPayment={setBypassPayment}
          sendNotification={sendNotification}
          setSendNotification={setSendNotification}
          photographers={photographers}
          selectedServices={selectedServices}
          packagePrice={getPackagePrice()}
          photographerRate={getPhotographerRate()}
          additionalNotes={notes}
          setAdditionalNotes={setNotes}
          onConfirm={handleSubmit}
          onBack={goBack}
          bedrooms={clientPropertyFormData.initialData?.bedRooms || 0}
          bathrooms={clientPropertyFormData.initialData?.bathRooms || 0}
          sqft={clientPropertyFormData.initialData?.sqft || 0}
          area={Number(clientPropertyFormData.initialData?.sqft) || 0}
        />
      )}
    </div>
  );
}
