import { describe, expect, it } from 'vitest';
import { normalizeShootServiceItem } from '@/utils/shootServiceItems';
import { getServiceProgress } from './serviceProgress';

const item = (attributes = {}) => normalizeShootServiceItem({ id: '1', name: 'Photos', price: 175, quantity: 1, ...attributes });

describe('service progress', () => {
  it.each([
    ['pending', 'Pending'], ['received', 'Received'], ['in_editing', 'In editing'],
    ['drafting', 'Drafting'], ['processing', 'Processing'], ['awaiting_assets', 'Awaiting links & floor plans'],
    ['ready', 'Ready'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'],
    ['on_hold', 'On hold'], ['needs_attention', 'Needs attention'],
  ])('renders the API progress %s', (code, label) => {
    expect(getServiceProgress(item({ progress_status: code }))).toMatchObject({ code, label });
  });
  it('accepts the camel case API alias and prefers the per-service provider projection', () => {
    expect(getServiceProgress(item({ progressStatus: 'awaiting_assets', workflow_status: 'delivered' }))?.code).toBe('awaiting_assets');
  });
  it.each([
    ['pending', 'not_started', 'pending'], ['in_progress', 'not_started', 'in_editing'],
    ['ready', 'ready', 'ready'], ['delivered', 'delivered', 'delivered'], ['cancelled', 'delivered', 'cancelled'],
  ])('handles older cached %s payloads without inventing delivered progress', (workflow, delivery, expected) => {
    expect(getServiceProgress(item({ workflow_status: workflow, delivery_status: delivery }))?.code).toBe(expected);
  });
  it('does not treat prototype keys or unknown API codes as valid statuses', () => {
    expect(getServiceProgress(item({ progress_status: 'constructor' }))?.code).toBe('pending');
  });
  it('omits operational badges for invoice adjustments', () => {
    expect(getServiceProgress(item({ is_invoice_adjustment: true }))).toBeNull();
  });
});
