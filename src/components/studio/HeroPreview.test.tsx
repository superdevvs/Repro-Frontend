// Unit tests for the Command_Center Hero_Preview and its Before_After_Control
// (ai-editing-studio-revamp, task 12.1).
//
// Covers: matched images in one comparison frame (Req 2.1), boundary follows the
// draggable control clamped to 0–100 (Req 2.2), "Before"/"After" labels (Req 2.3),
// the primary action opening the Project_Launcher (Req 2.4), an image Error_State
// that keeps the frame (Req 2.5), an aspect-ratio-reserved Skeleton_State
// (Req 2.6, 11.8), and stored-asset-only image sources (Req 2.7).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import {
  HERO_PREVIEW_ASPECT_RATIO,
  HeroPreview,
  resolveStudioAssetSrc,
} from './HeroPreview';
import { clampBoundaryPosition, DEFAULT_BEFORE_AFTER_POSITION } from './BeforeAfterControl';

afterEach(() => {
  cleanup();
});

const BEFORE = { src: '/storage/studio/hero-before.jpg', alt: 'Original living room' };
const AFTER = { src: '/storage/studio/hero-after.jpg', alt: 'AI-enhanced living room' };

function renderReady(props: Partial<React.ComponentProps<typeof HeroPreview>> = {}) {
  const view = render(<HeroPreview before={BEFORE} after={AFTER} {...props} />);
  fireEvent.load(screen.getByTestId('hero-preview-before-image'));
  fireEvent.load(screen.getByTestId('hero-preview-after-image'));
  return view;
}

describe('resolveStudioAssetSrc', () => {
  it('accepts application-controlled asset paths', () => {
    expect(resolveStudioAssetSrc('/storage/studio/hero.jpg')).toBe('/storage/studio/hero.jpg');
    expect(resolveStudioAssetSrc('assets/hero.jpg')).toBe('assets/hero.jpg');
    expect(resolveStudioAssetSrc(`${window.location.origin}/storage/hero.jpg`)).toBe(
      '/storage/hero.jpg',
    );
  });

  it('rejects remote and temporary sources', () => {
    expect(resolveStudioAssetSrc('https://cdn.example.com/tmp/hero.jpg')).toBeNull();
    expect(resolveStudioAssetSrc('//cdn.example.com/hero.jpg')).toBeNull();
    expect(resolveStudioAssetSrc('data:image/png;base64,AAA')).toBeNull();
    expect(resolveStudioAssetSrc('blob:https://x/y')).toBeNull();
    expect(resolveStudioAssetSrc('   ')).toBeNull();
    expect(resolveStudioAssetSrc(undefined)).toBeNull();
  });
});

describe('clampBoundaryPosition', () => {
  it('clamps onto the inclusive 0–100 range', () => {
    expect(clampBoundaryPosition(-40)).toBe(0);
    expect(clampBoundaryPosition(0)).toBe(0);
    expect(clampBoundaryPosition(42.5)).toBe(42.5);
    expect(clampBoundaryPosition(100)).toBe(100);
    expect(clampBoundaryPosition(180)).toBe(100);
    expect(clampBoundaryPosition(Number.POSITIVE_INFINITY)).toBe(100);
    expect(clampBoundaryPosition(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(clampBoundaryPosition(Number.NaN)).toBe(DEFAULT_BEFORE_AFTER_POSITION);
  });
});

describe('HeroPreview', () => {
  it('renders both images in one comparison frame with Before/After labels', () => {
    renderReady();

    const frame = screen.getByTestId('hero-preview-frame');
    expect(frame).toContainElement(screen.getByTestId('hero-preview-before-image'));
    expect(frame).toContainElement(screen.getByTestId('hero-preview-after-image'));
    expect(screen.getByAltText(BEFORE.alt)).toBeInTheDocument();
    expect(screen.getByAltText(AFTER.alt)).toBeInTheDocument();
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
  });

  it('renders stored application asset paths rather than remote URLs', () => {
    render(
      <HeroPreview
        before={{ src: 'https://cdn.example.com/tmp/a.jpg', alt: 'a' }}
        after={{ src: 'https://cdn.example.com/tmp/b.jpg', alt: 'b' }}
      />,
    );

    expect(screen.queryByTestId('hero-preview-before-image')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-preview-placeholder')).toBeInTheDocument();
  });

  it('moves the boundary with the Before_After_Control and clamps the position', () => {
    renderReady({ initialPosition: 900 });

    const frame = screen.getByTestId('hero-preview-frame');
    expect(frame).toHaveAttribute('data-boundary-position', '100');

    const control = screen.getByTestId('before-after-control');
    fireEvent.change(control, { target: { value: '25' } });
    expect(frame).toHaveAttribute('data-boundary-position', '25');
    expect(screen.getByTestId('hero-preview-after-clip')).toHaveStyle({
      clipPath: 'inset(0 0 0 25%)',
    });
    expect(control).toHaveAttribute('aria-valuetext', '25% original image visible');
  });

  it('opens the Project_Launcher from the primary action', async () => {
    const onOpenProjectLauncher = vi.fn();
    const user = userEvent.setup({ delay: null });
    renderReady({ onOpenProjectLauncher });

    await user.click(screen.getByRole('button', { name: /new ai project/i }));

    expect(onOpenProjectLauncher).toHaveBeenCalledTimes(1);
  });

  it('shows an aspect-ratio-reserved skeleton while images load', () => {
    render(<HeroPreview before={BEFORE} after={AFTER} />);

    const frame = screen.getByTestId('hero-preview-frame');
    expect(frame).toHaveStyle({ aspectRatio: HERO_PREVIEW_ASPECT_RATIO });
    expect(screen.getByTestId('hero-preview-skeleton')).toBeInTheDocument();

    fireEvent.load(screen.getByTestId('hero-preview-before-image'));
    fireEvent.load(screen.getByTestId('hero-preview-after-image'));
    expect(screen.queryByTestId('hero-preview-skeleton')).not.toBeInTheDocument();
  });

  it('falls back to a placeholder while no stored assets are assigned', () => {
    render(<HeroPreview />);

    expect(screen.getByTestId('hero-preview-placeholder')).toBeInTheDocument();
    expect(screen.getByTestId('hero-preview-frame')).toHaveStyle({
      aspectRatio: HERO_PREVIEW_ASPECT_RATIO,
    });
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
  });

  it('shows an image Error_State with retry without collapsing the frame', async () => {
    const user = userEvent.setup({ delay: null });
    render(<HeroPreview before={BEFORE} after={AFTER} />);

    fireEvent.load(screen.getByTestId('hero-preview-before-image'));
    fireEvent.error(screen.getByTestId('hero-preview-after-image'));

    const error = screen.getByTestId('hero-preview-error');
    expect(error).toBeInTheDocument();
    expect(screen.getByTestId('hero-preview-frame')).toHaveStyle({
      aspectRatio: HERO_PREVIEW_ASPECT_RATIO,
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(screen.queryByTestId('hero-preview-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-preview-skeleton')).toBeInTheDocument();
  });
});
