import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { OverviewAiStudioSection } from './OverviewAiStudioSection';

const permission = vi.hoisted(() => ({ can: vi.fn(), isLoading: false }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => permission }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderSection(props: Partial<React.ComponentProps<typeof OverviewAiStudioSection>> = {}) {
  return render(
    <MemoryRouter initialEntries={['/shoots/42']}>
      <OverviewAiStudioSection
        shootId="42"
        isClient={false}
        isClientReleaseLocked={false}
        isEditMode={false}
        {...props}
      />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('Overview AI Studio entry', () => {
  beforeEach(() => {
    permission.can.mockReset().mockReturnValue(true);
    permission.isLoading = false;
  });
  afterEach(cleanup);

  it.each([
    ['Image presets', 'images', 'listing-ready'],
    ['Video presets', 'videos', 'walkthrough'],
  ])('opens %s with this shoot and the correct default', async (name, media, preset) => {
    renderSection();
    await userEvent.click(screen.getByRole('link', { name }));
    const url = new URL(screen.getByTestId('location').textContent!, 'https://dashboard.test');
    expect(url.pathname).toBe('/ai-editing');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      d: 'command-center', rec: 'shoot:42', media, preset,
    });
    expect(permission.can).toHaveBeenCalledWith('ai-editing', 'view');
  });

  it('offers no Studio links when access is denied', () => {
    permission.can.mockReturnValue(false);
    renderSection();
    expect(screen.queryByRole('region', { name: 'AI Studio' })).not.toBeInTheDocument();
  });

  it('waits for permissions before exposing entry links', () => {
    permission.isLoading = true;
    renderSection();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('does not let a release-locked client enter through Overview', () => {
    renderSection({ isClient: true, isClientReleaseLocked: true });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('allows a released client with an explicit Studio permission', () => {
    renderSection({ isClient: true });
    expect(screen.getByRole('link', { name: 'Image presets' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Video presets' })).toBeInTheDocument();
  });

  it('does not expose navigation while Overview has unsaved edits', () => {
    renderSection({ isEditMode: true });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('does not link an invalid shoot record', () => {
    renderSection({ shootId: 'unknown' });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
