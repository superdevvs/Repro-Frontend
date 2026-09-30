import { getServicePricingForSqft } from '@/utils/servicePricing';
import type { ServiceOption } from './shootOverviewEditorSupport';

export const resolveServicePrice = (service: ServiceOption, sqft: number | null, overrideValue?: string) => {
  const serviceWithPrice = { ...service, price: service.price ?? 0 };
  const pricingInfo = sqft && service.pricing_type === 'variable' && service.sqft_ranges?.length
    ? getServicePricingForSqft(serviceWithPrice, sqft)
    : null;
  const rawBasePrice = Number(pricingInfo?.price ?? service.price ?? 0);
  const basePrice = Number.isFinite(rawBasePrice) ? rawBasePrice : 0;
  const parsedOverride = overrideValue !== undefined && overrideValue !== '' ? Number(overrideValue) : NaN;
  const hasOverride = Number.isFinite(parsedOverride)
    && ((basePrice === 0 && parsedOverride > 0) || (basePrice > 0 && Math.abs(parsedOverride - basePrice) > 0.01));

  return {
    price: hasOverride ? parsedOverride : basePrice,
    basePrice,
    hasOverride,
  };
};
