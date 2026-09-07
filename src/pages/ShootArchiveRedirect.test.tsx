import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter } from 'react-router-dom';
import type { resolveShootMediaArchiveRequest } from '@/utils/shootMediaDownload';
import ShootArchiveRedirect from './ShootArchiveRedirect';

const resolveArchive = vi.hoisted(() => vi.fn());
vi.mock('@/utils/shootMediaDownload', () => ({ resolveShootMediaArchiveRequest: resolveArchive }));

const requestUrl = 'https://api.example.invalid/api/shoots/42/download?type=raw&size=small';
const route = (url: string) => `/download?url=${encodeURIComponent(url)}`;
const requestOptions = (index = 0) => resolveArchive.mock.calls[index][0] as Parameters<typeof resolveShootMediaArchiveRequest>[0];

beforeEach(() => { resolveArchive.mockReset(); });
afterEach(cleanup);

describe('archive download page lifecycle', () => {
  it('keeps its spinner through preparation and transfer, then shows completion', async () => {
    let finish!: () => void;
    resolveArchive.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { container } = render(<MemoryRouter initialEntries={[route(requestUrl)]}><ShootArchiveRedirect /></MemoryRouter>);
    expect(resolveArchive).toHaveBeenCalledTimes(1);
    expect(requestOptions()).toEqual(expect.objectContaining({ requestUrl, type: 'raw', size: 'small', redirectMode: 'same-tab' }));
    expect(requestOptions().signal?.aborted).toBe(false);
    expect(container.querySelector('.animate-spin')).not.toBeNull();
    act(() => { requestOptions().onPreparing?.({ message: 'Preparing your property ZIP.', pollAfterMs: 1000 }); });
    expect(screen.getByText('Preparing your property ZIP.')).toBeInTheDocument();
    act(() => { requestOptions().onDownloading?.(); });
    expect(screen.getByText('Downloading your files.')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).not.toBeNull();
    expect(screen.queryByRole('heading', { name: 'Download Started' })).not.toBeInTheDocument();
    await act(async () => { finish(); });
    expect(screen.getByRole('heading', { name: 'Download Started' })).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  it('stops spinning and displays a download failure', async () => {
    let fail!: (reason: Error) => void;
    resolveArchive.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { fail = reject; }));
    const { container } = render(<MemoryRouter initialEntries={[route(requestUrl)]}><ShootArchiveRedirect /></MemoryRouter>);
    await act(async () => { fail(new Error('Unable to download this archive. Please try again.')); });
    expect(screen.getByRole('heading', { name: 'Download Unavailable' })).toBeInTheDocument();
    expect(screen.getByText('Unable to download this archive. Please try again.')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  it('aborts the old request and ignores its late callbacks when the download link changes', async () => {
    let finishFirst!: () => void;
    let finishSecond!: () => void;
    resolveArchive.mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }))
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishSecond = resolve; }));
    const secondUrl = 'https://api.example.invalid/api/shoots/43/download?type=edited';
    const { unmount } = render(<MemoryRouter initialEntries={[route(requestUrl)]}>
      <Link to={route(secondUrl)}>Another download</Link><ShootArchiveRedirect />
    </MemoryRouter>);
    const first = requestOptions();
    act(() => { first.onDownloading?.(); });
    expect(screen.getByText('Downloading your files.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Another download' }));
    expect(screen.getByText('Preparing your files. Your download will start automatically.')).toBeInTheDocument();
    expect(resolveArchive).toHaveBeenCalledTimes(2);
    expect(first.signal?.aborted).toBe(true);
    expect(requestOptions(1).signal?.aborted).toBe(false);
    await act(async () => {
      first.onPreparing?.({ message: 'Stale download update', pollAfterMs: 1000 });
      finishFirst();
    });
    expect(screen.queryByText('Stale download update')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Download Started' })).not.toBeInTheDocument();
    await act(async () => { finishSecond(); });
    expect(screen.getByRole('heading', { name: 'Download Started' })).toBeInTheDocument();
    unmount();
    expect(requestOptions(1).signal?.aborted).toBe(true);
  });
});
