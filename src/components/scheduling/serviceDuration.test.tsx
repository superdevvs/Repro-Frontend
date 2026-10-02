import { createRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { ServicesTab, type ServicesTabHandle } from './ServicesTab';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn<typeof fetch>(),
  toast: vi.fn(),
  invalidateQueries: vi.fn(),
  categories: [{ id: '1', name: 'Photos', is_default: true }],
  groups: [],
}));

vi.mock('axios', () => ({ default: { put: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/use-page-loading', () => ({ usePageLoading: () => undefined }));
vi.mock('@/hooks/useServiceCategories', () => ({
  useServiceCategories: () => ({ data: mocks.categories, isLoading: false, refetch: vi.fn() }),
}));
vi.mock('@/hooks/useServiceGroups', () => ({ useServiceGroups: () => ({ data: mocks.groups }) }));
vi.mock('@/components/settings/CategorySelect', () => ({ CategorySelect: () => null }));
vi.mock('./IconPicker', () => ({ IconPicker: () => null, getIconComponent: () => () => null }));

function serveCatalog(services: unknown[]) {
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: services }) } as Response);
}

function renderCatalog() {
  const ref = createRef<ServicesTabHandle>();
  render(<>
    <button onClick={() => ref.current?.openAddService()}>Open new service</button>
    <ServicesTab ref={ref} />
  </>);
}

describe('Scheduling catalog shoot duration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocks.fetch);
    localStorage.setItem('authToken', 'test-session');
    vi.mocked(axios.put).mockResolvedValue({ data: {} });
    serveCatalog([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem('authToken');
  });

  it.each([
    { saved: undefined, expected: 60 },
    { saved: null, expected: 60 },
    { saved: 30, expected: 30 },
    { saved: 45, expected: 45 },
  ])('hydrates and preserves saved duration $saved as $expected minutes', async ({ saved, expected }) => {
    serveCatalog([{
      id: 7, name: 'HDR Photos', price: 150, delivery_time: 24,
      shoot_duration_minutes: saved, category: { id: 1, name: 'Photos' },
    }]);
    renderCatalog();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    expect(screen.getByRole('slider', { name: 'Shoot duration for HDR Photos' })).toHaveValue(String(expected));
    expect(screen.getByLabelText('Delivery Time (hours)')).toHaveValue(24);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/services/7'),
      expect.objectContaining({ shoot_duration_minutes: expected, delivery_time: 24 }),
      expect.any(Object),
    ));
  });

  it('saves an edited shoot duration independently from delivery turnaround', async () => {
    serveCatalog([{
      id: 7, name: 'HDR Photos', price: 150, delivery_time: 48,
      shoot_duration_minutes: 45, category: { id: 1, name: 'Photos' },
    }]);
    renderCatalog();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Shoot duration for HDR Photos' }), {
      target: { value: '90' },
    });
    expect(screen.getByLabelText('Delivery Time (hours)')).toHaveValue(48);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/services/7'),
      expect.objectContaining({ shoot_duration_minutes: 90, delivery_time: 48 }),
      expect.any(Object),
    ));
  });

  it.each([60, 90])('creates a service with %s minutes and resets the next draft to one hour', async (minutes) => {
    renderCatalog();
    await screen.findByText('No services in this category');
    fireEvent.click(screen.getByRole('button', { name: 'Open new service' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Photographer Required' }));
    expect(screen.getByRole('slider', { name: 'Shoot duration for new service' })).toHaveValue('60');
    fireEvent.change(screen.getByLabelText('Service Name'), { target: { value: 'New HDR Photos' } });
    fireEvent.change(screen.getByLabelText('Price ($)'), { target: { value: '175' } });
    fireEvent.change(screen.getByLabelText('Delivery Time (hours)'), { target: { value: '24' } });
    if (minutes !== 60) {
      fireEvent.change(screen.getByRole('slider', { name: 'Shoot duration for New HDR Photos' }), {
        target: { value: String(minutes) },
      });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save Service' }));

    await waitFor(() => expect(mocks.fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true));
    const createCall = mocks.fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(String(createCall?.[0])).toContain('/api/admin/services');
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      name: 'New HDR Photos', category_id: 1, shoot_duration_minutes: minutes, delivery_time: 24,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Open new service' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Photographer Required' }));
    expect(screen.getByRole('slider', { name: 'Shoot duration for new service' })).toHaveValue('60');
  });
});
