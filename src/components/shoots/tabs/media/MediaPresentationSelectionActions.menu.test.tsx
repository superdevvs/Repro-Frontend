import type { ComponentProps } from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { MediaFile } from '@/hooks/useShootFiles';
import { MediaPresentationSelectionActions } from './MediaPresentationSelectionActions';
import { hasMediaPresentationSelectionActions } from './mediaPresentationSelectionState';

type Props = ComponentProps<typeof MediaPresentationSelectionActions>;
const files: MediaFile[] = [
  { id: '11', filename: 'visible.jpg', media_type: 'edited', workflowStage: 'verified', can_manage_visibility: true, can_set_hero: true },
  { id: '12', filename: 'hidden.jpg', media_type: 'edited', workflowStage: 'verified', is_hidden: true, can_manage_visibility: true, can_set_hero: false },
];

function Menu(options: Props) {
  return <DropdownMenu><DropdownMenuTrigger asChild><button>More selected actions</button></DropdownMenuTrigger><DropdownMenuContent>
    <MediaPresentationSelectionActions {...options} variant="menu" />
  </DropdownMenuContent></DropdownMenu>;
}

afterEach(cleanup);

describe('presentation selection menu items', () => {
  it.each(['admin', 'client', 'salesRep'])('offers labeled hide/unhide menu items for an authorized %s selection', async role => {
    const user = userEvent.setup();
    const options = { files, selectedFiles: new Set(['11', '12']), role, onToggleHidden: vi.fn(), onSetHero: vi.fn() };
    expect(hasMediaPresentationSelectionActions(options)).toBe(true);
    render(<Menu {...options} />);
    await user.click(screen.getByRole('button', { name: 'More selected actions' }));
    const menu = screen.getByRole('menu');
    const hide = within(menu).getByRole('menuitem', { name: 'Hide selected' });
    expect(hide.querySelector('button')).toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: 'Set hero image' })).not.toBeInTheDocument();
    await user.click(hide);
    await user.click(screen.getByRole('button', { name: 'More selected actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Unhide selected' }));
    expect(options.onToggleHidden.mock.calls).toEqual([[['11', '12'], true], [['11', '12'], false]]);
    expect(options.onSetHero).not.toHaveBeenCalled();
  });

  it('allows a single permitted hero action and disables the current hero', async () => {
    const user = userEvent.setup();
    const options = { files: [files[0]], selectedFiles: new Set(['11']), role: 'client', onSetHero: vi.fn() };
    const { rerender } = render(<Menu {...options} />);
    await user.click(screen.getByRole('button', { name: 'More selected actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Set hero image' }));
    expect(options.onSetHero).toHaveBeenCalledExactlyOnceWith('11');
    rerender(<Menu {...options} files={[{ ...files[0], is_cover: true }]} />);
    await user.click(screen.getByRole('button', { name: 'More selected actions' }));
    const currentHero = screen.getByRole('menuitem', { name: 'Set hero image' });
    expect(currentHero).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(currentHero);
    expect(options.onSetHero).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: 'empty', files, selectedFiles: new Set<string>() },
    { name: 'unknown', files, selectedFiles: new Set(['11', '99']) },
    { name: 'partly unauthorized', files: [files[0], { ...files[1], can_manage_visibility: false }], selectedFiles: new Set(['11', '12']) },
    { name: 'denied', files: [{ ...files[0], can_manage_visibility: false, can_set_hero: false }], selectedFiles: new Set(['11']) },
  ])('returns no availability or mutation items for an $name selection', async ({ files: selectedFilesSource, selectedFiles }) => {
    const user = userEvent.setup();
    const options = { files: selectedFilesSource, selectedFiles, role: 'client', onToggleHidden: vi.fn(), onSetHero: vi.fn() };
    expect(hasMediaPresentationSelectionActions(options)).toBe(false);
    render(<Menu {...options} />);
    await user.click(screen.getByRole('button', { name: 'More selected actions' }));
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    expect(options.onToggleHidden).not.toHaveBeenCalled();
    expect(options.onSetHero).not.toHaveBeenCalled();
  });

  it('does not advertise unavailable callbacks while preserving hero-only availability', () => {
    const options = { files, selectedFiles: new Set(['11']), role: 'client' };
    expect(hasMediaPresentationSelectionActions(options)).toBe(false);
    expect(hasMediaPresentationSelectionActions({ ...options, onSetHero: vi.fn() })).toBe(true);
    expect(hasMediaPresentationSelectionActions({ ...options, files: [{ ...files[0], is_cover: true }], onSetHero: vi.fn() })).toBe(true);
  });
});
