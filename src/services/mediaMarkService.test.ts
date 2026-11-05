import { describe, expect, it } from 'vitest';
import { deliveryComponentSelectable, type DeliveryComponent } from './mediaMarkService';

const pending = { id: 'tour', status: 'pending', resolved: false, methods: ['external', 'manual_no_content'], reason_codes: ['external_review_required'] } as DeliveryComponent;
describe('delivery component selection', () => {
  it('requires explicit external review instead of treating an unverified provider URL as ready media', () => {
    expect(deliveryComponentSelectable(pending, 'media')).toBe(false);
    expect(deliveryComponentSelectable(pending, 'external')).toBe(true);
    expect(deliveryComponentSelectable({ ...pending, methods: ['manual_no_content'], reason_codes: ['provider_not_ready'] }, 'external')).toBe(false);
  });
  it('never selects a resolved delivery for another completion', () => {
    expect(deliveryComponentSelectable({ ...pending, resolved: true, status: 'delivered' }, 'manual_no_content')).toBe(false);
  });
});
