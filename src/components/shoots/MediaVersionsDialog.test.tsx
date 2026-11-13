import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { MediaVersionsDialogHost } from './MediaVersionsDialog';
import { openMediaVersions } from '@/services/mediaVersions';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), refresh: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: api }));
vi.mock('@/realtime/realtimeRefreshBus', () => ({ triggerShootDetailRefresh: api.refresh }));
vi.mock('@/components/studio/v4/StudioImage', () => ({ StudioImage: () => null }));
beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue({ data: { data: [], current_version: 3 } }); api.post.mockResolvedValue({ data: {} }); });
it('keeps version identity and request id after response loss and never treats 100% as published', async () => {
  render(<MemoryRouter><MediaVersionsDialogHost /></MemoryRouter>);
  act(() => openMediaVersions({ shootId: 8, fileId: 12, name: 'Kitchen.jpg' }));
  await screen.findByText(/Current version 3/);
  fireEvent.change(screen.getByLabelText('Upload a saved edit'), { target: { files: [new File(['image'], 'Kitchen.jpg', { type: 'image/jpeg' })] } });
  api.post.mockRejectedValueOnce(new Error('Response lost'));
  fireEvent.click(screen.getByRole('button', { name: 'Upload saved edit' }));
  await screen.findByRole('alert'); const body = api.post.mock.calls[0][1] as FormData;
  api.get.mockResolvedValue({ data: { data: [], current_version: 4 } });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh versions' }));
  await screen.findByText(/Current version 4/);
  fireEvent.click(screen.getByRole('button', { name: 'Upload saved edit' }));
  await screen.findByText(/Upload saved. The current image stays available/);
  expect(api.post.mock.calls[1][1].get('request_id')).toBe(body.get('request_id'));
  expect(api.post.mock.calls[1][1].get('expected_version')).toBe('3');
  expect(api.post.mock.calls[1][2].headers['Content-Type']).toBe('multipart/form-data');
});
it('restoration retries preserve the reviewed version and display explicit conflict choices', async () => {
  const versions = [{ id: 'old', status: 'archived', version: 1, created_at: '2026-10-03' }, { id: 'competing', status: 'conflict', created_at: '2026-10-03' }];
  api.get.mockResolvedValue({ data: { data: versions, current_version: 3 } });
  render(<MemoryRouter initialEntries={['/dashboard?editingShootId=8&editingFileId=12']}><MediaVersionsDialogHost /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Replace latest (v3)' });
  expect(screen.getByRole('button', { name: 'Save as copy' })).toBeVisible();
  api.post.mockRejectedValueOnce(new Error('Response lost'));
  fireEvent.click(screen.getByRole('button', { name: 'Restore as new version' })); await screen.findByRole('alert');
  const body = api.post.mock.calls[0][1];
  fireEvent.click(screen.getByRole('button', { name: 'Restore as new version' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2)); expect(api.post.mock.calls[1][1]).toEqual(body);
});
it('labels receipt-bound returned edits Review and keeps staff resolution bound to the current version', async () => {
  api.get.mockResolvedValue({ data: { data: [{ id: 'review-v2', status: 'conflict', error_code: 'delivery_review_required', error: 'Delivery review required', version: 2, created_at: '2026-11-05' }], current_version: 1 } });
  render(<MemoryRouter><MediaVersionsDialogHost /></MemoryRouter>);
  act(() => openMediaVersions({ shootId: 8, fileId: 12, name: 'Kitchen.jpg' }));
  await screen.findByText('Review');
  expect(screen.queryByText('conflict')).not.toBeInTheDocument();
  expect(screen.getByText(/current delivered image stays available/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save as copy' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Replace latest (v1)' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/shoots/8/media-versions/review-v2/resolve', { choice: 'replace_latest', expected_latest_version: 1 }));
});

it('plays a signed video preview and approves only the reviewed current version', async () => {
  const stream = 'https://dashboard.test/api/media-version-stream/review-v2?expires=2000000000&signature=fixture';
  api.get.mockResolvedValue({ data: { mime_type: 'video/mp4', current_version: 1, data: [{
    id: 'review-v2', filename: 'Listing.mp4', mime_type: 'video/mp4', stream_url: stream,
    preview_url: '/api/image-preview-not-for-video', status: 'conflict', error_code: 'delivery_review_required', created_at: '2026-11-13',
  }] } });
  render(<MemoryRouter><MediaVersionsDialogHost /></MemoryRouter>);
  act(() => openMediaVersions({ shootId: 8, fileId: 12, name: 'Listing.mp4', mediaType: 'video' }));
  const preview = await screen.findByLabelText('Preview Listing.mp4');
  expect(preview.tagName).toBe('VIDEO');
  expect(preview).toHaveAttribute('src', stream);
  expect(preview).toHaveAttribute('controls');
  expect(preview).toHaveAttribute('preload', 'metadata');
  expect(screen.getByText(/This returned edit needs staff delivery review\. The current delivered video stays available/)).toBeVisible();
  expect(screen.queryByText(/Photoshop/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Replace latest (v1)' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/shoots/8/media-versions/review-v2/resolve', { choice: 'replace_latest', expected_latest_version: 1 }));
});

it('refreshes failed publication into a retryable saved upload without reporting success or uploading again', async () => {
  const version = { id: 'review-v2', filename: 'Listing.mp4', status: 'conflict', error_code: 'delivery_review_required', created_at: '2026-11-13' };
  const response = (status: string, error_code?: string) => ({ data: { mime_type: 'video/mp4', current_version: 1, data: [{ ...version, status, error_code }] } });
  api.get.mockResolvedValueOnce(response('conflict', 'delivery_review_required'))
    .mockResolvedValueOnce(response('failed', 'processing_failed'))
    .mockResolvedValueOnce(response('queued'));
  let finishRetry!: () => void;
  api.post.mockRejectedValueOnce(new Error('Publication failed; your previous video is unchanged.'))
    .mockImplementationOnce(() => new Promise(resolve => { finishRetry = () => resolve({ data: {} }); }));
  render(<MemoryRouter><MediaVersionsDialogHost /></MemoryRouter>);
  act(() => openMediaVersions({ shootId: 8, fileId: 12, name: 'Listing.mp4', mediaType: 'video' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Replace latest (v1)' }));
  const retry = await screen.findByRole('button', { name: 'Retry saved upload' });
  await waitFor(() => expect(retry).toBeEnabled());
  expect(screen.getByRole('alert')).toHaveTextContent('Publication failed; your previous video is unchanged.');
  expect(screen.queryByRole('button', { name: 'Replace latest (v1)' })).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(api.refresh).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/shoots/8/media-versions/review-v2/resolve', { choice: 'replace_latest', expected_latest_version: 1 });
  fireEvent.click(retry);
  fireEvent.click(retry);
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenLastCalledWith('/shoots/8/media-versions/review-v2/retry', {});
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await act(async () => { finishRetry(); });
  await screen.findByText('queued');
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.refresh).not.toHaveBeenCalled();
});

it('preserves the failed action error when recovery refresh fails and clears an earlier success message', async () => {
  const version = { id: 'review-v2', filename: 'Listing.mp4', status: 'conflict', error_code: 'delivery_review_required', created_at: '2026-11-13' };
  api.get.mockResolvedValue({ data: { mime_type: 'video/mp4', current_version: 1, data: [version] } });
  render(<MemoryRouter><MediaVersionsDialogHost /></MemoryRouter>);
  act(() => openMediaVersions({ shootId: 8, fileId: 12, name: 'Listing.mp4', mediaType: 'video' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save as copy' }));
  await screen.findByText('Saved.');
  const replace = screen.getByRole('button', { name: 'Replace latest (v1)' });
  await waitFor(() => expect(replace).toBeEnabled());
  api.post.mockRejectedValueOnce(new Error('The replacement could not be published.'));
  api.get.mockRejectedValueOnce(new Error('The recovery refresh failed.'));
  fireEvent.click(replace);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(replace).toBeEnabled());
  expect(screen.getByRole('alert')).toHaveTextContent('The replacement could not be published.');
  expect(screen.queryByText('The recovery refresh failed.')).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(api.refresh).not.toHaveBeenCalled();
});

it('uses the server media type for a video with no versions and directs uploads to the existing Edited files flow', async () => {
  api.get.mockResolvedValue({ data: { mime_type: 'video/mp4', current_version: 3, data: [] } });
  render(<MemoryRouter initialEntries={['/dashboard?editingShootId=8&editingFileId=12']}><MediaVersionsDialogHost /></MemoryRouter>);
  expect(await screen.findByText(/Upload a replacement through Edited files/)).toBeVisible();
  expect(screen.queryByLabelText('Upload a saved edit')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Upload/ })).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

it.each([
  { mime_type: 'application/mp4', media_type: undefined, requestType: undefined },
  { mime_type: 'application/octet-stream', media_type: 'video', requestType: undefined },
  { mime_type: 'application/octet-stream', media_type: undefined, requestType: 'video' as const },
])('keeps legacy video metadata in the video review flow: %j', async ({ mime_type, media_type, requestType }) => {
  api.get.mockResolvedValue({ data: { mime_type, media_type, current_version: 3, data: [] } });
  render(<MemoryRouter><MediaVersionsDialogHost /></MemoryRouter>);
  act(() => openMediaVersions({ shootId: 8, fileId: 12, name: 'Listing.mp4', mediaType: requestType }));
  expect(await screen.findByText(/Upload a replacement through Edited files/)).toBeVisible();
  await screen.findByText(/Current version 3/);
  expect(screen.queryByLabelText('Upload a saved edit')).not.toBeInTheDocument();
});
