import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from '@/context/shootNormalization';
import { canClientOpenIguide, getShootClientReleaseAccess } from '@/components/shoots/details/shootClientReleaseAccess';
import { hasClientVisibleDeliveredService } from './dashboardDerivedUtils';
import { clientServicePaymentText, getShootDeliveryProgress } from './shootDeliveryProgress';
import { getShootServiceItems } from './shootServiceItems';

const fixture = (paid = 0) => transformShootFromApi({ id: 42, status: 'editing', workflow_status: 'editing',
  delivery_status: 'partially_delivered', total_quote: 400, total_paid: paid,
  payment_status: paid > 0 ? 'partial' : 'unpaid', service_items: [
    { id: 11, service_id: 1, name: 'Photos and iGUIDE', price: 300, quantity: 1, is_deliverable: true,
      paid_amount: paid, balance_due: 300 - paid, is_unlocked_for_delivery: paid === 300, delivery_status: 'pending',
      delivery_components: [{ kind: 'photo', label: 'Photos', status: 'delivered' },
        { kind: 'tour', label: 'Property tour', status: 'delivered' },
        { kind: 'floorplan', label: 'Floorplan', status: 'pending' }] },
    { id: 12, service_id: 2, name: 'Video', price: 100, quantity: 1, is_deliverable: true,
      is_unlocked_for_delivery: false, delivery_status: 'pending',
      delivery_components: [{ kind: 'video', label: 'Video', status: 'pending' }] },
  ] });

describe('partial delivery and payment access', () => {
  it('keeps unpaid partial deliveries discoverable and preserves component progress through normalization', () => {
    const shoot = fixture();
    expect(shoot.deliveryStatus).toBe('partially_delivered');
    expect(hasClientVisibleDeliveredService(shoot)).toBe(true);
    expect(getShootDeliveryProgress(shoot)).toMatchObject({ isDelivering: true, hasReleasedContent: true, delivered: 0, total: 2 });
    expect(getShootServiceItems(shoot)[0].source.delivery_components).toHaveLength(3);
    expect(getShootClientReleaseAccess(shoot, true)).toMatchObject({ canClientDownload: false, canClientAccessTours: false });
  });
  it('unlocks paid released parts of a bundle without unlocking the entire shoot', () => {
    const shoot = fixture(300);
    expect(getShootClientReleaseAccess(shoot, true)).toMatchObject({ canClientDownload: true,
      canClientAccessTours: true, canClientDownloadWholeShoot: false, isClientReleaseLocked: true });
    expect(clientServicePaymentText(getShootServiceItems(shoot)[0])).toBe('Paid');
  });
  it('a half payment does not unlock the bundle', () => {
    const shoot = fixture(150);
    expect(getShootClientReleaseAccess(shoot, true).canClientDownload).toBe(false);
    expect(clientServicePaymentText(getShootServiceItems(shoot)[0])).toBe('$150.00 paid · $150.00 due');
  });
  it('opens only a paid, released tour and keeps pending or no-content tours closed', () => {
    expect(canClientOpenIguide(fixture())).toBe(false);
    expect(canClientOpenIguide(fixture(150))).toBe(false);
    expect(canClientOpenIguide(fixture(300))).toBe(true);
    const pending = fixture(300);
    pending.serviceItems![0].delivery_components![1].status = 'ready';
    expect(canClientOpenIguide(pending)).toBe(false);
    pending.payment = { ...pending.payment, paymentStatus: 'paid', totalPaid: 400, totalQuote: 400 };
    expect(canClientOpenIguide(pending)).toBe(false);
    pending.serviceItems![0].delivery_components![1] = { kind: 'tour', label: 'Property tour', status: 'delivered', without_content: true };
    expect(canClientOpenIguide(pending)).toBe(false);
    expect(canClientOpenIguide({ ...fixture(300), workflowStatus: 'cancelled' })).toBe(false);
  });
  it('does not present a pre-discount or pre-tax allocation balance as the amount to pay', () => {
    expect(clientServicePaymentText(getShootServiceItems(fixture(150))[0], false, false)).toBe('Part-paid');
    expect(clientServicePaymentText(getShootServiceItems(fixture())[0], false, false)).toBe('Unpaid');
    expect(clientServicePaymentText(getShootServiceItems(fixture(300))[0], false, false)).toBe('Paid');
  });
  it('does not advertise no-content completion or a cancelled shoot as usable media', () => {
    const shoot = fixture();
    shoot.deliveryStatus = 'delivered';
    shoot.serviceItems = [ { ...shoot.serviceItems![0], delivery_components: [{ kind: 'photo', label: 'Photos', status: 'delivered', without_content: true }] } ];
    expect(getShootDeliveryProgress(shoot).hasReleasedContent).toBe(false);
    expect(getShootDeliveryProgress({ ...fixture(), workflowStatus: 'cancelled' }).hasReleasedContent).toBe(false);
  });
});
