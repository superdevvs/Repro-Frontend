
import React from 'react';
import { PaymentsSection } from './sections/PaymentsSection';
import { VideoHostingSection } from './sections/VideoHostingSection';
import { ToursSection } from './sections/ToursSection';
import { WeatherSection } from './sections/WeatherSection';

export function IntegrationsGrid() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PaymentsSection />
        <VideoHostingSection />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeatherSection />
        <ToursSection />
      </div>
    </div>
  );
}
