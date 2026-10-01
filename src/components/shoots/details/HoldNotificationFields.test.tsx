import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { transformShootFromApi } from '@/context/shootNormalization';
import { useShootDetailsModalWorkflow } from '../modal/useShootDetailsModalWorkflow';
import { HoldNotificationFields } from './HoldNotificationFields';
import { describeHoldNotifications, getHoldNotificationAvailability, useHoldNotifications } from './useHoldNotifications';

vi.mock('@/hooks/useShootMutationRefresh', () => ({ useShootMutationRefresh: () => vi.fn() }));
vi.mock('@/services/shootEditingDispatch', () => ({ sendShootToEditing: vi.fn() }));
vi.mock('@/services/shootMediaService', () => ({ approveEditingReview: vi.fn(), finalizeEditedUploadQueue: vi.fn(), finalizeRawUploadQueue: vi.fn() }));
vi.mock('@/components/shoots/finalize/finalizeShootWithProgressToast', () => ({ finalizeShootWithProgressToast: vi.fn() }));
const service = { id: '2', name: 'Photos', price: 150, quantity: 1 };
const shoot = {
  id: '14013', status: 'scheduled', client: { id: 2, name: 'Agent', email: 'agent@example.test', phone: '2025550100' },
  photographer: { id: 8, name: 'Photographer', email: 'photo@example.test', phone: '2025550101' },
} as ShootData;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup(isClient = false, response: unknown = { notifications: { requested: true, sent: 1, queued: 1, failed: 0, skipped: 0 } }) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
  vi.stubGlobal('fetch', fetchMock);
  const toast = vi.fn();
  const hook = renderHook(() => useShootDetailsModalWorkflow({ shoot, isClient, canWithdrawRequestedShoot: false,
    canRequestCancellation: isClient, isWithinCancellationFeeWindow: false,
    refreshShoot: vi.fn().mockResolvedValue(shoot), setShoot: vi.fn(), updateShoot: vi.fn(), toast }));
  act(() => { hook.result.current.setIsOnHoldDialogOpen(true); hook.result.current.setOnHoldReason('Waiting for staging'); });
  return { ...hook, fetchMock, toast };
}

describe('hold notification payload', () => {
  it('defaults both available recipients to email and reports actual send result', async () => {
    const { result, fetchMock, toast } = setup();
    await act(async () => { await result.current.handleMarkOnHold(); });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/14013/put-on-hold'), expect.anything());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ reason: 'Waiting for staging', notify_client: true, notify_photographer: true, notification_channels: ['email'] });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('1 sent, 1 queued') }));
  });
  it('sends explicit false flags when both recipients are turned off', async () => {
    const { result, fetchMock, toast } = setup(false, { notifications: { requested: false, sent: 0, queued: 0, failed: 0, skipped: 0 } });
    act(() => { result.current.holdNotifications.setNotifyClient(false); result.current.holdNotifications.setNotifyPhotographer(false); });
    await act(async () => { await result.current.handleMarkOnHold(); });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ notify_client: false, notify_photographer: false });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('No email or SMS notifications were requested.') }));
  });
  it('sends only the selected SMS channel and photographer', async () => {
    const { result, fetchMock } = setup();
    act(() => { result.current.holdNotifications.setChannel('sms', true); result.current.holdNotifications.setChannel('email', false); result.current.holdNotifications.setNotifyClient(false); });
    await act(async () => { await result.current.handleMarkOnHold(); });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ notify_client: false, notify_photographer: true, notification_channels: ['sms'] });
  });
  it('does not attach actual-hold notifications to a client hold request', async () => {
    const { result, fetchMock } = setup(true);
    await act(async () => { await result.current.handleMarkOnHold(); });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/request-hold'), expect.anything());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ reason: 'Waiting for staging' });
  });
  it('reports failed or skipped notifications without describing the saved hold as failed', async () => {
    const { result, toast } = setup(false, { notifications: { requested: true, sent: 1, failed: 1, skipped: 1 } });
    await act(async () => { await result.current.handleMarkOnHold(); });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Shoot put on hold', description: expect.stringContaining('1 sent, 1 failed, 1 skipped') }));
  });
});

function Fields({ data = shoot }: { data?: ShootData }) {
  const options = useHoldNotifications(data, true);
  return <HoldNotificationFields options={options} />;
}
describe('hold notification choices', () => {
  it('lets staff toggle recipients and channels', () => {
    render(<Fields />);
    expect(screen.getByRole('checkbox', { name: 'Notify agent / client' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Notify agent / client' }));
    expect(screen.getByRole('checkbox', { name: 'Notify agent / client' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'SMS' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Email' }));
    expect(screen.getByRole('checkbox', { name: 'SMS' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Email' })).not.toBeChecked();
  });
  it('finds contact details on service-assigned photographers and disables unavailable recipients', () => {
    render(<Fields data={{ ...shoot, client: { ...shoot.client, email: '', phone: undefined }, photographer: { name: 'Unassigned' }, serviceItems: [{ ...service, shoot_service_id: '30', service_id: '2', photographer: { id: 6, name: 'Service photographer', email: 'service@example.test' } }] } as ShootData} />);
    expect(screen.getByRole('checkbox', { name: 'Notify agent / client' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Notify assigned photographer(s)' })).toBeChecked();
  });
  it('excludes a superseded primary and ignores invoice adjustments when finding service assignees', () => {
    const data = { ...shoot, serviceObjects: [{ ...service, photographer_id: '22', photographer: { id: '22', name: 'New photographer' } }],
      serviceItems: [{ ...service, shoot_service_id: '30', service_id: '2', photographer_id: '8', photographer: shoot.photographer }] } as ShootData;
    expect(getHoldNotificationAvailability(data, ['email']).photographerAvailable).toBe(false);
    expect(getHoldNotificationAvailability({ ...shoot, serviceObjects: [{ ...service, photographer_id: '8', photographer: { id: '8', name: 'Current photographer', phone: undefined } }] } as ShootData, ['sms']).photographerAvailable).toBe(true);
    expect(getHoldNotificationAvailability({ ...data, serviceObjects: undefined, serviceItems: [{ ...service, shoot_service_id: '30', service_id: '2', is_invoice_adjustment: true }] } as ShootData, ['email']).photographerAvailable).toBe(true);
    expect(getHoldNotificationAvailability({ ...data, serviceObjects: [...data.serviceObjects!, { ...service, photographer_id: null }] } as ShootData, ['email']).photographerAvailable).toBe(true);
  });
  it('preserves phone details while normalizing the primary photographer fallback for a booked service', () => {
    const normalized = transformShootFromApi({ id: 14013, photographer: { id: 8, name: 'Photographer', phonenumber: '2025550101' }, services: [{ id: 2, name: 'Photos', pivot: { photographer_id: 8 } }] });
    expect(normalized.serviceObjects?.[0].photographer?.phone).toBe('2025550101');
  });
  it('enables phone-only service recipients for SMS and preserves explicit opt-outs across channel changes', () => {
    const data = { ...shoot, serviceObjects: [{ ...service, photographer_id: '22', photographer: { id: '22', name: 'SMS photographer', phone: '2025550122' } }] } as ShootData;
    const { result } = renderHook(() => useHoldNotifications(data, true));
    expect(result.current.payload.notify_photographer).toBe(false);
    act(() => { result.current.setChannel('sms', true); result.current.setChannel('email', false); });
    expect(result.current.payload).toMatchObject({ notify_photographer: true, notification_channels: ['sms'] });
    act(() => { result.current.setNotifyPhotographer(false); result.current.setChannel('email', true); });
    expect(result.current.payload.notify_photographer).toBe(false);
    act(() => { result.current.setChannel('sms', false); });
    expect(result.current.photographerAvailable).toBe(false);
  });
  it('does not claim delivery when an older response has no result', () => {
    expect(describeHoldNotifications({})).toBe('Notification delivery was not confirmed.');
  });
});
