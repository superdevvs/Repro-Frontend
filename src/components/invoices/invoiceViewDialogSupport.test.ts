import { describe, expect, it } from 'vitest';

import { collectLinkedInvoiceShoots } from './invoiceViewDialogSupport';

describe('collectLinkedInvoiceShoots', () => {
  it('includes and deduplicates legacy item-only shoot links', () => {
    const shoots = collectLinkedInvoiceShoots({
      id: 9,
      shoot: { id: 12, address: 'Direct address' },
      shoots: [{ id: 13, address: 'Pivot address' }],
      items: [
        { id: 1, shoot_id: 12 },
        { id: 2, shoot_id: 14 },
        { id: 3, shoot_id: 14 },
      ],
    });

    expect(shoots.map((shoot) => String(shoot.id))).toEqual(['12', '13', '14']);
    expect(shoots[0].address).toBe('Direct address');
    expect(shoots[2]).toEqual({ id: 14 });
  });
});
