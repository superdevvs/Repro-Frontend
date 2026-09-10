import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackLinkClick } from '@/lib/tourTracking';
import { normalizePublicTourData } from '../publicTourData';
import { LandorMedia } from './LandorMedia';
import { getLandorMedia, hasLandorMedia } from './landorMediaModel';

vi.mock('@/lib/tourTracking', () => ({ trackLinkClick: vi.fn(), trackMediaView: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const payload = {
  shoot: { id: 64, address: '64 Garden Lane' },
  photos: ['https://media.test/living.jpg'], hero_photos: ['https://media.test/front.jpg'],
  floorplans: [{ url: 'https://media.test/plan.pdf', preview_images: ['https://media.test/plan.jpg'] }],
  videos: ['https://media.test/video.mp4'],
  tour_links: { embeds: [{ id: 'walkthrough', title: 'Interactive walkthrough', branded: 'https://tour.test/branded', mls: 'https://tour.test/mls' }] },
};

describe('Landor media tabs', () => {
  it('shows only published media with real previews and never invents missing assets', () => {
    const data = normalizePublicTourData({ shoot: payload.shoot, photos: payload.photos, floorplans: [
      { url: 'https://media.test/plan.pdf' }, { url: 'https://media.test/legacy.pdf', preview_images: 4 },
    ] }, 'branded');
    const { container } = render(<LandorMedia data={data} />);
    expect(hasLandorMedia(data)).toBe(true);
    expect(getLandorMedia(data).available.map((tab) => tab.label)).toEqual(['Photos']);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Photos']);
    expect(screen.getByRole('tabpanel', { name: 'Photos' })).toBeVisible();
    for (const image of screen.getAllByRole('img')) {
      expect(image).toHaveAttribute('src', 'https://media.test/living.jpg');
    }
    expect(container.querySelector('#media')).toHaveClass('landor-media');
    expect(container.querySelector('[class*="homeify-"]')).toBeNull();
  });

  it('renders nothing for missing media, unsafe source-only embeds, or locked tours', () => {
    const { container, rerender } = render(<LandorMedia data={normalizePublicTourData({}, 'branded')} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<LandorMedia data={normalizePublicTourData({ tour_links: { embeds: [{ branded: '<iframe src="javascript:alert(1)"></iframe>' }] } }, 'branded')} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<LandorMedia data={normalizePublicTourData({ ...payload, locked: true }, 'branded')} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('uses the same availability for navigation when content is locked or cannot be displayed', () => {
    expect(hasLandorMedia(normalizePublicTourData({}, 'branded'))).toBe(false);
    expect(hasLandorMedia(normalizePublicTourData({ floorplans: [{ url: 'https://media.test/plan.pdf' }] }, 'branded'))).toBe(false);
    expect(hasLandorMedia(normalizePublicTourData({ tour_links: { embeds: [{ branded: '<script>alert(1)</script>' }] } }, 'branded'))).toBe(false);
    // Even a caller retaining old media while setting locked must not expose a dead link.
    const locked = { ...normalizePublicTourData(payload, 'branded'), locked: true };
    expect(getLandorMedia(locked).available).toEqual([]);
    expect(hasLandorMedia(locked)).toBe(false);
  });

  it('supports keyboard tab navigation with selection on Enter and exposes the selected panel', async () => {
    const user = userEvent.setup();
    render(<LandorMedia data={normalizePublicTourData(payload, 'branded')} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Photos', 'Plans', 'Video', '3D tour']);
    const photos = screen.getByRole('tab', { name: 'Photos' });
    photos.focus();
    await user.keyboard('{ArrowRight}');
    const plans = screen.getByRole('tab', { name: 'Plans' });
    await waitFor(() => expect(plans).toHaveFocus());
    expect(photos).toHaveAttribute('aria-selected', 'true');
    expect(plans).toHaveAttribute('aria-selected', 'false');
    await user.keyboard('{Enter}');
    expect(plans).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel', { name: 'Plans' });
    expect(within(panel).getByAltText('Floor plan 1')).toHaveAttribute('src', 'https://media.test/plan.jpg');
    expect(screen.queryByRole('tabpanel', { name: 'Photos' })).not.toBeInTheDocument();
    await user.keyboard('{End}');
    await waitFor(() => expect(screen.getByRole('tab', { name: '3D tour' })).toHaveFocus());
    await user.keyboard(' ');
    expect(screen.getByRole('tabpanel', { name: '3D tour' })).toBeVisible();
  });

  it('loads media only in its active panel and unmounts playing video when switching away', async () => {
    const user = userEvent.setup();
    const data = normalizePublicTourData({ ...payload, video_poster_url: 'https://media.test/poster.jpg', tour_links: { autoplay: true } }, 'branded');
    const { container } = render(<LandorMedia data={data} />);
    expect(container.querySelector('video')).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Video' }));
    const video = screen.getByTitle('Property video 1');
    expect(video).toHaveClass('landor-video-frame');
    expect(video).toHaveAttribute('src', 'https://media.test/video.mp4?autoplay=1&mute=1');
    expect(video).toHaveAttribute('poster', 'https://media.test/poster.jpg');
    expect(video).toHaveAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback');
    expect(video).toHaveAttribute('autoplay');
    await user.click(screen.getByRole('tab', { name: 'Photos' }));
    expect(container.querySelector('video')).toBeNull();
  });

  it('selects another available panel when refreshed property data removes the selected medium', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LandorMedia data={normalizePublicTourData(payload, 'branded')} />);
    await user.click(screen.getByRole('tab', { name: 'Video' }));
    rerender(<LandorMedia data={normalizePublicTourData({ shoot: payload.shoot, photos: payload.photos }, 'branded')} />);
    expect(screen.queryByRole('tab', { name: 'Video' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Photos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Photos' })).toBeVisible();
  });

  it('uses server-provided signed iGUIDE inline and open URLs unchanged', () => {
    const data = normalizePublicTourData({ iguide_viewer: { inline_url: 'https://viewer.test/inline?signature=abc', open_url: 'https://viewer.test/open?signature=xyz', source: 'published_offline_package' } }, 'mls');
    render(<LandorMedia data={data} />);
    expect(screen.getByRole('tab', { name: '3D tour' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTitle('iGUIDE 3D tour')).toHaveAttribute('src', 'https://viewer.test/inline?signature=abc');
    expect(screen.getByRole('link', { name: 'Open in new tab' })).toHaveAttribute('href', 'https://viewer.test/open?signature=xyz');
  });

  it('keeps MLS embeds unbranded, ignores supplied HTML scripts, and records external opens', () => {
    const data = normalizePublicTourData({ shoot: payload.shoot, tour_links: { embeds: [
      { id: 'branded-only', branded: 'https://brand.test/private' },
      { id: 'mls', title: 'Public walkthrough', mls: '<script>alert(1)</script><iframe src="https://tour.test/mls" onload="alert(1)"></iframe>', branded: 'https://brand.test/private' },
    ] } }, 'generic-mls');
    const { container } = render(<LandorMedia data={data} />);
    expect(screen.getByTitle('Public walkthrough')).toHaveAttribute('src', 'https://tour.test/mls');
    expect(screen.getByTitle('Public walkthrough')).not.toHaveAttribute('onload');
    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).not.toContain('https://brand.test/private');
    const link = screen.getByRole('link', { name: 'Open tour' });
    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);
    expect(trackLinkClick).toHaveBeenCalledWith(64, 'generic_mls', 'embed', 'https://tour.test/mls');
  });

  it('supports hosted and internal public video destinations while hiding restricted videos', () => {
    const data = normalizePublicTourData({ video_link: 'https://reprodashboard.com/tour/video/branded?shootId=64' }, 'branded');
    const { rerender } = render(<LandorMedia data={data} />);
    expect(screen.getByTitle('Property video 1').tagName).toBe('IFRAME');
    expect(screen.getByTitle('Property video 1')).toHaveAttribute('src', 'https://reprodashboard.com/tour/video/branded?shootId=64');
    rerender(<LandorMedia data={normalizePublicTourData({ video_link: 'https://youtu.be/abcdefghijk' }, 'branded')} />);
    expect(screen.getByTitle('Property video 1')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0');
    rerender(<LandorMedia data={normalizePublicTourData({ ...payload, video_access_restricted: true }, 'branded')} />);
    expect(screen.queryByRole('tab', { name: 'Video' })).not.toBeInTheDocument();
  });
});
