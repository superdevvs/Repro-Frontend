import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceSelectionDialog } from './ServiceSelectionDialog';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

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
