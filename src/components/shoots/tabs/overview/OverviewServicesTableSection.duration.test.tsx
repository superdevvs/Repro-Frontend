import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('inline overview duration picker', () => {
  it('shows a saved30-minute service and default1hour, then sends numeric edits for the correct service', () => {
    const options = props();
    render(<OverviewServicesTableSection {...options} />);
    expect(screen.getByLabelText('Shoot duration for Photos')).toHaveValue('30');
    expect(screen.getByLabelText('Shoot duration for Video')).toHaveValue('60');
    fireEvent.change(screen.getByLabelText('Shoot duration for Photos'), { target: { value: '90' } });
    expect(options.updateServiceSchedule).toHaveBeenCalledWith('10', 'duration_minutes', 90);
    expect(options.toggleServiceSelection).not.toHaveBeenCalled();
  });
  it('uses the matching square-footage tier when no snapshot is saved', () => {
    const options = props();
    options.servicesList[1] = { id: '11', name: 'Video', pricing_type: 'variable',
      sqft_ranges: [{ sqft_from: 1000, sqft_to: 3000, duration: 120, price: 100, photographer_pay: null }] };
    render(<OverviewServicesTableSection {...options} />);
    expect(screen.getByLabelText('Shoot duration for Video')).toHaveValue('120');
  });
  it('keeps duration controls out of the read-only overview', () => {
    render(<OverviewServicesTableSection {...props()} isEditMode={false} />);
    expect(screen.queryByLabelText('Shoot duration for Photos')).not.toBeInTheDocument();
  });
});
