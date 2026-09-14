import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaGenerationOverlay } from './MediaGenerationOverlay';
import { REPRO_AI_ICON_PATH, ReproAiIcon } from '@/components/icons/ReproAiIcon';

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

  it.each([[0, '1'], [25, '0.9'], [50, '0.8'], [99, '0.55'], [100, '0.55']])('reveals the media gradually at %s%% progress without uncovering it before completion', (progress, veil) => {
    const { container } = render(<MediaGenerationOverlay label="Editing photos" progress={progress} />);
    const overlay = container.querySelector<HTMLElement>('.v4-media-generation');
    expect(overlay?.style.getPropertyValue('--v4-generation-veil')).toBe(veil);
  });

  it('keeps media fully hidden when progress is unavailable', () => {
    const { container } = render(<MediaGenerationOverlay label="Generating video" progress={null} />);
    expect(container.querySelector<HTMLElement>('.v4-media-generation')?.style.getPropertyValue('--v4-generation-veil')).toBe('1');
  });

  it('uses the shared Robbie artwork and has no sweeping shine layer', () => {
    const icon = render(<ReproAiIcon useSolid />);
    expect(icon.container.querySelector('path')).toHaveAttribute('d', REPRO_AI_ICON_PATH);
    const overlay = render(<MediaGenerationOverlay label="Editing photos" progress={0} />);
    expect(overlay.container.querySelector('.v4-generation-wash')).toBeNull();
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
    render(<MediaGenerationOverlay label="Photo editing job" progress={20} onRefresh={vi.fn()} compact />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
  });

  it('draws Robbie for reduced motion, resumes animation on preference changes, and pauses when hidden', () => {
    const paths: string[] = [];
    vi.stubGlobal('Path2D', class { constructor(path: string) { paths.push(path); } });
    const context = { setTransform: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), quadraticCurveTo: vi.fn(), isPointInPath: vi.fn(() => true) };
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 640, height: 400 } as DOMRect);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const motion = Object.assign(new EventTarget(), { matches: true });
    vi.stubGlobal('matchMedia', vi.fn(() => motion));
    const request = vi.fn(() => 10), cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const { container, unmount } = render(<MediaGenerationOverlay label="Editing photos" progress={30} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(canvas).toHaveAttribute('data-motion', 'reduced');
    expect(context.fill).toHaveBeenCalled();
    expect(paths).toEqual([REPRO_AI_ICON_PATH]);
    expect(context.isPointInPath).toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    motion.dispatchEvent(Object.assign(new Event('change'), { matches: false }));
    expect(canvas).toHaveAttribute('data-motion', 'animated');
    expect(request).toHaveBeenCalledOnce();
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(canvas).toHaveAttribute('data-motion', 'paused');
    expect(cancel).toHaveBeenCalledWith(10);
    unmount();
    motion.dispatchEvent(new Event('change'));
    expect(request).toHaveBeenCalledOnce();
  });
});
