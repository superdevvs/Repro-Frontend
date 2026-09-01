import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { Public3dTourViewer } from './Public3dTourViewer';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Public3dTourViewer', () => {
  it('embeds iGUIDE in-page and exposes its separate open URL', () => {
    render(
      <Public3dTourViewer
        iguideInlineUrl="https://viewer.example.test/embed"
        iguideOpenUrl="https://viewer.example.test/full"
      />,
    );

    const frame = screen.getByTitle('iGUIDE 3D tour');
    expect(frame).toHaveAttribute('src', 'https://viewer.example.test/embed');
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
    fireEvent.load(frame);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open in new tab/i })).toHaveAttribute(
      'href',
      'https://viewer.example.test/full',
    );
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('uses one iGUIDE-first surface and switches providers with compact tabs', async () => {
    const user = userEvent.setup();
    render(
      <Public3dTourViewer
        iguideInlineUrl="https://iguide.example.test/tour"
        matterportUrl="https://matterport.example.test/show"
      />,
    );

    expect(screen.getByRole('tab', { name: 'iGUIDE' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTitle('iGUIDE 3D tour')).toHaveAttribute(
      'src',
      'https://iguide.example.test/tour',
    );

    await user.click(screen.getByRole('tab', { name: 'Matterport' }));

    expect(screen.getByRole('tab', { name: 'Matterport' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTitle('Matterport 3D tour')).toHaveAttribute(
      'src',
      'https://matterport.example.test/show',
    );
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('shows a loading state, then a retryable in-page fallback', () => {
    vi.useFakeTimers();
    render(<Public3dTourViewer iguideInlineUrl="https://viewer.example.test/embed" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading iGUIDE');
    act(() => vi.advanceTimersByTime(15_000));
    expect(screen.getByText('Tour viewer unavailable')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry viewer/i }));
    expect(screen.getByRole('status')).toHaveTextContent('Loading iGUIDE');
  });

  it('rejects unsafe URLs and renders a safe unavailable state when requested', () => {
    const { container } = render(
      <Public3dTourViewer iguideInlineUrl="javascript:alert(1)" showUnavailable />,
    );

    expect(screen.getByText('3D tour unavailable')).toBeInTheDocument();
    expect(container.querySelector('iframe')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open in new tab/i })).not.toBeInTheDocument();
  });

  it('keeps the shared media surface mobile-safe', () => {
    const { container } = render(
      <Public3dTourViewer matterportUrl="https://matterport.example.test/show" />,
    );

    const surface = container.querySelector('section > div.relative');
    expect(surface).toHaveClass('min-h-[300px]', 'sm:aspect-video', 'sm:min-h-[360px]');
  });
});
