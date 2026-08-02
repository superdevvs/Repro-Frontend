// Unit tests for IntegratedStudioNav (ai-editing-studio-revamp, task 10.3).
//
// Covers: one control per destination-registry entry so completeness holds by
// construction (Req 1.5), an accessible name on every control (Req 12.10), a
// visible + programmatic selected state for the active destination (Req 1.10),
// activation reporting the selected destination (Req 1.7), the nav being the
// single navigation mechanism with no second sidebar (Req 1.3, 1.4, 1.6), and
// shell-driven usage where the nav reads/writes the destination route state.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { IntegratedStudioNav } from './IntegratedStudioNav';
import { STUDIO_DESTINATIONS, type StudioDestinationId } from './destinations';
import { StudioShell, useStudioShell } from './StudioShell';

afterEach(() => {
  cleanup();
});

function renderNav(
  activeDestination: StudioDestinationId = 'command-center',
  onSelect = vi.fn(),
) {
  const result = render(
    <IntegratedStudioNav activeDestination={activeDestination} onSelect={onSelect} />,
  );

  return { ...result, onSelect };
}

describe('IntegratedStudioNav', () => {
  it('renders exactly one control per destination-registry entry', () => {
    renderNav();

    const controls = screen.getAllByRole('tab');
    expect(controls).toHaveLength(STUDIO_DESTINATIONS.length);

    const renderedIds = controls.map((control) => control.getAttribute('data-destination-id'));
    // Same set as the registry, each exactly once — completeness by construction.
    expect(new Set(renderedIds).size).toBe(STUDIO_DESTINATIONS.length);
    expect([...renderedIds].sort()).toEqual(
      STUDIO_DESTINATIONS.map((entry) => entry.id).sort(),
    );
  });

  it('gives every control an accessible name matching its destination label', () => {
    renderNav();

    for (const entry of STUDIO_DESTINATIONS) {
      const control = screen.getByRole('tab', { name: entry.label });
      expect(control).toHaveAttribute('data-destination-id', entry.id);
    }
  });

  it('marks exactly the active destination as selected', () => {
    for (const active of STUDIO_DESTINATIONS) {
      cleanup();
      renderNav(active.id);

      const selected = screen
        .getAllByRole('tab')
        .filter((control) => control.getAttribute('aria-selected') === 'true');

      expect(selected).toHaveLength(1);
      expect(selected[0]).toHaveAttribute('data-destination-id', active.id);
      // Visible selected state, exposed to assistive tech as the current view.
      expect(selected[0]).toHaveAttribute('data-active', 'true');
      expect(selected[0]).toHaveAttribute('aria-current', 'page');
    }
  });

  it('reports the activated destination to the parent', async () => {
    const user = userEvent.setup({ delay: null });
    const { onSelect } = renderNav('command-center');

    await user.click(screen.getByRole('tab', { name: 'Queue' }));
    expect(onSelect).toHaveBeenCalledWith('queue');

    await user.click(screen.getByRole('tab', { name: 'Reel Generator' }));
    expect(onSelect).toHaveBeenLastCalledWith('reel-generator');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('is a single navigation region and adds no sidebar', () => {
    const { container } = renderNav();

    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.getByRole('navigation')).toHaveAccessibleName('Studio destinations');
    expect(container.querySelectorAll('aside')).toHaveLength(0);
  });

  it('presents an unavailable destination as disabled with its reason', async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    render(
      <IntegratedStudioNav
        activeDestination="command-center"
        onSelect={onSelect}
        unavailableReasons={{ brand: 'Brand settings need an admin role' }}
      />,
    );

    const control = screen.getByRole('tab', { name: 'Brand' });
    expect(control).toBeDisabled();
    expect(control).toHaveAttribute('title', 'Brand settings need an admin role');

    await user.click(control);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('moves selection with arrow keys', async () => {
    const user = userEvent.setup({ delay: null });
    const { onSelect } = renderNav('command-center');

    const first = screen.getByRole('tab', { name: 'Command Center' });
    first.focus();
    await user.keyboard('{ArrowRight}');

    expect(onSelect).toHaveBeenCalledWith('projects');
  });
});

function ShellProbe() {
  const shell = useStudioShell();
  const location = useLocation();

  return (
    <div>
      <IntegratedStudioNav />
      <span data-testid="destination">{shell.destination}</span>
      <span data-testid="subtab">{shell.activeSubtab}</span>
      <span data-testid="search">{location.search}</span>
    </div>
  );
}

describe('IntegratedStudioNav inside StudioShell', () => {
  it('selects the destination in route state without any explicit wiring', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter initialEntries={['/ai-editing']}>
        <StudioShell>
          <ShellProbe />
        </StudioShell>
      </MemoryRouter>,
    );

    // Command_Center is selected by default (Req 1.1).
    expect(screen.getByRole('tab', { name: 'Command Center' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(screen.getByRole('tab', { name: 'Batch AI Jobs' }));

    expect(screen.getByTestId('destination')).toHaveTextContent('batch-ai-jobs');
    expect(screen.getByTestId('subtab')).toHaveTextContent('photo');
    expect(screen.getByTestId('search')).toHaveTextContent('d=batch-ai-jobs');
    expect(screen.getByRole('tab', { name: 'Batch AI Jobs' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
