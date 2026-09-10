import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { normalizePublicTourData } from '../publicTourData';
import { HomeifyMedia } from './HomeifyMedia';
import { homeifyEmbedUrl } from './homeifyMediaUtils';

afterEach(cleanup);

describe('Homeify media sources', () => {
  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '<script>alert(1)</script>', '<iframe srcdoc="<script>alert(1)</script>"></iframe>', '<iframe src="javascript:alert(1)"></iframe>'])(
    'rejects executable or source-free markup: %s', (value) => { expect(homeifyEmbedUrl(value)).toBe(''); },
  );

  it('extracts only the media source and does not copy inline HTML, scripts, or event handlers', () => {
    const data = normalizePublicTourData({ tour_links: { embeds: [{ title: 'Safe walkthrough', branded: '<script>window.pwned=true</script><iframe src="https://tour.test/safe" onload="alert(1)" srcdoc="malicious"></iframe>' }] } }, 'branded');
    const { container } = render(<HomeifyMedia data={data} />);
    const frame = screen.getByTitle('Safe walkthrough');
    expect(frame).toHaveAttribute('src', 'https://tour.test/safe');
    expect(frame).not.toHaveAttribute('onload');
    expect(frame).not.toHaveAttribute('srcdoc');
    expect(frame).toHaveAttribute('sandbox');
    expect(container.querySelector('script')).toBeNull();
  });

  it('supports source elements in native video embeds and retains download restrictions', () => {
    const data = normalizePublicTourData({ tour_links: { embeds: [{ title: 'Walkthrough video', branded: '<video><source src="https://media.test/tour.mp4" type="video/mp4"></video>' }] } }, 'branded');
    render(<HomeifyMedia data={data} />);
    const video = screen.getByTitle('Walkthrough video');
    expect(video.tagName).toBe('VIDEO');
    expect(video).toHaveAttribute('src', 'https://media.test/tour.mp4');
    expect(video).toHaveAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback');
  });

  it('converts hosted videos without losing private Vimeo access hashes', () => {
    expect(homeifyEmbedUrl('https://youtu.be/abcdefghijk', true)).toBe('https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0&autoplay=1&mute=1');
    expect(homeifyEmbedUrl('https://vimeo.com/123456789/abc123')).toBe('https://player.vimeo.com/video/123456789?h=abc123');
    expect(homeifyEmbedUrl('https://vimeo.com/123456789?h=private456', true)).toBe('https://player.vimeo.com/video/123456789?h=private456&autoplay=1&muted=1');
  });

  it('renders a public internal video wrapper as an iframe and honors restricted video visibility', () => {
    const payload = { video_link: 'https://reprodashboard.com/tour/video/branded?shootId=42' };
    const { container, rerender } = render(<HomeifyMedia data={normalizePublicTourData(payload, 'branded')} />);
    expect(screen.getByTitle('Property video 1')).toHaveAttribute('src', payload.video_link);
    expect(screen.getByTitle('Property video 1').tagName).toBe('IFRAME');
    rerender(<HomeifyMedia data={normalizePublicTourData({ ...payload, video_access_restricted: true }, 'branded')} />);
    expect(container.querySelector('#video')).toBeNull();
  });

  it('anchors the first playable embed even when an earlier source is invalid', () => {
    const data = normalizePublicTourData({ tour_links: { embeds: [{ title: 'Invalid', branded: '<script>noop()</script>' }, { title: 'Valid walkthrough', branded: 'https://tour.test/valid' }] } }, 'branded');
    const { container } = render(<HomeifyMedia data={data} />);
    expect(container.querySelector('#tour')).toContainElement(screen.getByTitle('Valid walkthrough'));
    expect(screen.queryByRole('heading', { name: 'Invalid' })).not.toBeInTheDocument();
  });
});
