import { describe, expect, it } from 'vitest';
import { normalizeShootServiceItem } from '@/utils/shootServiceItems';
import { getServiceProgress } from './serviceProgress';

const item = (attributes = {}) => normalizeShootServiceItem({ id: '1', name: 'Photos', price: 175, quantity: 1, ...attributes });

describe('service progress', () => {
  it.each([
    ['applied', 'Applied'], ['pending', 'Pending'], ['received', 'Received'], ['in_editing', 'In editing'],
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
  it('keeps new work pending despite a stale delivery flag and original timestamp', () => {
    expect(getServiceProgress(item({ workflow_status: 'pending', delivery_status: 'delivered', delivered_at: '2026-11-03T12:00:00Z' }))?.code).toBe('pending');
  });
  it.each([
    { progress_status: 'not_applicable' },
    { progressStatus: 'not_applicable' },
    { is_deliverable: false },
    { isDeliverable: false, progress_status: 'pending' },
  ])('shows Applied for a financial service using the booked API classification %j', attributes => {
    expect(getServiceProgress(item({ name: 'Travel Fee', ...attributes }))).toEqual({ code: 'applied', label: 'Applied', tone: 'neutral' });
  });
  it.each([
    { workflow_status: 'cancelled', progress_status: 'not_applicable' },
    { delivery_status: 'cancelled', progress_status: 'not_applicable' },
    { progress_status: 'cancelled' },
  ])('preserves cancellation for a non-deliverable service %j', attributes => {
    expect(getServiceProgress(item({ is_deliverable: false, ...attributes }))?.code).toBe('cancelled');
  });
  it.each(['pending', 'processing'])('preserves %s for real floor-plan work without media intake', progress_status => {
    expect(getServiceProgress(item({ name: 'Floor Plan', upload_intake_type: 'none', is_deliverable: true, progress_status }))?.code).toBe(progress_status);
  });
  it('omits operational badges for invoice adjustments', () => {
    expect(getServiceProgress(item({ is_invoice_adjustment: true, is_deliverable: false, progress_status: 'not_applicable' }))).toBeNull();
  });
});
