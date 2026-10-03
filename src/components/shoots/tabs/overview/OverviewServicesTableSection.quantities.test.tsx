import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { OverviewServicesTableSection } from './OverviewServicesTableSection';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

describe('overview service quantity picker', () => {
  it('uses booked unit prices and applies quantity-only edits without toggling selection', () => {
    const toggle = vi.fn();
    const updateQuantity = vi.fn();
    const service = { id: '10', name: 'Photos', price: 100, category: 'Photos', allow_multiple: true };
    render(<OverviewServicesTableSection
      isEditMode shoot={{ id: '42', canRemoveAllServices: true } as unknown as ShootData}
      serviceItems={[]} servicesList={[service]} selectedServiceIds={['10']}
      serviceQuantities={{ '10': 2 }} servicePrices={{ '10': '90' }} updateServiceQuantity={updateQuantity}
      serviceSchedules={{}} effectiveSqft={2000} editModePhotographerRows={[]} perCategoryPhotographers={{}}
      selectedPhotographerIdEdit="" resolvePhotographerDetails={() => null} toggleServiceSelection={toggle}
      updateServiceSchedule={vi.fn()} openEditPhotographerPicker={vi.fn()} getServiceDisplayPrice={() => '$180.00'}
      getReadonlyServiceDisplayPrice={() => '$180.00'} formatServiceLabel={() => 'Photos × 2'}
      serviceDialogOpen setServiceDialogOpen={vi.fn()} serviceModalSearch="" setServiceModalSearch={vi.fn()}
      servicePanelCategory="all" setServicePanelCategory={vi.fn()} panelServices={[service]}
      isClient={false} isPhotographer={false} isEditor={false}
    />);
    expect(screen.getByText('2 items selected')).toBeInTheDocument();
    expect(screen.getAllByText('$180.00').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Increase Photos quantity' }));
    expect(updateQuantity).toHaveBeenCalledWith('10', 3);
    expect(toggle).not.toHaveBeenCalled();
  });
});
