import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GenerationPhoto } from './GenerationPhoto';
import { GENERATION_REVEAL_MS } from './useGenerationReveal';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const props = { active: true, progress: 40, label: 'Editing photos', src: '/source.jpg', alt: 'Exterior', outcome: 'generating' };

describe('real photo generation completion', () => {
  it('waits for a new result to load, reveals for 4.2 seconds, then restores controls', () => {
    vi.useFakeTimers();
    const children = (phase: unknown) => !phase && <button>Custom edit</button>;
    const { container, rerender } = render(<GenerationPhoto {...props}>{children}</GenerationPhoto>);
    rerender(<GenerationPhoto {...props} progress={100}>{children}</GenerationPhoto>);
    expect(container.querySelector('.is-revealing')).toBeNull();
    rerender(<GenerationPhoto {...props} active={false} outcome="completed" src="/result.jpg" resultKey="v1">{children}</GenerationPhoto>);
    expect(screen.getByRole('progressbar', { name: 'Loading edited photo' })).not.toHaveAttribute('aria-valuenow');
    act(() => vi.advanceTimersByTime(10000));
    expect(container.querySelector('.is-revealing')).toBeNull();
    fireEvent.load(screen.getByAltText('Exterior'));
    expect(container.querySelector('.v4-media-generation')).toHaveClass('is-revealing');
    expect(screen.queryByRole('button', { name: 'Custom edit' })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(GENERATION_REVEAL_MS - 1));
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom edit' })).toBeVisible();
    rerender(<GenerationPhoto {...props} active={false} outcome="completed" src="/result.jpg" resultKey="v1">{children}</GenerationPhoto>);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it.each(['failed', 'cancelled'])('clears immediately for a %s job, including during a reveal', outcome => {
    vi.useFakeTimers();
    const { container, rerender } = render(<GenerationPhoto {...props} />);
    rerender(<GenerationPhoto {...props} active={false} outcome="completed" src="/result.jpg" resultKey="v1" />);
    fireEvent.load(screen.getByAltText('Exterior'));
    expect(container.querySelector('.is-revealing')).toBeInTheDocument();
    rerender(<GenerationPhoto {...props} active={false} outcome={outcome} src="/result.jpg" resultKey="v1" />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('does not animate an older output or a completed project opened for review', () => {
    const { rerender } = render(<GenerationPhoto {...props} active={false} resultKey="v1" src="/v1.jpg" outcome="completed" />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    rerender(<GenerationPhoto {...props} resultKey="v1" src="/v1.jpg" />);
    rerender(<GenerationPhoto {...props} active={false} resultKey="v1" src="/v1.jpg" outcome="completed" />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('cancels the previous reveal when another generation starts', () => {
    vi.useFakeTimers();
    const { rerender } = render(<GenerationPhoto {...props} />);
    rerender(<GenerationPhoto {...props} active={false} outcome="completed" src="/v1.jpg" resultKey="v1" />);
    fireEvent.load(screen.getByAltText('Exterior'));
    act(() => vi.advanceTimersByTime(2000));
    rerender(<GenerationPhoto {...props} src="/v1.jpg" resultKey="v1" />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole('progressbar', { name: 'Editing photos' })).toBeVisible();
    rerender(<GenerationPhoto {...props} active={false} outcome="completed" src="/v2.jpg" resultKey="v2" />);
    fireEvent.load(screen.getByAltText('Exterior'));
    act(() => vi.advanceTimersByTime(GENERATION_REVEAL_MS));
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('skips the timed reveal for reduced motion', () => {
    const mediaQuery = Object.assign(new EventTarget(), { matches: true });
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));
    const { rerender } = render(<GenerationPhoto {...props} />);
    rerender(<GenerationPhoto {...props} active={false} outcome="completed" src="/result.jpg" resultKey="v1" />);
    fireEvent.load(screen.getByAltText('Exterior'));
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('reports a result preview error instead of revealing a broken image', () => {
    const { rerender } = render(<GenerationPhoto {...props} />);
    rerender(<GenerationPhoto {...props} active={false} outcome="completed" src="/result.jpg" resultKey="v1" />);
    fireEvent.error(screen.getByAltText('Exterior'));
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Preview could not load');
  });
});
