import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData, ShootServiceObject } from '@/types/shoots';
import type { MediaFile } from '@/hooks/useShootFiles';
import { getShootServiceItems } from '@/utils/shootServiceItems';
import { OverviewServiceRows } from './OverviewServiceRows';
import { countServicePhotos } from './serviceImageCounts';

const mocks = vi.hoisted(() => ({ role: 'admin', raw: [] as MediaFile[], edited: [] as MediaFile[], loaded: true, files: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '5', role: mocks.role } }) }));
vi.mock('@/hooks/useShootFiles', () => ({ useShootFiles: (id: unknown, type: string, options: { enabled: boolean }) => {
  mocks.files(id, type, options);
  return { data: mocks.loaded && options.enabled ? (type === 'raw' ? mocks.raw : mocks.edited) : undefined };
} }));
const services = [
  { id: '1', shoot_service_id: '11', name: 'Professional HDR Interior & Exterior Photography', photo_count: 45,
    upload_intake_type: 'photo', uses_hdr_brackets: true, effective_bracket_mode: 5, price: 275, quantity: 1,
    scheduled_at: '2026-10-08T10:00:00', photographer: { id: '5', name: 'Christopher Alexander Johnson' } },
  { id: '2', shoot_service_id: '12', name: 'Aerial Photos', photo_count: 10, upload_intake_type: 'photo', price: 100, quantity: 1 },
  { id: '3', shoot_service_id: '13', name: 'Zillow 3D w/Floor plans', upload_intake_type: 'none', price: 150, quantity: 1 },
] as ShootServiceObject[];
const shoot = { id: '42', serviceItems: services } as ShootData;
const photo = (id: string, extra = false): MediaFile => ({ id: Math.random().toString(), shoot_service_id: id, filename: 'photo.CR3', isExtra: extra });
function mount(role = 'admin', source = shoot, isClient = role === 'client') {
  mocks.role = role;
  return render(<OverviewServiceRows shoot={source} serviceItems={getShootServiceItems(source)} role={role}
    isClient={isClient} isPhotographer={role === 'photographer'} isEditor={role === 'editor'} isAdmin={role === 'admin'}
    formatServiceLabel={value => (value as ShootServiceObject).name} getReadonlyServiceDisplayPrice={value => `$${(value as ShootServiceObject).price.toFixed(2)}`} />);
}
beforeEach(() => { mocks.files.mockClear(); mocks.loaded = true; mocks.raw = [photo('11'), photo('11'), photo('12'), photo('11', true), photo('')]; mocks.edited = [photo('11')]; });
afterEach(cleanup);
describe('compact service rows', () => {
  it.each(['admin', 'superadmin', 'editing_manager', 'salesRep', 'editor'])('shows distinct per-service counts for %s', role => {
    mount(role);
    const hdr = within(screen.getByTestId('service-summary-11'));
    expect(hdr.getByLabelText('Image counts')).toHaveTextContent('RequiredReq45Raw2/225Edited1/45');
    expect(within(screen.getByTestId('service-summary-12')).getByLabelText('Image counts')).toHaveTextContent('Raw1/10Edited0/10');
    expect(within(screen.getByTestId('service-summary-13')).queryByLabelText('Image counts')).not.toBeInTheDocument();
    expect(hdr.getByLabelText(`${role === 'editor' ? 'Pay' : 'Price'} $275.00`)).toBeVisible();
  });
  it('preserves full names and places the schedule next to the service, above the photographer and counts', () => {
    mount();
    expect(screen.getByText(services[0].name).closest('.service-row-heading')).toContainElement(screen.getByLabelText('Oct 8, 2026 · 10:00 AM'));
    expect(screen.getByText('Christopher Alexander Johnson').closest('.service-row-bottom')).toContainElement(screen.getAllByLabelText('Image counts')[0]);
  });
  it('shows the assigned digital editor without inheriting a stale photographer', () => {
    mount('admin', { ...shoot, serviceItems: [{ ...services[0], name: 'Green Grass Enhancement', category: { id: 'digital', name: 'Digital Enhancements' },
      photographer_required: true, upload_intake_type: 'none', editor: { id: '8', name: 'Photo Editor' } }] });
    const row = within(screen.getByTestId('service-summary-11'));
    expect(row.getByText('Photo Editor')).toBeVisible();
    expect(row.queryByText('Christopher Alexander Johnson')).not.toBeInTheDocument();
    expect(row.queryByLabelText('Image counts')).not.toBeInTheDocument();
  });
  it('shows required/raw and avoids requesting edited files for photographers', () => {
    mount('photographer');
    expect(screen.queryByText('Edited')).not.toBeInTheDocument();
    expect(mocks.files).toHaveBeenCalledWith('42', 'edited', { enabled: false });
    expect(screen.getByLabelText('Pay $275.00')).toBeVisible();
  });
  it('hides internal counts for clients even when staff role flags conflict', () => {
    mount('admin', shoot, true);
    expect(screen.queryByLabelText('Image counts')).not.toBeInTheDocument();
    expect(mocks.files.mock.calls.every(call => call[2].enabled === false)).toBe(true);
  });
  it('does not show a false zero during loading or a failed media request', () => {
    mocks.loaded = false; mount();
    expect(screen.getAllByLabelText('Image counts')[0]).toHaveTextContent('Raw—/225Edited—/45');
  });
  it('uses the supplied unit or editor scope and does not invent photo counts for video-only work', () => {
    mount('editor', { ...shoot, serviceItems: [{ ...services[1], upload_intake_type: 'video' }] });
    expect(screen.queryByText(services[0].name)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Image counts')).not.toBeInTheDocument();
    expect(mocks.files.mock.calls.every(call => call[2].enabled === false)).toBe(true);
  });
  it('counts photos by execution row, excludes extras/video, and accepts the camel-case alias', () => {
    expect(countServicePhotos([photo('11'), photo('12'), photo('11', true), { ...photo('11'), filename: 'video.mp4' },
      { ...photo(''), shootServiceId: '11', shoot_service_id: null }], '11')).toBe(2);
  });
});
