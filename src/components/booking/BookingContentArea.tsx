import React from 'react';
import { Card } from '@/components/ui/card';
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
  bypassPayment: boolean;
  setBypassPayment: React.Dispatch<React.SetStateAction<boolean>>;
  sendNotification: boolean;
  setSendNotification: React.Dispatch<React.SetStateAction<boolean>>;
  getPackagePrice: () => number;
  getPhotographerRate: () => number;
  getTax: () => number;
  getTotal: () => number;
  clients: any[];
  photographers: any[];
  handleSubmit: () => void;
  goBack: () => void;
}

export function BookingContentArea({
  step,
  formErrors,
  setFormErrors,
  clientPropertyFormData,
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
  bypassPayment,
  setBypassPayment,
  sendNotification,
  setSendNotification,
  getPackagePrice,
  getPhotographerRate,
  getTax,
  getTotal,
  clients,
  photographers,
  handleSubmit,
  goBack
}: BookingContentAreaProps) {
  
  return (
    <Card className="p-4 md:p-6 border-[#1e2d4a] bg-gradient-to-b from-background to-background/90">
      {step === 1 && clientPropertyFormData && (
        <ClientPropertyForm
          initialData={clientPropertyFormData.initialData}
          onComplete={clientPropertyFormData.onComplete}
          packages={packages}
          isClientAccount={clientPropertyFormData.isClientAccount}
          clients={clients}
          selectedServices={selectedServices}
          onSelectedServicesChange={onSelectedServicesChange}
          packagesLoading={packagesLoading}
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
          bypassPayment={bypassPayment}
          setBypassPayment={setBypassPayment}
          sendNotification={sendNotification}
          setSendNotification={setSendNotification}
          photographers={photographers}
          selectedServices={selectedServices}
          packagePrice={getPackagePrice()}
          photographerRate={getPhotographerRate()}
          tax={getTax()}
          total={getTotal()}
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
    </Card>
  );
}
