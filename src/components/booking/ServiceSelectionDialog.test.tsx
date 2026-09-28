import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceSelectionDialog, type ServiceSelectionOption } from './ServiceSelectionDialog';

const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => viewport.mobile }));

const service = {
  id: '7',
  name: 'Photography',
  description: 'Standard listing photos',
  price: 125,
  category: 'Photos',
  photographer_required: true,
};

const digitalExtra = {
  id: '8',
  name: 'Virtual Staging',
  description: 'Digital enhancement',
  price: 45,
  category: 'Photos',
  photographer_required: false,
};

describe('ServiceSelectionDialog empty-selection capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    viewport.mobile = false;
  });

  it('keeps the final service selected and explains the restriction without capability', () => {
    const onSelectedServicesChange = vi.fn();
    render(
      <ServiceSelectionDialog
        open
        onOpenChange={vi.fn()}
        services={[service]}
        selectedServices={[service]}
        onSelectedServicesChange={onSelectedServicesChange}
      />,
    );

    fireEvent.click(screen.getByText('Photography'));

    expect(onSelectedServicesChange).not.toHaveBeenCalled();
    expect(screen.getAllByText('At least one service is required for your role.').length).toBeGreaterThan(0);
  });

  it('allows an authorized admin to remove the final service and finish empty', () => {
    const onSelectedServicesChange = vi.fn();
    render(
      <ServiceSelectionDialog
        open
        onOpenChange={vi.fn()}
        services={[service]}
        selectedServices={[service]}
        onSelectedServicesChange={onSelectedServicesChange}
        allowEmptySelection
      />,
    );

    fireEvent.click(screen.getByText('Photography'));

    expect(onSelectedServicesChange).toHaveBeenCalledWith([]);
    expect(screen.queryAllByText('At least one service is required for your role.')).toHaveLength(0);
  });

  it('keeps the scheduling photographer-required flag on the selected service', () => {
    const onSelectedServicesChange = vi.fn();
    render(
      <ServiceSelectionDialog
        open
        onOpenChange={vi.fn()}
        services={[service, digitalExtra]}
        selectedServices={[service]}
        onSelectedServicesChange={onSelectedServicesChange}
      />,
    );

    fireEvent.click(screen.getByText('Virtual Staging'));

    expect(onSelectedServicesChange).toHaveBeenCalledWith([
      service,
      expect.objectContaining({
        id: '8',
        name: 'Virtual Staging',
        photographer_required: false,
      }),
    ]);
  });
});

const multipleService = { ...service, allow_multiple: true };

function QuantityPicker({
  catalog = [multipleService],
  initialSelection = [],
  effectiveSqft,
}: {
  catalog?: ServiceSelectionOption[];
  initialSelection?: ServiceSelectionOption[];
  effectiveSqft?: number;
}) {
  const [selected, setSelected] = useState(initialSelection);
  return <ServiceSelectionDialog open onOpenChange={vi.fn()} services={catalog}
    selectedServices={selected} onSelectedServicesChange={setSelected}
    effectiveSqft={effectiveSqft} allowEmptySelection />;
}

describe('ServiceSelectionDialog quantities', () => {
  beforeEach(() => { viewport.mobile = false; });

  it('hides quantity controls for services that have not enabled multiples', () => {
    render(<QuantityPicker catalog={[service]} initialSelection={[service]} />);
    expect(screen.queryByRole('group', { name: 'Quantity for Photography' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Photography' })).toBeChecked();
  });

  it('starts newly booked services at one regardless of the catalog package count', () => {
    const onSelectedServicesChange = vi.fn();
    render(<ServiceSelectionDialog open onOpenChange={vi.fn()}
      services={[{ ...multipleService, quantity: 10 }]} selectedServices={[]}
      onSelectedServicesChange={onSelectedServicesChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Increase Photography quantity' }));
    expect(onSelectedServicesChange).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ id: service.id, quantity: 1, price: 125 }),
    ]);
  });

  it('increments and decrements without toggling selection, and updates the total', () => {
    render(<QuantityPicker />);
    const plus = screen.getByRole('button', { name: 'Increase Photography quantity' });
    const minus = screen.getByRole('button', { name: 'Decrease Photography quantity' });
    expect(minus).toBeDisabled();
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(screen.getByLabelText('Photography quantity')).toHaveTextContent('2');
    expect(screen.getByText('2 selected · $250.00')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Photography' })).toBeChecked();
    fireEvent.click(minus);
    expect(screen.getByLabelText('Photography quantity')).toHaveTextContent('1');
    expect(minus).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Photography' }));
    expect(screen.getByLabelText('Photography quantity')).toHaveTextContent('0');
  });

  it('multiplies the selected square-footage tier price by quantity', () => {
    render(<QuantityPicker effectiveSqft={2000} catalog={[{
      ...multipleService,
      pricing_type: 'variable',
      sqft_ranges: [{ sqft_from: 1500, sqft_to: 2500, price: 180, duration: 60, photographer_pay: 60 }],
    }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Increase Photography quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase Photography quantity' }));
    expect(screen.getByText('2 selected · $360.00')).toBeInTheDocument();
  });

  it('preserves booked quantities and totals when multiples are later disabled', () => {
    render(<QuantityPicker catalog={[service]} initialSelection={[{ ...service, quantity: 3 }]} />);
    expect(screen.queryByRole('group', { name: 'Quantity for Photography' })).not.toBeInTheDocument();
    expect(screen.getByText('3 selected · $375.00')).toBeInTheDocument();
  });

  it('preserves a booked unit price when the catalog price has changed', () => {
    const onSelectedServicesChange = vi.fn();
    render(<ServiceSelectionDialog open onOpenChange={vi.fn()} services={[multipleService]}
      selectedServices={[{ ...multipleService, price: 100, quantity: 2 }]}
      onSelectedServicesChange={onSelectedServicesChange} />);
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.queryByText('$125.00')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Increase Photography quantity' }));
    expect(onSelectedServicesChange).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ quantity: 3, price: 100 }),
    ]);
  });

  it('supports quantity changes in the mobile drawer', () => {
    viewport.mobile = true;
    render(<QuantityPicker />);
    fireEvent.click(screen.getByRole('button', { name: 'Increase Photography quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase Photography quantity' }));
    expect(screen.getByText('2 Selected · $250.00')).toBeInTheDocument();
    expect(screen.getByLabelText('Photography quantity')).toHaveTextContent('2');
  });
});
