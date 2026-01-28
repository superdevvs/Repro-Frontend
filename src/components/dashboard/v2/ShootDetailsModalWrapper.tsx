import React from 'react';
import { ShootDetailsModal } from '@/components/shoots/ShootDetailsModal';
import { DashboardShootSummary } from '@/types/dashboard';
import { WeatherInfo } from '@/services/weatherService';

interface ShootDetailsModalWrapperProps {
  shoot: DashboardShootSummary | null;
  onClose: () => void;
  weather?: WeatherInfo | null; // Pass pre-fetched weather from dashboard
  onShootUpdate?: () => void; // Callback to refresh dashboard when shoot is updated
  onViewInvoice?: (shoot: DashboardShootSummary) => void; // Callback to view invoice
  initialTab?: 'overview' | 'notes' | 'issues' | 'tours' | 'settings';
  openDownloadDialog?: boolean;
}

/**
 * Wrapper component to bridge the existing Dashboard code with the new unified ShootDetailsModal.
 * Converts DashboardShootSummary to shootId format expected by ShootDetailsModal.
 */
export const ShootDetailsModalWrapper: React.FC<ShootDetailsModalWrapperProps> = ({
  shoot,
  onClose,
  weather,
  onShootUpdate,
  onViewInvoice,
  initialTab,
  openDownloadDialog,
}) => {
  if (!shoot) return null;

  // Extract shoot ID from the shoot object
  const shootId = String(shoot.id);

  return (
    <ShootDetailsModal
      shootId={shootId}
      isOpen={Boolean(shoot)}
      onClose={onClose}
      initialWeather={weather}
      onShootUpdate={onShootUpdate}
      initialTab={initialTab}
      openDownloadDialog={openDownloadDialog}
    />
  );
};



