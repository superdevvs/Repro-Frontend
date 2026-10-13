import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { MediaPresentationSelectionActions } from './MediaPresentationSelectionActions';

const files: MediaFile[] = [{ id: '11', filename: 'visible.jpg', media_type: 'edited', workflowStage: 'verified', can_manage_visibility: true, can_set_hero: true },
  { id: '12', filename: 'hidden.jpg', media_type: 'edited', workflowStage: 'verified', is_hidden: true, can_manage_visibility: true, can_set_hero: false }];
afterEach(cleanup);
describe('bulk presentation controls', () => {
  it.each(['client', 'salesRep'])('%s can hide/unhide a mixed selection with explicit state and choose one visible hero', role => {
    const onToggleHidden = vi.fn(), onSetHero = vi.fn();
    const { rerender } = render(<MediaPresentationSelectionActions files={files} selectedFiles={new Set(['11', '12'])} role={role} onToggleHidden={onToggleHidden} onSetHero={onSetHero} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide selected' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unhide selected' }));
    expect(onToggleHidden.mock.calls).toEqual([[['11', '12'], true], [['11', '12'], false]]);
    expect(screen.queryByRole('button', { name: 'Set hero image' })).toBeNull();
    rerender(<MediaPresentationSelectionActions files={files} selectedFiles={new Set(['11'])} role={role} onToggleHidden={onToggleHidden} onSetHero={onSetHero} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set hero image' }));
    expect(onSetHero).toHaveBeenCalledWith('11');
  });
  it('does not offer a partial mutation for mixed authorized/read-shared or unknown selected files', () => {
    const props = { role: 'client', onToggleHidden: vi.fn(), onSetHero: vi.fn() };
    const { rerender } = render(<MediaPresentationSelectionActions {...props} files={[files[0], { ...files[1], can_manage_visibility: false }]} selectedFiles={new Set(['11', '12'])} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<MediaPresentationSelectionActions {...props} files={files} selectedFiles={new Set(['11', '99'])} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
