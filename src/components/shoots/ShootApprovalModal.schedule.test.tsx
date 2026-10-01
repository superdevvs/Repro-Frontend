import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootApprovalModal } from './ShootApprovalModal';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/shoots/ServiceSchedulePicker', () => ({
  ServiceDatePicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    <input aria-label="Schedule date" value={value} onChange={event => onChange(event.target.value)} />,
  ServiceTimePicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    <input aria-label="Schedule time" value={value} onChange={event => onChange(event.target.value)} />,
}));

const photographers = [{ id: 9, name: 'QA Photographer' }];
let fetchMock: ReturnType<typeof vi.fn>;
const buildShoot = (timezone: string | null = null) => ({
  id: 42, address: '42 Service Lane', timezone, photographer_id: 9,
  scheduled_at: timezone ? '2026-10-06T14:30:00Z' : '2026-10-06T10:30:00.000000Z',
  service_items: [
    { service_id: 10, name: 'Photos', price: 100, scheduled_at: timezone ? '2026-10-06T14:30:00Z' : '2026-10-06T10:30:00.000000Z' },
    { service_id: 11, name: 'Floorplan', price: 50, scheduled_at: timezone ? '2026-10-07T14:30:00Z' : '2026-10-07T10:30:00.000000Z' },
    { service_id: 12, name: 'Video', price: 50, scheduled_at: null },
  ],
});
let fetchedShoot: ReturnType<typeof buildShoot>;

beforeEach(() => {
  fetchedShoot = buildShoot();
  fetchMock = vi.fn(async (url: RequestInfo | URL) => ({
    ok: true, json: async () => String(url).includes('/api/shoots/') ? { data: fetchedShoot } : { data: [] },
  }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const changeMainDate = (value: string) => fireEvent.change(screen.getAllByLabelText('Schedule date')[0], { target: { value } });
const changeMainTime = (value: string) => fireEvent.change(screen.getAllByLabelText('Schedule time')[0], { target: { value } });
const loadModal = async () => {
  const props = { isOpen: true, shootId: 42, photographers, onClose: vi.fn(), onApproved: vi.fn() };
  const view = render(<ShootApprovalModal {...props} />);
  await waitFor(() => expect(screen.getAllByLabelText('Schedule time')[0]).toHaveValue('10:30'));
  return { ...view, props };
};
const approve = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Approve Shoot' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/42/approve'))).toBe(true));
  const request = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/42/approve'));
  return JSON.parse(String(request?.[1]?.body));
};

describe('approval schedule inheritance', () => {
  it('shows catalogue tier duration for a null snapshot and preserves a stored30-minute visit', async () => {
    Object.assign(fetchedShoot, { sqft: 1000 });
    Object.assign(fetchedShoot.service_items[0], { duration_minutes: null, pricing_type: 'variable',
      sqft_ranges: [{ sqft_from: 1, sqft_to: 2000, duration: 90 }] });
    Object.assign(fetchedShoot.service_items[1], { duration_minutes: 30 });
    await loadModal();
    expect(screen.getByLabelText('Shoot duration for Photos')).toHaveValue('90');
    expect(screen.getByLabelText('Shoot duration for Floorplan')).toHaveValue('30');
    const payload = await approve();
    expect(payload.service_items).toEqual(expect.arrayContaining([
      expect.objectContaining({ service_id: 10, duration_minutes: 90 }),
      expect.objectContaining({ service_id: 11, duration_minutes: 30 }),
    ]));
  });
  it('preserves individual duration changes through main time edits and Apply all', async () => {
    await loadModal();
    expect(screen.getByLabelText('Shoot duration for Photos')).toHaveValue('60');
    fireEvent.change(screen.getByLabelText('Shoot duration for Photos'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Shoot duration for Floorplan'), { target: { value: '120' } });
    changeMainTime('13:00');
    fireEvent.click(screen.getAllByRole('button', { name: 'Apply this date and time to all services' })[0]);
    const payload = await approve();
    expect(payload.service_items).toEqual(expect.arrayContaining([
      expect.objectContaining({ service_id: 10, duration_minutes: 30, scheduled_at: '2026-10-06T13:00:00' }),
      expect.objectContaining({ service_id: 11, duration_minutes: 120, scheduled_at: '2026-10-06T13:00:00' }),
    ]));
  });
  it.each([null, 'America/New_York'])('moves inherited services while keeping a coinciding separate visit in %s', async timezone => {
    fetchedShoot = buildShoot(timezone);
    await loadModal();
    // This first edit makes the main schedule coincide with the separate visit.
    changeMainDate('2026-10-07');
    changeMainTime('12:00');
    const payload = await approve();
    const expectedMain = timezone ? '2026-10-07T16:00:00.000Z' : '2026-10-07T12:00:00';
    expect(payload.scheduled_at).toBe(expectedMain);
    expect(payload.service_items).toEqual([
      expect.objectContaining({ service_id: 10, scheduled_at: expectedMain }),
      expect.objectContaining({ service_id: 11, scheduled_at: timezone ? '2026-10-07T14:30:00.000Z' : '2026-10-07T10:30:00' }),
      expect.objectContaining({ service_id: 12, scheduled_at: expectedMain }),
    ]);
  });

  it('keeps an explicit service appointment independent of subsequent main edits', async () => {
    await loadModal();
    const section = screen.getByText('Service Schedules').parentElement!.parentElement!;
    fireEvent.change(within(section).getAllByLabelText('Schedule time')[0], { target: { value: '14:00' } });
    changeMainDate('2026-10-08');
    changeMainTime('12:00');
    const payload = await approve();
    expect(payload.service_items).toEqual(expect.arrayContaining([
      expect.objectContaining({ service_id: 10, scheduled_at: '2026-10-06T14:00:00' }),
      expect.objectContaining({ service_id: 12, scheduled_at: '2026-10-08T12:00:00' }),
    ]));
  });

  it('keeps explicitly copied service appointments after later main edits', async () => {
    await loadModal();
    const section = screen.getByText('Service Schedules').parentElement!.parentElement!;
    fireEvent.change(within(section).getAllByLabelText('Schedule time')[0], { target: { value: '14:00' } });
    const sourceTimeField = within(section).getByDisplayValue('14:00');
    fireEvent.click(within(sourceTimeField.parentElement!).getByRole('button', { name: 'Apply this date and time to all services' }));
    changeMainDate('2026-10-08');
    changeMainTime('12:00');
    const payload = await approve();
    expect(payload.scheduled_at).toBe('2026-10-08T12:00:00');
    expect(payload.service_items).toEqual([10, 11, 12].map(service_id =>
      expect.objectContaining({ service_id, scheduled_at: '2026-10-06T14:00:00' })));
  });

  it('reclassifies inheritance when reopened with refreshed service appointments', async () => {
    const { rerender, props } = await loadModal();
    rerender(<ShootApprovalModal {...props} isOpen={false} />);
    fetchedShoot = { ...buildShoot(), service_items: [
      { service_id: 10, name: 'Photos', price: 100, scheduled_at: '2026-10-07T10:30:00.000000Z' },
      { service_id: 11, name: 'Floorplan', price: 50, scheduled_at: '2026-10-06T10:30:00.000000Z' },
    ] };
    rerender(<ShootApprovalModal {...props} />);
    await waitFor(() => expect(screen.getAllByLabelText('Schedule time')[0]).toHaveValue('10:30'));
    changeMainDate('2026-10-07');
    changeMainTime('12:00');
    const payload = await approve();
    expect(payload.service_items).toEqual([
      expect.objectContaining({ service_id: 10, scheduled_at: '2026-10-07T10:30:00' }),
      expect.objectContaining({ service_id: 11, scheduled_at: '2026-10-07T12:00:00' }),
    ]);
  });
});
