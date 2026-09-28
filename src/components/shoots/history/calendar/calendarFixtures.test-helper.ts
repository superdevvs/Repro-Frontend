import type { ShootData } from '@/types/shoots';

export const calendarShoot = (overrides: Partial<ShootData> = {}): ShootData => ({
  id: '1', scheduledDate: '2026-09-28', time: '09:30:00', status: 'scheduled',
  timezone: 'America/New_York',
  client: { name: 'Private client', email: 'private@example.test', totalShoots: 1 },
  location: { address: '10 Oak Lane', fullAddress: '10 Oak Lane, Austin, TX', city: 'Austin', state: 'TX', zip: '78701' },
  photographer: { id: '4', name: 'Jordan Lee' },
  services: ['HDR photos', 'iGuide (Legacy $725)'],
  payment: { baseQuote: 120, totalQuote: 120, totalPaid: 0, taxRate: 0, taxAmount: 0 },
  ...overrides,
});
