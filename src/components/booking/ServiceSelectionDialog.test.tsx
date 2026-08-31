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
});
