import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StagedGroupCard } from './RawUploadStagingViews';
import type { UploadServiceTarget } from './mediaUploadUtils';
import type { StagedUploadGroup } from './uploadGroups';

const target = (overrides: Partial<UploadServiceTarget> & { id: string; label: string }): UploadServiceTarget => ({
  photoCount: 10,
  intakeType: 'photo',
  supportsPhotoIntake: true,
  supportsVideoIntake: false,
  isPhotoService: true,
  usesHdrBrackets: true,
  bracketMode: 5,
  scheduledAt: null,
  order: 0,
  ...overrides,
});

const exterior = target({ id: '106', label: '10 Exterior HDR Photos' });
const drone = target({
  id: '109',
  label: '10-12 Drone Photos Package',
  usesHdrBrackets: false,
  bracketMode: null,
});

const group = (serviceId: string, files: File[] = []): StagedUploadGroup => ({
  id: `group-${serviceId}`,
  serviceId,
  files,
  classifications: {},
});

const frame = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

type CardProps = ComponentProps<typeof StagedGroupCard>;

function renderCard(overrides: Partial<CardProps> = {}) {
  const onBracketChange = vi.fn();
  const onChangeService = vi.fn();

  const props: CardProps = {
    group: group('106', [frame('IMG_001.jpg')]),
    isOpen: true,
    label: '10 Exterior HDR Photos',
    expectedCount: 50,
    bracketMode: 5,
    bracketOptions: [
      { value: 3, expected: 30 },
      { value: 5, expected: 50 },
    ],
    onBracketChange,
    isPhotoService: true,
    serviceTargets: [exterior, drone],
    requiresServiceSelection: true,
    normalizedRole: 'photographer',
    onToggleOpen: vi.fn(),
    onRemoveGroup: vi.fn(),
    onChangeService,
    onToggleClassification: vi.fn(),
    onRemoveFile: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<StagedGroupCard {...props} />),
    onBracketChange,
    onChangeService,
  };
}

describe('staged group controls', () => {
  it('puts the service selector and the bracket control in one shared row', () => {
    renderCard();

    const selector = screen.getByLabelText('Service for this upload group');
    const brackets = screen.getByRole('radiogroup', { name: /bracket size/i });

    // Same flex row, so they sit side by side rather than stacking.
    const row = selector.closest('div')?.parentElement;
    expect(row).toBe(brackets.closest('div')?.parentElement?.parentElement);
    expect(row?.className).toContain('flex');
    // Wrapping is what allows the pair to stack on a narrow panel.
    expect(row?.className).toContain('flex-wrap');
  });

  it('lets the service selector flex while the bracket control stays compact', () => {
    renderCard();

    const selectorSlot = screen.getByLabelText('Service for this upload group').parentElement;
    expect(selectorSlot?.className).toContain('flex-1');
    // A min-width is what triggers the wrap instead of a viewport breakpoint.
    expect(selectorSlot?.className).toContain('min-w-');

    const brackets = screen.getByRole('radiogroup', { name: /bracket size/i });
    expect(brackets.className).toContain('shrink-0');
    // No flex-1 on the segmented buttons: they take only the width they need.
    brackets.querySelectorAll('button').forEach((button) => {
      expect(button.className).not.toContain('flex-1');
    });
  });

  it('renders no bracket area at all for a service that does not bracket', () => {
    renderCard({
      group: group('109', [frame('DJI_0001.jpg')]),
      label: '10-12 Drone Photos Package',
      bracketMode: null,
      bracketOptions: [],
      expectedCount: 10,
    });

    expect(screen.queryByRole('radiogroup', { name: /bracket size/i })).toBeNull();
    expect(screen.queryByText(/bracket/i)).toBeNull();
    // And the selector does not stretch the full panel width in that case.
    const selectorSlot = screen.getByLabelText('Service for this upload group').parentElement;
    expect(selectorSlot?.className).toContain('max-w-');
  });

  it('shows both bracket choices with the raw count each implies', () => {
    renderCard();

    const brackets = screen.getByRole('radiogroup', { name: /bracket size/i });
    expect(brackets.textContent).toContain('3x');
    expect(brackets.textContent).toContain('30');
    expect(brackets.textContent).toContain('5x');
    expect(brackets.textContent).toContain('50');
  });

  it('reports a bracket change for this group only', async () => {
    const user = userEvent.setup();
    const { onBracketChange } = renderCard();

    await user.click(screen.getByTitle(/^3 exposures per final photo/i));

    expect(onBracketChange).toHaveBeenCalledWith(3);
  });

  it('reports a service change for this group only', async () => {
    const user = userEvent.setup();
    const { onChangeService } = renderCard();

    await user.selectOptions(screen.getByLabelText('Service for this upload group'), '109');

    expect(onChangeService).toHaveBeenCalledWith('109');
  });

  it('offers a photographer only the four per-file shortcuts', () => {
    renderCard();

    expect(screen.getByTitle('Virtual Staging')).toBeTruthy();
    expect(screen.getByTitle('Green Grass')).toBeTruthy();
    expect(screen.getByTitle('Twilight')).toBeTruthy();
    expect(screen.getByTitle('Extra')).toBeTruthy();

    expect(screen.queryByTitle('Floorplan')).toBeNull();
    expect(screen.queryByTitle('Drone')).toBeNull();
  });

  it('does not offer a photographer the unassigned escape hatch', () => {
    renderCard();

    expect(screen.queryByRole('option', { name: /general \/ unassigned/i })).toBeNull();
  });
});
