import React, { useState } from 'react';
import type { DashboardShootSummary } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { formatDashboardShootSchedule } from '@/utils/dashboardShootSchedule';
import { isUnsuitableShootCardHeroUrl, selectShootCardHeroUrls } from '@/utils/shootCardHero';
import { ShootActionRequestBadges } from '@/components/shoots/ShootActionRequests';
import { ClientPaymentPill } from '@/features/dashboard/components/ClientPaymentPill';
import { DeliverySpotlight } from './DeliverySpotlight';

interface DeliveredShootCardProps {
  shoot: DashboardShootSummary;
  showPaymentStatus: boolean;
  onSelect?: (shoot: DashboardShootSummary) => void;
}

export const DeliveredShootCard: React.FC<DeliveredShootCardProps> = ({ shoot, showPaymentStatus, onSelect }) => {
  const images = selectShootCardHeroUrls(shoot, { limit: 6 }).filter(url => !isUnsuitableShootCardHeroUrl(url));
  const signature = JSON.stringify(images);
  const [failed, setFailed] = useState<{ signature: string; urls: string[] }>({ signature: '', urls: [] });
  const failedUrls = failed.signature === signature ? failed.urls : [];
  const image = images.find(url => !failedUrls.includes(url));
  const scheduleLabel = formatDashboardShootSchedule(shoot);

  return (
    <div
      data-delivered-shoot-card="true"
      data-shoot-id={shoot.id}
      className="rounded-3xl border border-border/60 overflow-hidden hover:border-primary/40 transition-colors bg-card group relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? `Open ${shoot.addressLine}` : undefined}
      onClick={() => onSelect?.(shoot)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onSelect?.(shoot);
        }
      }}
    >
      <div className={cn('relative w-full overflow-hidden', image ? 'h-36 sm:h-56' : 'h-56')}>
        {image ? <>
          <img
            src={image}
            alt={shoot.addressLine}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setFailed({ signature, urls: [...failedUrls, image] })}
          />
          <div
            className="absolute inset-0 pointer-events-none z-[5]"
            style={{ background: 'linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.8) 15%, rgba(0, 0, 0, 0.6) 30%, rgba(0, 0, 0, 0.3) 45%, rgba(0, 0, 0, 0) 55%)' }}
          />
        </> : <DeliverySpotlight services={shoot.services} />}
        <div className="absolute left-3 sm:left-4 bottom-3 sm:bottom-4 right-14 sm:right-16 text-white space-y-1 z-10">
          <ShootActionRequestBadges shoot={shoot} />
          <p className="select-text cursor-text text-xs sm:text-sm font-semibold truncate">{shoot.addressLine}</p>
          <div className="text-[10px] sm:text-[11px] text-white/80 flex flex-col">
            <span className="truncate">{shoot.clientName || 'Client TBD'}</span>
            {scheduleLabel && <span className="text-white/60">{scheduleLabel}</span>}
          </div>
        </div>
        {showPaymentStatus && <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 pointer-events-none">
          <ClientPaymentPill status={shoot.paymentStatus} overlay />
        </div>}
      </div>
    </div>
  );
};
