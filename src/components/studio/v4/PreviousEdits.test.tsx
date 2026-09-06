import type { ImgHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { PreviousEdits } from './PreviousEdits';

const auth = vi.hoisted(() => ({ role: 'admin', user: { id: '1' } }));
const jobs = vi.hoisted(() => ({ photos: vi.fn(), reels: vi.fn(), listing: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/services/autoenhanceService', () => ({ autoenhanceService: { listJobs: jobs.photos } }));
vi.mock('@/services/reelService', () => ({ reelService: { listJobs: jobs.reels } }));
vi.mock('@/services/listingVideoService', () => ({ listingVideoService: { listJobs: jobs.listing } }));
vi.mock('./StudioImage', () => ({
  StudioImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

const photo = {
  id: 7, shoot_id: 42, shoot: { address: '8704 Margaret Lane' }, status: 'completed',
  created_at: '2026-09-06T10:00:00Z',
  output_file: { filename: 'Living room.jpg', url: 'https://media.example.test/photo.jpg', thumb_url: 'https://media.example.test/thumb.jpg' },
};
const video = {
  id: 8, shoot_id: 42, shoot: { address: '8704 Margaret Lane' }, status: 'completed',
  created_at: '2026-09-06T10:00:00Z', selected_files: [],
  outputs: { vertical: { label: 'Vertical reel', url: 'https://media.example.test/reel.mp4' } },
};

function renderHistory() {
  return render(<MemoryRouter><PreviousEdits /></MemoryRouter>);
}

describe('Previous edits', () => {
  beforeEach(() => {
    auth.role = 'admin';
    jobs.photos.mockReset().mockResolvedValue({ data: [photo], meta: { last_page: 1 } });
    jobs.reels.mockReset().mockResolvedValue({ data: [video], meta: { last_page: 1 } });
    jobs.listing.mockReset().mockResolvedValue({ data: [], meta: { last_page: 1 } });
  });
  afterEach(cleanup);

  it('lazily loads real legacy output and a scoped shoot entry only after opening', async () => {
    renderHistory();
    expect(jobs.photos).not.toHaveBeenCalled();
    expect(jobs.reels).not.toHaveBeenCalled();
    expect(jobs.listing).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /^Previous edits/ }));
    expect(await screen.findByRole('button', { name: 'Living room.jpg' })).toBeInTheDocument();
    expect(jobs.photos).toHaveBeenCalledWith({ page: 1, per_page: 20 });
    expect(screen.getByText('8704 Margaret Lane')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit this shoot' })).toHaveAttribute('href',
      '/ai-editing?d=command-center&rec=shoot%3A42&media=images&preset=listing-ready');
    expect(screen.getByAltText('')).toHaveAttribute('src', photo.output_file.thumb_url);
  });

  it('uses the selected existing video history service without loading other categories', async () => {
    renderHistory();
    await userEvent.click(screen.getByRole('button', { name: /^Previous edits/ }));
    await screen.findByRole('button', { name: 'Living room.jpg' });
    await userEvent.click(screen.getByRole('button', { name: 'Reels' }));
    expect(await screen.findByRole('button', { name: 'Vertical reel' })).toBeInTheDocument();
    expect(jobs.reels).toHaveBeenCalledWith({ page: 1, per_page: 20 });
    expect(jobs.listing).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Edit this shoot' })).toHaveAttribute('href',
      '/ai-editing?d=command-center&rec=shoot%3A42&media=videos&preset=walkthrough');
    await userEvent.click(screen.getByRole('button', { name: 'Listing videos' }));
    await waitFor(() => expect(jobs.listing).toHaveBeenCalledWith({ page: 1, per_page: 20 }));
    expect(await screen.findByText('No previous listing videos found.')).toBeInTheDocument();
  });

  it('does not expose or query legacy staff APIs for a client', () => {
    auth.role = 'client';
    renderHistory();
    expect(screen.queryByRole('button', { name: /Previous edits/ })).not.toBeInTheDocument();
    expect(jobs.photos).not.toHaveBeenCalled();
    expect(jobs.reels).not.toHaveBeenCalled();
    expect(jobs.listing).not.toHaveBeenCalled();
  });
});
