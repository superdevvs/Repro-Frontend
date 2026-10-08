import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaGenerationOverlay } from './MediaGenerationOverlay';
import { REPRO_AI_ICON_PATH } from '@/components/icons/ReproAiIcon';

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('on-media generation progress', () => {
  it.each([[0, '0'], [37.4, '37'], [-20, '0'], [130, '100']])('displays the reported progress %s within valid bounds', (progress, expected) => {
    render(<MediaGenerationOverlay label="Editing photos" progress={progress} />);
    expect(screen.getByRole('progressbar', { name: 'Editing photos' })).toHaveAttribute('aria-valuenow', expected);
    expect(screen.getByText(`${expected}%`)).toBeVisible();
  });

  it.each([null, NaN, Infinity])('leaves missing or invalid progress indeterminate (%s)', progress => {
    render(<MediaGenerationOverlay label="Generating video" progress={progress} />);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Progress unavailable');
    expect(screen.getByText('Working…')).toBeVisible();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('uses the shared Robbie artwork without logo satellites or a circle', () => {
    const { container } = render(<MediaGenerationOverlay label="Editing photos" progress={0} />);
    expect(container.querySelector('.v4-generation-mark path')).toHaveAttribute('d', REPRO_AI_ICON_PATH);
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('.robbie-sparks')).toBeNull();
  });

  it('never starts the reveal from progress alone, including 100 percent', () => {
    const { container, rerender } = render(<MediaGenerationOverlay label="Editing photos" progress={99} />);
    rerender(<MediaGenerationOverlay label="Editing photos" progress={100} />);
    expect(container.querySelector('.v4-media-generation')).not.toHaveClass('is-revealing');
  });

  it('updates from server progress and provides a manual refresh action', () => {
    const refresh = vi.fn();
    const { rerender } = render(<MediaGenerationOverlay label="Editing photos" progress={0} onRefresh={refresh} />);
    rerender(<MediaGenerationOverlay label="Editing photos" progress={64} onRefresh={refresh} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '64');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh progress' }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('keeps compact overlays non-interactive inside gallery cards', () => {
    const { container } = render(<MediaGenerationOverlay label="Photo editing job" progress={20} onRefresh={vi.fn()} compact />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
    expect(container.querySelectorAll('.v4-generation-star')).toHaveLength(9);
    expect(container.querySelector('.v4-generation-edge')).toBeNull();
    expect(container.querySelector('.v4-generation-robbie')).toBeNull();
    expect(container.querySelector('.v4-generation-mote')).toBeNull();
    expect(container.querySelector('.v4-generation-trail')).toBeNull();
  });

  it('pauses its decorative animations when the browser is hidden', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const { container, unmount } = render(<MediaGenerationOverlay label="Editing photos" progress={30} />);
    const overlay = container.querySelector('.v4-media-generation');
    expect(overlay).toHaveAttribute('data-paused', 'false');
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(overlay).toHaveAttribute('data-paused', 'true');
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(overlay).toHaveAttribute('data-paused', 'false');
    unmount();
  });
});
