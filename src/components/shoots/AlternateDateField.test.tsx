// Unit tests for the shared AlternateDateField (Task 6.3).
//
// Covers the reconciliation done in this task: the component now applies the
// alternate through the central ShootsContext method (not the raw service
// helper), keeps the render-nothing-when-empty behavior, and supports the new
// `controlsOnly` mode used by surfaces that already render the alternate text.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import fc from 'fast-check';

import { AlternateDateField } from './AlternateDateField';
import type { ShootData } from '@/types/shoots';

// Central context method stub — the component must call this, not the raw
// `@/services/shoots` helper.
const applyAlternateDate = vi.fn();
vi.mock('@/context/ShootsContext', () => ({
  useShoots: () => ({ applyAlternateDate }),
}));

// useToast is pulled in for the error path; stub it with a stable spy so the
// error-path test can assert the destructive toast fired.
const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}));

afterEach(() => {
  cleanup();
  applyAlternateDate.mockReset();
  toast.mockReset();
});

const formatDate = (value?: string | null) => (value ? `D(${value})` : 'Not set');
const formatTime = (value?: string | null) => (value ? `T(${value})` : 'Not set');

const makeShoot = (overrides: Partial<ShootData>): ShootData =>
  ({
    id: '42',
    scheduledDate: '2025-03-10',
    time: '09:00',
    services: [],
    ...overrides,
  }) as unknown as ShootData;

describe('AlternateDateField', () => {
  it('renders nothing when no alternate date is stored (Req 1.4 / 7.2)', () => {
    const { container } = render(
      <AlternateDateField
        shoot={makeShoot({})}
        formatDate={formatDate}
        formatTime={formatTime}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the read-only row and "Use as main date" control when an alternate exists', () => {
    render(
      <AlternateDateField
        shoot={makeShoot({ alternate_scheduled_date: '2025-03-12', alternate_time: '14:30' } as Partial<ShootData>)}
        formatDate={formatDate}
        formatTime={formatTime}
      />,
    );

    expect(screen.getByText('Alternate:')).toBeInTheDocument();
    expect(screen.getByText(/D\(2025-03-12\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use as main date' })).toBeInTheDocument();
  });

  it('hides controls when showControls is false (Req 1.4 read-only contexts)', () => {
    render(
      <AlternateDateField
        shoot={makeShoot({ alternate_scheduled_date: '2025-03-12' } as Partial<ShootData>)}
        formatDate={formatDate}
        formatTime={formatTime}
        showControls={false}
      />,
    );

    expect(screen.getByText('Alternate:')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use as main date' })).not.toBeInTheDocument();
  });

  it('shows "Apply to all services" only for multi-service shoots (Req 7.3 / 7.4)', () => {
    const { rerender } = render(
      <AlternateDateField
        shoot={makeShoot({ alternate_scheduled_date: '2025-03-12', services: ['Photos'] } as Partial<ShootData>)}
        formatDate={formatDate}
        formatTime={formatTime}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Apply to all services' })).not.toBeInTheDocument();

    rerender(
      <AlternateDateField
        shoot={makeShoot({ alternate_scheduled_date: '2025-03-12', services: ['Photos', 'Drone'] } as Partial<ShootData>)}
        formatDate={formatDate}
        formatTime={formatTime}
      />,
    );
    expect(screen.getByRole('button', { name: 'Apply to all services' })).toBeInTheDocument();
  });

  it('controlsOnly mode omits the read-only "Alternate:" row but keeps the controls', () => {
    render(
      <AlternateDateField
        shoot={makeShoot({ alternate_scheduled_date: '2025-03-12' } as Partial<ShootData>)}
        formatDate={formatDate}
        formatTime={formatTime}
        controlsOnly
      />,
    );

    expect(screen.queryByText('Alternate:')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use as main date' })).toBeInTheDocument();
  });

  it('controlsOnly + showControls=false renders nothing', () => {
    const { container } = render(
      <AlternateDateField
        shoot={makeShoot({ alternate_scheduled_date: '2025-03-12' } as Partial<ShootData>)}
        formatDate={formatDate}
        formatTime={formatTime}
        controlsOnly
        showControls={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('default action invokes the central applyAlternateDate with scope=main and passes the result to onApplied (Req 7.5)', async () => {
    const updated = makeShoot({ id: '42', alternate_scheduled_date: '2025-03-12' } as Partial<ShootData>);
    applyAlternateDate.mockResolvedValueOnce(updated);
    const onApplied = vi.fn();

    render(
      <AlternateDateField
        shoot={makeShoot({ alternate_scheduled_date: '2025-03-12' } as Partial<ShootData>)}
        formatDate={formatDate}
        formatTime={formatTime}
        onApplied={onApplied}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use as main date' }));

    await waitFor(() => expect(applyAlternateDate).toHaveBeenCalledWith('42', 'main'));
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(updated));
  });
});

// Build a shoot with an explicit service count using the lightweight `services`
// string array that `countServices` falls back to.
const makeShootWith = (
  alternatePresent: boolean,
  serviceCount: number,
): ShootData =>
  makeShoot({
    ...(alternatePresent ? { alternate_scheduled_date: '2025-03-12' } : {}),
    services: Array.from({ length: serviceCount }, (_, i) => `Service ${i + 1}`),
  } as Partial<ShootData>);

const queryMainBtn = () => screen.queryByRole('button', { name: 'Use as main date' });
const queryAllServicesBtn = () =>
  screen.queryByRole('button', { name: 'Apply to all services' });

// Task 8.13 — Property 13: Apply control visibility (Req 7.1, 7.2, 7.3, 7.4).
//
// Feature: shoot-alternate-date-field, Property 13
//
// The visibility matrix has three dimensions:
//   - alternate present / absent
//   - service count: 0 / 1 / 2+
//   - showControls: true / false   (models the editor-vs-read-only/role gate; in
//     read-only contexts the apply controls are suppressed)
//
// Invariants:
//   "Use as main date"      visible  iff  alternate present AND showControls
//   "Apply to all services" visible  iff  alternate present AND showControls AND services > 1
describe('AlternateDateField — Property 13: apply control visibility', () => {
  // Feature: shoot-alternate-date-field, Property 13
  it('randomized matrix (alternate × service-count × showControls) upholds the visibility rules', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.integer({ min: 0, max: 4 }),
        fc.boolean(),
        (alternatePresent, serviceCount, showControls) => {
          render(
            <AlternateDateField
              shoot={makeShootWith(alternatePresent, serviceCount)}
              formatDate={formatDate}
              formatTime={formatTime}
              showControls={showControls}
            />,
          );

          const mainExpected = alternatePresent && showControls;
          const allServicesExpected =
            alternatePresent && showControls && serviceCount > 1;

          expect(Boolean(queryMainBtn())).toBe(mainExpected);
          expect(Boolean(queryAllServicesBtn())).toBe(allServicesExpected);

          // Unmount between iterations so the next render starts clean.
          cleanup();
        },
      ),
      { numRuns: 40 },
    );
  });

  // Feature: shoot-alternate-date-field, Property 13
  // Explicit enumeration of the full discrete matrix, so each combination is a
  // named, inspectable case alongside the randomized property above.
  const matrix: Array<{
    alternatePresent: boolean;
    serviceCount: number;
    showControls: boolean;
    main: boolean;
    all: boolean;
  }> = [];
  for (const alternatePresent of [false, true]) {
    for (const serviceCount of [0, 1, 2]) {
      for (const showControls of [false, true]) {
        matrix.push({
          alternatePresent,
          serviceCount,
          showControls,
          main: alternatePresent && showControls,
          all: alternatePresent && showControls && serviceCount > 1,
        });
      }
    }
  }

  it.each(matrix)(
    'alternate=$alternatePresent services=$serviceCount showControls=$showControls → main=$main all=$all',
    ({ alternatePresent, serviceCount, showControls, main, all }) => {
      render(
        <AlternateDateField
          shoot={makeShootWith(alternatePresent, serviceCount)}
          formatDate={formatDate}
          formatTime={formatTime}
          showControls={showControls}
        />,
      );

      expect(Boolean(queryMainBtn())).toBe(main);
      expect(Boolean(queryAllServicesBtn())).toBe(all);
    },
  );
});

// Task 8.16 — apply behavior (Req 7.1, 7.2, 7.3, 7.4, 7.5).
describe('AlternateDateField — apply behavior (Task 8.16)', () => {
  it('the "Apply to all services" action posts scope=all_services and refreshes via the context method (Req 7.3 / 7.5)', async () => {
    const updated = makeShoot({ id: '42', alternate_scheduled_date: '2025-03-12' } as Partial<ShootData>);
    applyAlternateDate.mockResolvedValueOnce(updated);
    const onApplied = vi.fn();

    render(
      <AlternateDateField
        shoot={makeShoot({
          alternate_scheduled_date: '2025-03-12',
          services: ['Photos', 'Drone'],
        } as Partial<ShootData>)}
        formatDate={formatDate}
        formatTime={formatTime}
        onApplied={onApplied}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Apply to all services' }));

    // State refresh happens through the central context method (the mocked
    // applyAlternateDate), and onApplied receives the returned ShootData.
    await waitFor(() => expect(applyAlternateDate).toHaveBeenCalledWith('42', 'all_services'));
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(updated));
    expect(toast).not.toHaveBeenCalled();
  });

  it('the default action posts scope=main (Req 7.5)', async () => {
    applyAlternateDate.mockResolvedValueOnce(
      makeShoot({ id: '7', alternate_scheduled_date: '2025-03-12' } as Partial<ShootData>),
    );

    render(
      <AlternateDateField
        shoot={makeShoot({ id: '7', alternate_scheduled_date: '2025-03-12' } as Partial<ShootData>)}
        formatDate={formatDate}
        formatTime={formatTime}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use as main date' }));

    await waitFor(() => expect(applyAlternateDate).toHaveBeenCalledWith('7', 'main'));
  });

  it('the error path shows a destructive toast and does not call onApplied', async () => {
    applyAlternateDate.mockRejectedValueOnce(new Error('Server said no'));
    const onApplied = vi.fn();

    render(
      <AlternateDateField
        shoot={makeShoot({ alternate_scheduled_date: '2025-03-12' } as Partial<ShootData>)}
        formatDate={formatDate}
        formatTime={formatTime}
        onApplied={onApplied}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use as main date' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', description: 'Server said no' }),
      ),
    );
    expect(onApplied).not.toHaveBeenCalled();
  });
});
