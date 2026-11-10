import React from 'react';
import type { DashboardShootServiceTag } from '@/types/dashboard';
import { getDeliverySpotlightDescription, getDeliverySpotlightServices } from '@/utils/deliverySpotlight';
import './DeliverySpotlight.css';

export const DeliverySpotlight: React.FC<{
  services: DashboardShootServiceTag[];
  layout?: 'dashboard' | 'cover' | 'thumbnail';
}> = ({ services, layout = 'dashboard' }) => {
  const items = getDeliverySpotlightServices(services);
  const visible = items.slice(0, 2);
  const illustrations = visible.length ? visible : [{ label: 'Property media', illustration: 'media' }];
  const serviceNames = items.map(item => item.label).join(' + ');

  return (
    <div className={`delivery-spotlight delivery-spotlight--${layout}`} data-delivery-spotlight="true" aria-label={serviceNames || 'Property media'}>
      <div className="delivery-spotlight__brand">
        <img src="/images/repro-logo.png" alt="R/E Pro Photos" width={91} height={27} className="delivery-spotlight__logo" />
        {items.length > 0 && <span className="delivery-spotlight__count">{items.length} {items.length === 1 ? 'service' : 'services'}</span>}
      </div>
      <div className="delivery-spotlight__main">
        <div className="delivery-spotlight__copy">
          <div className="delivery-spotlight__title" title={serviceNames || 'Property media'}>
            {visible.length ? visible.map((item, index) => (
              <div className="delivery-spotlight__line" key={item.label}>
                <span>{item.label}</span>
                {index === 0 && visible.length > 1 && <span className="delivery-spotlight__plus" aria-hidden="true">+</span>}
              </div>
            )) : <span>Property media</span>}
          </div>
          <p className="delivery-spotlight__description" title={serviceNames || undefined}>{getDeliverySpotlightDescription(items)}</p>
        </div>
        <div className="delivery-spotlight__art" data-paired={illustrations.length > 1} aria-hidden="true">
          {illustrations.map((item, index) => (
            <img
              key={`${item.illustration}-${index}`}
              src={`/images/delivery-spotlight/${item.illustration}.webp`}
              alt=""
              width={256}
              height={256}
              loading="lazy"
              className="delivery-spotlight__illustration"
            />
          ))}
        </div>
      </div>
      <div className="delivery-spotlight__divider" />
    </div>
  );
};
