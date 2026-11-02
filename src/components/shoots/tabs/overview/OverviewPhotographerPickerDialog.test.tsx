import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverviewPhotographerPickerDialog } from './OverviewPhotographerPickerDialog';
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/photographers/map/PhotographerPickerMapShell', () => ({ PhotographerPickerMapShell: ({ list }: { list: import('react').ReactNode }) => <>{list}</> }));
vi.mock('@/components/photographers/PhotographerAvailabilityTimeline', () => ({ PhotographerAvailabilityTimeline: () => <div>Checked timeline</div> }));
afterEach(cleanup);
const props = () => ({ open: true, onOpenChange: vi.fn(), photographerPickerContext: null, isEditMode: true, searchQuery: '', setSearchQuery: vi.fn(),
  sortBy: 'distance' as const, setSortBy: vi.fn(), showAllPhotographers: true, setShowAllPhotographers: vi.fn(), isCalculatingDistances: false, isLoadingAvailability: false,
  filteredAndSortedPhotographers: [{ id: '1136', name: 'Delmar', email: '' }, { id: '1141', name: 'Harrison', email: '' }], selectedPhotographerId: '',
  setSelectedPhotographerId: vi.fn(), formatLocationLabel: () => '', formatAvailabilitySummary: () => '', handleAssignPhotographer: vi.fn(),
  photographerRoster: { status: 'ready' as const, retry: vi.fn() },
});
describe('photographer picker status', () => {
  it('shows selectable names during a pending preview and makes availability filtering explicit', () => {
    const options = props();
    render(<OverviewPhotographerPickerDialog {...options} isLoadingAvailability pickerAvailability={{ status: 'loading', byId: new Map(), error: undefined, retry: vi.fn() }} />);
    expect(screen.getByText('Delmar')).toBeVisible();
    expect(screen.getByText('Harrison')).toBeVisible();
    expect(screen.getByText('Checking availability. You can browse photographers now.')).toBeVisible();
    expect(screen.queryByText('Checked timeline')).toBeNull();
    const filter = screen.getByRole('button', { name: 'Available only' });
    expect(filter).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(filter);
    expect(options.setShowAllPhotographers).toHaveBeenCalled();
  });
  it('keeps names visible with explicit failure and retry instead of showing stale timelines', () => {
    const retry = vi.fn();
    render(<OverviewPhotographerPickerDialog {...props()} pickerAvailability={{ status: 'error', byId: new Map(), error: 'Unable to check availability. Please retry.', retry }} />);
    expect(screen.getByText('Delmar')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to check availability');
    expect(screen.getAllByText('Availability check failed')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Retry availability' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByText('Checked timeline')).toBeNull();
  });
});
