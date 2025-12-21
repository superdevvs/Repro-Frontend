
import React from 'react';
import { PaymentsSection } from './sections/PaymentsSection';
import { StorageSection } from './sections/StorageSection';
import { VideoHostingSection } from './sections/VideoHostingSection';
import { ToursSection } from './sections/ToursSection';
import { WeatherSection } from './sections/WeatherSection';
import { AddressAutocompleteSection } from './sections/AddressAutocompleteSection';

export function IntegrationsGrid() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <PaymentsSection />
        <StorageSection />
        <VideoHostingSection />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeatherSection />
        <ToursSection />
      </div>

      <AddressAutocompleteSection />
    </div>
  );
}
