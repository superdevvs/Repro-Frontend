import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ShootData } from '@/types/shoots';
import { OverviewServicesTableSection } from './OverviewServicesTableSection';

describe('OverviewServicesTableSection comp rows', () => {
  it('shows an existing catalog service again as a separate complimentary row', () => {
    const service = { id: '10', name: 'Photography', price: 125, category: 'Photos' };
    const compService = {
      ...service,
      id: '501',
      price: 0,
      sourceShootServiceId: '501',
      catalogServiceId: '10',
      defaultPhotographerId: '9',
    };

    render(
      <OverviewServicesTableSection
        isEditMode
        shoot={{ id: '42', canRemoveAllServices: true } as unknown as ShootData}
        serviceItems={[]}
        servicesList={[service]}
        selectedServiceIds={['10']}
        serviceSchedules={{ '10': { date: '2026-09-01', time: '10:00' } }}
        effectiveSqft={null}
        editModePhotographerRows={[]}
        perCategoryPhotographers={{ photo: '9' }}
        selectedPhotographerIdEdit="9"
        resolvePhotographerDetails={() => ({ id: '9', name: 'Pat Photographer', email: 'pat@example.test' })}
        toggleServiceSelection={vi.fn()}
        updateServiceSchedule={vi.fn()}
        openEditPhotographerPicker={vi.fn()}
        getServiceDisplayPrice={() => '$125'}
        getReadonlyServiceDisplayPrice={() => '$125'}
        formatServiceLabel={() => 'Photography'}
        serviceDialogOpen={false}
        setServiceDialogOpen={vi.fn()}
        serviceModalSearch=""
        setServiceModalSearch={vi.fn()}
        servicePanelCategory="all"
        setServicePanelCategory={vi.fn()}
        panelServices={[service]}
        isClient={false}
        isPhotographer={false}
        isEditor={false}
        isAdmin
        complimentary={{
          enabled: false,
          onEnabledChange: vi.fn(),
          sourceServices: [compService],
          selectedSourceServiceIds: ['501'],
          schedules: { '501': { date: '2026-09-12', time: '11:30' } },
          photographerIds: { '501': '9' },
          reasonCode: 'company_error',
          onReasonCodeChange: vi.fn(),
          reasonNote: '',
          onReasonNoteChange: vi.fn(),
          clientPays: false,
          onClientPaysChange: vi.fn(),
          payPhotographer: false,
          onPayPhotographerChange: vi.fn(),
          paySalesRep: false,
          onPaySalesRepChange: vi.fn(),
          hasSalesRep: true,
          toggleServiceSelection: vi.fn(),
          updateServiceSchedule: vi.fn(),
        }}
      />,
    );

    expect(screen.getAllByText('Photography')).toHaveLength(2);
    const compRow = screen.getByTestId('comp-service-row-501');

    expect(compRow).toHaveTextContent('Comp');
    expect(compRow).toHaveTextContent('$0');
    expect(compRow).toHaveClass('grid', 'sm:table-row');
    expect(compRow.querySelector('button[aria-label="Remove complimentary Photography"]')?.parentElement)
      .toHaveClass('col-start-1');
  });
});
