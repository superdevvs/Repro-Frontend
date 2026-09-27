import { asRecord, buildNormalizedAddress, type ServicePackage } from './bookShootModel';
import type { PricingBreakdown } from '@/utils/pricing';
export function bookingSummaryInfo({ selectedServices, selectedClientData, fallbackClient, pricing, address, city, state, zip, date, time }: {
  selectedServices: ServicePackage[]; selectedClientData: unknown; fallbackClient: string; pricing: PricingBreakdown;
  address: string; city: string; state: string; zip: string; date: string; time: string;
}) {
  const client = asRecord(selectedClientData);
  const rep = typeof client.rep === 'string' ? client.rep : asRecord(client.repObject).name ?? (typeof client.repObject === 'string' ? client.repObject : undefined) ?? client.rep_name ?? client.sales_rep ?? client.salesRep;
  return { client: String(client.name || fallbackClient), clientRep: typeof rep === 'string' ? rep : undefined,
    services: selectedServices, packageLabel: selectedServices.map(service => service.name).join(', '), packagePrice: pricing.serviceSubtotal,
    pricing, address: buildNormalizedAddress({ address, city, state, zip }) || address || '', bedrooms: 0, bathrooms: 0, sqft: 0, date, time: time || '' };
}
