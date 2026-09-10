import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { HomeifyGallery } from './HomeifyGallery';
import { trackMediaView } from '@/lib/tourTracking';

vi.mock('@/lib/tourTracking', () => ({ trackMediaView: vi.fn() }));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const props = { address: '42 Garden Lane', shootId: 42, tourType: 'branded' as const };

describe('HomeifyGallery', () => {
  it('shows a graceful empty state without fake property images or controls', () => {
    render(<HomeifyGallery {...props} photos={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent('Property photos are coming soon.');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(trackMediaView).not.toHaveBeenCalled();
  });

  it('opens a single photo with disabled navigation and restores focus after Escape', async () => {
    const user = userEvent.setup();
    render(<HomeifyGallery {...props} photos={['/one.jpg']} />);
    expect(screen.queryByRole('button', { name: 'Next property photo' })).not.toBeInTheDocument();
    const opener = screen.getByRole('button', { name: 'See Photo' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Property photos — 42 Garden Lane' });
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/one.jpg');
    expect(within(dialog).getByRole('button', { name: 'Next photo' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Previous photo' })).toBeDisabled();
    expect(trackMediaView).toHaveBeenCalledWith(42, 'branded', 0, '/one.jpg');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('keeps hero, thumbnails, and keyboard gallery selection synchronized, including wrapping', async () => {
    const user = userEvent.setup();
    render(<HomeifyGallery {...props} photos={['/one.jpg', '/two.jpg', '/three.jpg']} />);
    await user.click(screen.getByRole('button', { name: 'Show property photo 2' }));
    expect(screen.getByRole('button', { name: 'Show property photo 2' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Open photo 2 of 3' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/two.jpg');
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/three.jpg');
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/one.jpg');
    await user.keyboard('{ArrowLeft}');
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/three.jpg');
    expect(trackMediaView).toHaveBeenCalledTimes(1);
    expect(trackMediaView).toHaveBeenCalledWith(42, 'branded', 1, '/two.jpg');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Show property photo 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Open photo 3 of 3' })).toHaveFocus();
  });

  it('uses the local placeholder for a broken image and prevents download gestures', () => {
    render(<HomeifyGallery {...props} photos={['/broken.jpg']} />);
    const image = screen.getByRole('img');
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', '/no-image-placeholder-light.svg');
    expect(fireEvent.contextMenu(image)).toBe(false);
    expect(fireEvent.dragStart(image)).toBe(false);
    expect(screen.queryByRole('link', { name: /download/i })).not.toBeInTheDocument();
  });

  it('reveals the selected thumbnail when arrow navigation moves beyond the visible strip', async () => {
    const user = userEvent.setup();
    render(<HomeifyGallery {...props} photos={Array.from({ length: 6 }, (_, i) => `/photo-${i}.jpg`)} />);
    const sixthPhoto = screen.getByRole('button', { name: 'Show property photo 6' });
    const scrollIntoView = vi.fn();
    Object.defineProperty(sixthPhoto, 'scrollIntoView', { value: scrollIntoView });
    vi.spyOn(sixthPhoto, 'getBoundingClientRect').mockReturnValue({ left: 500, right: 600 } as DOMRect);
    vi.spyOn(sixthPhoto.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 500 } as DOMRect);
    expect(scrollIntoView).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Show property photo 5' }));
    await user.click(screen.getByRole('button', { name: 'Next property photo' }));
    expect(sixthPhoto).toHaveAttribute('aria-pressed', 'true');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  });
});
