import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { LandorGallery } from './LandorGallery';
import { trackMediaView } from '@/lib/tourTracking';

vi.mock('@/lib/tourTracking', () => ({ trackMediaView: vi.fn() }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => vi.clearAllMocks());

const props = { address: '42 Garden Lane', shootId: 42, tourType: 'mls' as const };

describe('LandorGallery', () => {
  it('renders every provided photo and scrolls one visible page with each navigation action', async () => {
    const user = userEvent.setup();
    render(<LandorGallery {...props} photos={['/one.jpg', '/two.jpg', '/three.jpg']} />);
    const track = screen.getByLabelText('Property photos');
    expect(within(track).getAllByRole('img')).toHaveLength(3);
    expect(screen.getByText('3 photos')).toBeInTheDocument();
    const scrollBy = vi.fn();
    Object.defineProperty(track, 'clientWidth', { value: 1000 });
    Object.defineProperty(track, 'scrollBy', { value: scrollBy });
    await user.click(screen.getByRole('button', { name: 'Next property photos' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 1000, behavior: 'smooth' });
    await user.click(screen.getByRole('button', { name: 'Previous property photos' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -1000, behavior: 'smooth' });
    expect(trackMediaView).not.toHaveBeenCalled();
  });

  it('opens the selected photo, wraps with keyboard navigation, and returns focus on Escape', async () => {
    const user = userEvent.setup();
    render(<LandorGallery {...props} photos={['/one.jpg', '/two.jpg', '/three.jpg']} />);
    const opener = within(screen.getByLabelText('Property photos')).getByRole('button', { name: 'Open photo 3 of 3' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Property photos — 42 Garden Lane' });
    expect(dialog).toHaveClass('landor-lightbox');
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/three.jpg');
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/one.jpg');
    await user.keyboard('{ArrowLeft}');
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/three.jpg');
    expect(trackMediaView).toHaveBeenCalledTimes(1);
    expect(trackMediaView).toHaveBeenCalledWith(42, 'mls', 2, '/three.jpg');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('shows an empty state without invented images or controls', () => {
    render(<LandorGallery {...props} photos={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent('Property photos are coming soon.');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('handles a broken single photo with a local fallback and protected display', async () => {
    const user = userEvent.setup();
    render(<LandorGallery {...props} photos={['/broken.jpg']} />);
    expect(screen.queryByRole('button', { name: 'Next property photos' })).not.toBeInTheDocument();
    const carousel = within(screen.getByLabelText('Property photos'));
    const image = carousel.getByRole('img');
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', '/no-image-placeholder-light.svg');
    expect(fireEvent.contextMenu(image)).toBe(false);
    expect(fireEvent.dragStart(image)).toBe(false);
    await user.click(carousel.getByRole('button', { name: 'Open photo 1 of 1' }));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Next photo' })).toBeDisabled();
  });

  it('shows every photo in the masonry section and opens its original index in the shared viewer', async () => {
    const user = userEvent.setup();
    const photos = ['/one.jpg', '/portrait.jpg', '/three.jpg', '/four.jpg'];
    render(<LandorGallery {...props} photos={photos} />);
    const masonry = within(screen.getByRole('region', { name: 'All property photos' }));
    const images = masonry.getAllByRole('img');
    expect(images.map((image) => image.getAttribute('src'))).toEqual(photos);
    for (const image of images) expect(image).toHaveAttribute('loading', 'lazy');
    const opener = masonry.getByRole('button', { name: 'Open photo 3 of 4' });
    await user.click(opener);
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('img')).toHaveAttribute('src', '/three.jpg');
    expect(trackMediaView).toHaveBeenCalledWith(42, 'mls', 2, '/three.jpg');
    await user.keyboard('{ArrowLeft}');
    expect(dialog.getByRole('img')).toHaveAttribute('src', '/portrait.jpg');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('updates the single progress indicator after scrolling and resizing, then disconnects observation', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let notifyResize: (() => void) | undefined;
    vi.stubGlobal('ResizeObserver', class {
      observe = observe;
      disconnect = disconnect;
      constructor(callback: ResizeObserverCallback) { notifyResize = () => callback([], this as unknown as ResizeObserver); }
    });
    const { unmount } = render(<LandorGallery {...props} photos={['/one.jpg', '/two.jpg', '/three.jpg']} />);
    const track = screen.getByLabelText('Property photos');
    Object.defineProperties(track, {
      clientWidth: { configurable: true, value: 300 },
      scrollWidth: { configurable: true, value: 900 },
      scrollLeft: { configurable: true, writable: true, value: 0 },
    });
    const progress = screen.getByRole('progressbar', { name: 'Photo carousel progress' });
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(observe).toHaveBeenCalledWith(track);
    act(() => notifyResize?.());
    expect(progress).toHaveAttribute('aria-valuenow', '33');
    track.scrollLeft = 300;
    fireEvent.scroll(track);
    expect(progress).toHaveAttribute('aria-valuenow', '67');
    track.scrollLeft = 600;
    fireEvent.scroll(track);
    expect(progress).toHaveAttribute('aria-valuenow', '100');
    Object.defineProperty(track, 'clientWidth', { value: 900 });
    track.scrollLeft = 0;
    act(() => notifyResize?.());
    expect(progress).toHaveAttribute('aria-valuenow', '100');
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
