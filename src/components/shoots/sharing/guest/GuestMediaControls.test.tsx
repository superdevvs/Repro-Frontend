import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuestDownloadDialog } from './GuestDownloadDialog';
import { GuestMediaLightbox } from './GuestMediaLightbox';
import { GuestOverviewView } from './GuestOverviewView';
import { GuestTourCards } from './GuestTourCards';
import { GuestRequestError, type GuestFile, type GuestOverview } from './guestOverviewTypes';

const photo: GuestFile = { id: 1, name: 'Front.jpg', kind: 'photo', preview_url: '/guest/1', download_url: '/guest/1/full', mls_download_url: '/guest/1/mls', width: 4000, height: 3000, size_bytes: 2097152 };
const video: GuestFile = { id: 2, name: 'Tour.mp4', kind: 'video', preview_url: '/guest/2', download_url: '/guest/2/full' };
const overview: GuestOverview = { property: { address: '1211 Ripple Court', city: 'Pasadena', state: 'MD', zip: '21122', beds: 3, baths: 2, sqft: 1748 }, services: [], files: [photo, video], tours: [], expires_at: '2026-12-14' };
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('guest media controls', () => {
  it('lists video and 3D tours and opens a released local video in the media lightbox', () => {
    const preview = vi.fn();
    render(<GuestTourCards files={[video]} onPreview={preview} tours={[
      { label: 'Walkthrough', url: video.preview_url, kind: 'video', provider: 'repro', file_id: video.id },
      { label: 'Matterport tour', url: 'https://my.matterport.com/show/?m=example', kind: '3d', provider: 'matterport' },
    ]} />);
    expect(screen.getByText('Video tour')).toBeInTheDocument();
    expect(screen.getByText('3D tour')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'View tour' })[0]);
    expect(preview).toHaveBeenCalledWith(video);
    fireEvent.click(screen.getAllByRole('button', { name: 'View tour' })[1]);
    expect(screen.getByTitle('Matterport tour')).toHaveAttribute('src', 'https://my.matterport.com/show/?m=example');
  });

  it('selects all accessible media and drops selections immediately when refreshed access removes a file', () => {
    const props = { selected: null, onSelect: vi.fn(), request: vi.fn(), onRefreshAccess: vi.fn(async () => {}) };
    const view = render(<GuestOverviewView overview={overview} {...props} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all media' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Front.jpg' })).toBeChecked();
    view.rerender(<GuestOverviewView overview={{ ...overview, files: [video] }} {...props} />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Videos (1)' }), { button: 0, ctrlKey: false });
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    view.rerender(<GuestOverviewView overview={overview} {...props} />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Photos (1)' }), { button: 0, ctrlKey: false });
    expect(screen.getByRole('checkbox', { name: 'Select Front.jpg' })).not.toBeChecked();
  });

  it('requests the selected IDs in MLS size, polls preparation, and exposes only the ready protected ZIP', async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockResolvedValueOnce({ id: 'job-1', status: 'preparing', poll_after_ms: 1000 })
      .mockResolvedValueOnce({ id: 'job-1', status: 'ready', download_url: '/api/public/guest-shares/token/downloads/job-1/file' });
    render(<GuestDownloadDialog open onOpenChange={vi.fn()} files={[photo, video]} selectedIds={[photo.id]} request={request} onRefreshAccess={vi.fn(async () => {})} />);
    fireEvent.click(screen.getByLabelText('MLS size'));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Prepare download (1)' })));
    expect(request).toHaveBeenNthCalledWith(1, '/downloads', { size: 'small', file_ids: [1] });
    expect(screen.queryByRole('link', { name: 'Download ZIP' })).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(request).toHaveBeenNthCalledWith(2, '/downloads/job-1');
    expect(screen.getByRole('link', { name: 'Download ZIP' })).toHaveAttribute('href', '/api/public/guest-shares/token/downloads/job-1/file');
  });

  it('ignores an archive response after the allowed selection changed and refreshes denied access', async () => {
    let finish!: (value: unknown) => void;
    const request = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockRejectedValueOnce(new GuestRequestError('This invitation is unavailable.', 410));
    const refresh = vi.fn(async () => {});
    const props = { open: true, onOpenChange: vi.fn(), request, onRefreshAccess: refresh };
    const view = render(<GuestDownloadDialog {...props} files={[photo, video]} selectedIds={[1]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Prepare download (1)' }));
    view.rerender(<GuestDownloadDialog {...props} files={[video]} selectedIds={[]} />);
    await act(async () => finish({ id: 'old', status: 'ready', download_url: '/old.zip' }));
    expect(screen.queryByRole('link', { name: 'Download ZIP' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/All available media/));
    fireEvent.click(screen.getByRole('button', { name: 'Prepare download (1)' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole('alert')).toHaveTextContent('This invitation is unavailable.');
  });

  it('browses photos and videos with arrow keys and exposes zoom, details, and both allowed sizes', async () => {
    function Harness() { const [selected, setSelected] = useState<GuestFile | null>(photo); return <GuestMediaLightbox files={[photo, video]} selected={selected} onSelect={setSelected} />; }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('125%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'File details' }));
    expect(screen.getByText('4000 × 3000')).toBeInTheDocument();
    expect(screen.getByText('2 MB')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'MLS size' })).toHaveAttribute('href', photo.mls_download_url);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: video.name })).toBeInTheDocument();
    expect(document.querySelector('video')).toHaveAttribute('controls');
    expect(screen.queryByRole('button', { name: 'Zoom in' })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' });
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Full size' })).toHaveAttribute('href', photo.download_url);
  });
});
