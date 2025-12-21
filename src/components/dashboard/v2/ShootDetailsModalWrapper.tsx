import React from 'react';
import { ShootDetailsModal } from '@/components/shoots/ShootDetailsModal';
import { DashboardShootSummary } from '@/types/dashboard';
import { WeatherInfo } from '@/services/weatherService';

interface ShootDetailsModalWrapperProps {
  shoot: DashboardShootSummary | null;
  onClose: () => void;
  weather?: WeatherInfo | null; // Pass pre-fetched weather from dashboard
}

/**
 * Wrapper component to bridge the existing Dashboard code with the new unified ShootDetailsModal.
 * Converts DashboardShootSummary to shootId format expected by ShootDetailsModal.
 */
export const ShootDetailsModalWrapper: React.FC<ShootDetailsModalWrapperProps> = ({ shoot, onClose, weather }) => {
  if (!shoot) return null;

  // Extract shoot ID from the shoot object
  const shootId = String(shoot.id);

  return (
    <ShootDetailsModal
      shootId={shootId}
      isOpen={Boolean(shoot)}
      onClose={onClose}
      initialWeather={weather}
    />
  );
};



