import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useShootEditModalController } from './useShootEditModalController';

const mocks = vi.hoisted(() => ({ toast: vi.fn(), roster: vi.fn(), projectFetched: (shoot: unknown) => shoot, buildPayload: (payload: unknown) => payload }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '1080', role: 'salesRep' } }) }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => true }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ Authorization: 'Bearer test' }) }));
vi.mock('@/features/shoot-units/useUnitScopedEdit', () => ({ useUnitScopedEdit: () => ({ projectFetched: mocks.projectFetched, buildPayload: mocks.buildPayload }), useUnitEditDirtyTracking: () => false }));
vi.mock('./useShootEditAvailability', () => ({ useShootEditAvailability: () => () => false }));
vi.mock('./useServiceEditorAssignments', () => ({ useServiceEditorAssignments: () => ({ serviceEditorChanges: {} }) }));
vi.mock('@/utils/distanceUtils', () => ({ getCoordinatesFromAddress: vi.fn().mockResolvedValue(null) }));
vi.mock('axios', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { data: [{ id: 1, name: 'Photos', price: 100, photographer_required: true, category: { name: 'Photos' } }] } }) } }));
vi.mock('./shootEditModalTypes', async importOriginal => ({ ...await importOriginal<typeof import('./shootEditModalTypes')>(), loadPhotographerOptions: mocks.roster }));

const roster = [{ id: '1136', name: 'Delmar', email: '' }, { id: '1141', name: 'Harrison', email: '' }];
const shoot = { id: 5866, status: 'scheduled', canReassignPhotographer: true, address: '3806 Bartwood', city: 'Baltimore', state: 'MD', zip: '21201',
  scheduled_at: '2026-11-04T13:00:00', photographer_id: 1141, photographer: roster[1], service_items: [{ service_id: 1, name: 'Photos', price: 100, duration_minutes: 60, photographer_id: 1141 }] };
const checked = { id: 1136, net_available_slots: [{ start_time: '13:00', end_time: '17:00' }] };
const jsonResponse = (data: unknown) => new Response(JSON.stringify({ data }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => { mocks.roster.mockResolvedValue(roster); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
const renderEditor = () => renderHook(() => useShootEditModalController({ isOpen: true, shootId: '5866', onClose: vi.fn() }));

describe('existing shoot photographer picker', () => {
  it('keeps the full roster searchable while checking and after a failed day preview', async () => {
    const preview = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('/for-booking') ? preview.promise : Promise.resolve(jsonResponse(shoot))));
    const { result } = renderEditor();
    await waitFor(() => expect(result.current.photographers).toHaveLength(2));
    expect(result.current.showAllPhotographers).toBe(true);
    act(() => result.current.setPhotographerSearchQuery('Delmar'));
    expect(result.current.filteredPhotographers.map(person => person.id)).toEqual(['1136']);
    await act(async () => preview.resolve(new Response('{}', { status: 503 })));
    await waitFor(() => expect(result.current.pickerAvailability.status).toBe('error'));
    expect(result.current.filteredPhotographers.map(person => person.id)).toEqual(['1136']);
    act(() => result.current.setShowAllPhotographers(false));
    expect(result.current.filteredPhotographers).toEqual([]);
    act(() => result.current.setShowAllPhotographers(true));
    expect(result.current.filteredPhotographers.map(person => person.id)).toEqual(['1136']);
  });

  it('clears the previous date preview while retaining names and ignores its late response', async () => {
    const previous = deferred<Response>(); const next = deferred<Response>();
    let requests = 0;
    vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('/for-booking') ? (++requests === 1 ? previous.promise : next.promise) : Promise.resolve(jsonResponse(shoot))));
    const { result } = renderEditor();
    await waitFor(() => expect(requests).toBe(1));
    act(() => result.current.setScheduledDate(new Date(2026, 10, 5, 12)));
    await waitFor(() => expect(requests).toBe(2));
    expect(result.current.filteredPhotographers).toHaveLength(2);
    await act(async () => next.resolve(jsonResponse([{ id: 1136, net_available_slots: [] }])));
    await waitFor(() => expect(result.current.pickerAvailability.status).toBe('ready'));
    await act(async () => previous.resolve(jsonResponse([checked])));
    expect(result.current.photographerAvailability['1136']).toEqual([]);
  });

  it('allows browsing through a preview outage but cannot save when selected-itinerary feasibility fails', async () => {
    const fetcher = vi.fn((url: string, _options?: RequestInit) => Promise.resolve(url.endsWith('/for-booking') || url.endsWith('/feasibility') ? new Response('{}', { status: 503 }) : jsonResponse(shoot)));
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderEditor();
    await waitFor(() => expect(result.current.shootDetails?.id).toBe(5866));
    act(() => { result.current.openPhotographerPicker(null); result.current.setPickerPhotographerId('1136'); });
    act(() => result.current.handleConfirmPhotographerPicker());
    expect(result.current.photographerId).toBe('1136');
    expect(result.current.travel.payload).not.toBeNull();
    await waitFor(() => expect(result.current.travel.error).toBeTruthy());
    expect(result.current.travel.blocked).toBe(true);
    await act(async () => { await result.current.submitApproval({ notifyClient: false, notifyPhotographer: false, silent: true }); });
    expect(fetcher.mock.calls.some(([, options]) => (options as RequestInit | undefined)?.method === 'PATCH')).toBe(false);
    expect(fetcher.mock.calls.some(([url]) => /\/approve$/.test(url))).toBe(false);
  });

  it('refuses direct picker methods when the server denies reassignment', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse({ ...shoot, canReassignPhotographer: false }))));
    const { result } = renderEditor();
    await waitFor(() => expect(result.current.shootDetails?.id).toBe(5866));
    act(() => { result.current.openPhotographerPicker(null); result.current.setPickerPhotographerId('1136'); });
    act(() => result.current.handleConfirmPhotographerPicker());
    expect(result.current.photographerPickerOpen).toBe(false);
    expect(result.current.photographerId).toBe('1141');
  });
});
