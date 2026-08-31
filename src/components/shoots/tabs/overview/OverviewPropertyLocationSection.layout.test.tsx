import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import type { ShootData } from '@/types/shoots';
import { OverviewPropertyLocationSection } from './OverviewPropertyLocationSection';

describe('OverviewPropertyLocationSection layout', () => {
  it('places Location above the responsive Property Details and Property Access row', () => {
    render(
      <OverviewPropertyLocationSection
        isEditMode={false}
        propertyMetrics={[]}
        propertyMetricsEdit={{ beds: '', baths: '', sqft: '' }}
        setPropertyMetricsEdit={vi.fn()}
        addressInput=""
        setAddressInput={vi.fn()}
        editedShoot={{}}
        shoot={{} as ShootData}
        updateField={vi.fn()}
        clearAddressDerivedState={vi.fn()}
        handleAddressSelect={vi.fn()}
        getLocationAddress={() => '9137 Lakeland Valley Court'}
        locationDetails={{ city: 'Springfield', state: 'VA', zip: '22153' }}
        hasWeatherDetails={false}
        formattedTemperature={null}
        weatherDescription={null}
        weatherIcon={null}
        rightSlot={<div data-testid="property-access">Property Access</div>}
      />,
    );

    const locationLabel = screen.getByText('Location');
    const propertyDetailsLabel = screen.getByText('Property details');
    const propertyAccess = screen.getByTestId('property-access');
    const detailsColumn = propertyDetailsLabel.parentElement?.parentElement;
    const supportingRow = detailsColumn?.parentElement;
    const accessColumn = propertyAccess.parentElement;

    expect(locationLabel.compareDocumentPosition(propertyDetailsLabel))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(supportingRow).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-5', 'items-stretch');
    expect(detailsColumn).toHaveClass('md:col-span-3', 'min-w-0');
    expect(accessColumn).toHaveClass('md:col-span-2', 'min-w-0');
    expect(supportingRow).toContainElement(propertyAccess);
  });
});
