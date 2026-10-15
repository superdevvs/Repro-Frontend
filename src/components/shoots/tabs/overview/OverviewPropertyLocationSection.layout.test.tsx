import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import type { ShootData } from '@/types/shoots';
import { OverviewPropertyLocationSection } from './OverviewPropertyLocationSection';

describe('OverviewPropertyLocationSection layout', () => {
  it('exposes year built only in edit mode and labels the blank value as unknown', () => {
    const setYear = vi.fn();
    const props = {
      propertyMetrics: [{ label: 'Year built', icon: (() => null) as never, value: '2026' }],
      propertyMetricsEdit: { beds: '', baths: '', sqft: '' }, setPropertyMetricsEdit: vi.fn(),
      propertyYearBuiltEdit: '', setPropertyYearBuiltEdit: setYear, addressInput: '', setAddressInput: vi.fn(),
      editedShoot: {}, shoot: {} as ShootData, updateField: vi.fn(), clearAddressDerivedState: vi.fn(),
      handleAddressSelect: vi.fn(), getLocationAddress: () => '', locationDetails: {}, hasWeatherDetails: false,
      formattedTemperature: null, weatherDescription: null, weatherIcon: null,
    };
    const view = render(<OverviewPropertyLocationSection {...props} isEditMode={false} />);
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Year built' })).not.toBeInTheDocument();
    view.rerender(<OverviewPropertyLocationSection {...props} isEditMode />);
    const input = screen.getByRole('textbox', { name: 'Year built' });
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', 'Unknown');
    fireEvent.change(input, { target: { value: '2026' } });
    expect(setYear).toHaveBeenCalledWith('2026');
  });

  it('groups details, access and instructions above the separate location and unit selector', () => {
    render(
      <OverviewPropertyLocationSection
        isEditMode={false}
        propertyMetrics={[]}
        propertyMetricsEdit={{ beds: '', baths: '', sqft: '' }}
        setPropertyMetricsEdit={vi.fn()}
        propertyYearBuiltEdit=""
        setPropertyYearBuiltEdit={vi.fn()}
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
        adoptedScheduleDisplay="30 September 2026 · 3:10 PM"
        rightSlot={<div data-testid="property-access">Property Access</div>}
        bottomSlot={<div data-testid="access-instructions">Use the side entrance</div>}
        unitSelector={<button data-testid="unit-selector">Change unit</button>}
      />,
    );

    const locationLabel = screen.getByText('Location');
    const propertyDetailsLabel = screen.getByText('Property details');
    const propertyAccess = screen.getByTestId('property-access');
    const detailsColumn = screen.getByLabelText('Property details');
    const supportingRow = detailsColumn?.parentElement;
    const accessColumn = propertyAccess.parentElement;
    const combinedCard = screen.getByLabelText('Property details and access');
    const instructions = screen.getByTestId('access-instructions');

    expect(propertyDetailsLabel.compareDocumentPosition(locationLabel))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(accessColumn?.parentElement).toBe(supportingRow);
    expect(supportingRow).toContainElement(propertyAccess);
    expect(combinedCard).toContainElement(supportingRow);
    expect(instructions.parentElement).toBe(combinedCard);
    expect(supportingRow).not.toContainElement(instructions);
    expect(instructions.compareDocumentPosition(locationLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const selector = screen.getByTestId('unit-selector');
    const locationCard = locationLabel.closest('.bg-card');
    expect(locationCard).toContainElement(selector);
    expect(locationCard).toContainElement(screen.getByText('9137 Lakeland Valley Court'));
    expect(screen.getByTestId('overview-location-address')).toHaveClass('select-text', 'cursor-text');
    expect(screen.getByTestId('overview-location-address').tagName).not.toBe('BUTTON');
    expect(screen.getByTestId('overview-location-locality')).toHaveClass('select-text');
    const schedule = screen.getByTestId('overview-location-schedule');
    const locality = screen.getByTestId('overview-location-locality');
    expect(schedule).toHaveTextContent('30 September 2026 · 3:10 PM');
    expect(locationCard).toContainElement(schedule);
    // Schedule sits bottom-right on the same row as address line 2 (locality).
    expect(schedule.parentElement).toBe(locality.parentElement);
    expect(locality.compareDocumentPosition(schedule)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('9137 Lakeland Valley Court').compareDocumentPosition(selector))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(propertyAccess.compareDocumentPosition(locationLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(supportingRow).not.toContainElement(selector);
  });
});
