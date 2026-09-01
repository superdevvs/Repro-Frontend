import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CompReshootBookingController } from './useCompReshootBooking';
import { CompReshootCompensationSection } from './CompReshootCompensationSection';

afterEach(cleanup);

describe('CompReshootCompensationSection', () => {
  it('shows the complete review breakdown and recipient safeguards', () => {
    const service = { id: '17', name: 'Photography', description: '', price: 250 };
    const controller = {
      enabled: true,
      template: { rep: null },
      suggestedPolicy: null,
      photographerMode: 'standard',
      setPhotographerMode: vi.fn(),
      serviceCompensations: {},
      setServiceCompensationMode: vi.fn(),
      setServiceCustomAmount: vi.fn(),
      getStandardPay: () => 75,
      getServiceCompensation: () => ({ mode: 'standard', amount: 75 }),
      photographerCompensationTotal: 75,
      photographerAssignmentsAreComplete: false,
      unassignedCompensatedServices: [service],
      repMode: 'none',
      setRepMode: vi.fn(),
      repCustomAmount: '',
      setRepCustomAmount: vi.fn(),
      repStandardCompensation: 0,
      repCompensationTotal: 0,
      editorCompensationEstimate: null,
      staffCompensationTotal: 75,
    } as unknown as CompReshootBookingController;

    const { container } = render(<CompReshootCompensationSection
      controller={controller}
      selectedServices={[service]}
      nominalServiceTotal={250}
      photographerId=""
      servicePhotographers={{}}
      photographers={[]}
    />);

    expect(screen.getByText('Nominal service value')).toBeInTheDocument();
    expect(screen.getByText('Client pays')).toBeInTheDocument();
    expect(screen.getByText('Photographer compensation')).toBeInTheDocument();
    expect(screen.getByText('Rep compensation')).toBeInTheDocument();
    expect(screen.getByText('Expected editor cost')).toBeInTheDocument();
    expect(screen.getByText('Normal · calculated when assigned')).toBeInTheDocument();
    expect(screen.getByText('Estimated company comp cost')).toBeInTheDocument();
    expect(screen.getByText('$75.00 + editor')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Assign a photographer on Schedule for: Photography');
    expect(container.querySelector('#sales-rep-compensation-standard')).toBeDisabled();
    expect(container.querySelector('#sales-rep-compensation-custom')).toBeDisabled();
    expect(container.querySelector('#sales-rep-compensation-none')).not.toBeDisabled();
    expect(screen.getAllByText('Staff compensation')).toHaveLength(1);
    expect(screen.queryByText('Company cash cost')).not.toBeInTheDocument();
  });
});
