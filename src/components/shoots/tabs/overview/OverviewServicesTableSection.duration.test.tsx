import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { OverviewServicesTableSection, type OverviewServicesTableSectionProps } from './OverviewServicesTableSection';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
afterEach(cleanup);

function props(): OverviewServicesTableSectionProps {
  return {
    isEditMode: true, shoot: { id: '42' } as ShootData, serviceItems: [],
    servicesList: [{ id: '10', name: 'Photos' }, { id: '11', name: 'Video' }], selectedServiceIds: ['10', '11'],
    serviceSchedules: { '10': { date: '', time: '', duration_minutes: 30 } }, effectiveSqft: 2000,
    editModePhotographerRows: [], perCategoryPhotographers: {}, selectedPhotographerIdEdit: '',
    resolvePhotographerDetails: () => null, toggleServiceSelection: vi.fn(), updateServiceSchedule: vi.fn(),
    openEditPhotographerPicker: vi.fn(), getServiceDisplayPrice: () => '$100', getReadonlyServiceDisplayPrice: () => '$100',
    formatServiceLabel: () => 'Photos', serviceDialogOpen: false, setServiceDialogOpen: vi.fn(),
    serviceModalSearch: '', setServiceModalSearch: vi.fn(), servicePanelCategory: 'all', setServicePanelCategory: vi.fn(),
    panelServices: [], isClient: false, isPhotographer: false, isEditor: false,
  };
}

describe('compact overview schedule rows', () => {
  it('keeps service scheduling controls while hiding inline duration controls', () => {
    const options = props();
    render(<OverviewServicesTableSection {...options} />);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /custom duration/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('add-new-service')).toHaveTextContent('Add New');
    expect(screen.getAllByTestId('service-cell')).toHaveLength(2);
    expect(options.updateServiceSchedule).not.toHaveBeenCalled();
    expect(options.toggleServiceSelection).not.toHaveBeenCalled();
  });
  it('does not change saved or tier-derived durations when hiding the picker', () => {
    const options = props();
    options.servicesList[1] = { id: '11', name: 'Video', pricing_type: 'variable',
      sqft_ranges: [{ sqft_from: 1000, sqft_to: 3000, duration: 120, price: 100, photographer_pay: null }] };
    render(<OverviewServicesTableSection {...options} />);
    expect(screen.queryByLabelText('Shoot duration for Video')).not.toBeInTheDocument();
    expect(options.serviceSchedules['10'].duration_minutes).toBe(30);
    expect(options.updateServiceSchedule).not.toHaveBeenCalled();
  });
  it('keeps duration controls out of the read-only overview', () => {
    render(<OverviewServicesTableSection {...props()} isEditMode={false} />);
    expect(screen.queryByLabelText('Shoot duration for Photos')).not.toBeInTheDocument();
  });
});
