import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { uploadMediaRequest } from '@/components/shoots/tabs/media/uploadMediaRequest';
import { EnhancedShootMediaTabs } from './EnhancedShootMediaTabs';

const session = vi.hoisted(() => ({ accessToken: 'local-session' }));
const toast = vi.hoisted(() => vi.fn());
const archiveDownload = vi.hoisted(() => vi.fn());
vi.mock('@/utils/shootMediaDownload', () => ({ downloadShootMediaArchive: archiveDownload }));
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: vi.fn(() => false) } }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({}) }));
vi.mock('@/components/auth', () => ({ useAuth: () => ({ session }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ session }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }));
vi.mock('@/components/shoots/tabs/media/prepareRawUploadBatch', () => ({ prepareRawUploadBatch: vi.fn(async () => 1) }));
vi.mock('@/components/shoots/tabs/media/uploadMediaRequest', () => ({ CLOUDFLARE_SAFE_UPLOAD_BYTES: 90 * 1024 * 1024, uploadMediaRequest: vi.fn() }));

const media = {
  data: [{ id: '8', name: 'front.jpg', path: 'shoots/42/front.jpg', size: 4096, mime_type: 'image/jpeg', modified: null,
    thumbnail_link: 'https://reprodashboard.com/api/public/shoot-media/file/shoots/42/thumbs/front.jpg?signature=test' }],
  counts: { raw_photo_count: 1, edited_photo_count: 0, extra_photo_count: 0, expected_raw_count: 1,
    expected_final_count: 1, raw_missing_count: 0, edited_missing_count: 0, bracket_mode: null },
};

describe('shoot media stays available without Dropbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.get).mockResolvedValue({ data: media });
    vi.mocked(axios.post).mockResolvedValue({ data: { success_count: 1 } });
    vi.mocked(uploadMediaRequest).mockResolvedValue({ ok: true, status: 200, responseText: '{"success_count":1}' });
  });
  afterEach(cleanup);

  it('keeps the RAW ZIP button showing a compact spinner until download completion', async () => {
    let finish!: () => void;
    archiveDownload.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<EnhancedShootMediaTabs shootId="42" address="12 Oak Street, Austin, TX 78701" canUploadRaw />);
    await screen.findByRole('img', { name: 'front.jpg' });
    const button = screen.getByRole('button', { name: 'Download RAW (ZIP)' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(archiveDownload).toHaveBeenCalledTimes(1);
    expect(archiveDownload).toHaveBeenCalledWith({ shootId: '42', type: 'raw', address: '12 Oak Street, Austin, TX 78701' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('svg.animate-spin')).not.toBeNull();
    expect(button.querySelector('image[href^="/brand/re/"]')).toBeNull();
    await act(async () => { finish(); });
    expect(button).toBeEnabled();
    expect(button.querySelector('svg.animate-spin')).toBeNull();
    expect(button.querySelector('image[href^="/brand/re/"]')).toBeNull();
  });

  it('renders the local thumbnail and reloads media after a local upload', async () => {
    const countsUpdated = vi.fn();
    const { container } = render(<EnhancedShootMediaTabs shootId="42" canUploadRaw onCountsUpdate={countsUpdated} />);
    const image = await screen.findByRole('img', { name: 'front.jpg' });
    expect(image).toHaveAttribute('src', media.data[0].thumbnail_link);
    fireEvent.load(image);
    expect(image).toBeVisible();
    expect(axios.get).toHaveBeenCalledWith('https://api.example.test/api/shoots/42/media', expect.objectContaining({
      params: { type: 'raw' }, headers: expect.objectContaining({ Authorization: 'Bearer local-session' }),
    }));
    const file = new File(['new photo'], 'kitchen.jpg', { type: 'image/jpeg' });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [file] } });
    await waitFor(() => expect(countsUpdated).toHaveBeenCalledOnce());
    expect(uploadMediaRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.test/api/shoots/42/upload', body: expect.any(FormData),
      headers: expect.objectContaining({ Authorization: 'Bearer local-session' }),
    }));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/dropbox/i)).not.toBeInTheDocument();
  });

  it('offers only unfinished RAW files for retry and preserves their original identities', async () => {
    const { container } = render(<EnhancedShootMediaTabs shootId="42" canUploadRaw />);
    await screen.findByRole('img', { name: 'front.jpg' });
    const files = [1, 2, 3].map((index) => new File(['raw'], `${index}.cr3`));
    vi.mocked(uploadMediaRequest)
      .mockResolvedValueOnce({ ok: true, status: 200, responseText: '{"success_count":1}' })
      .mockResolvedValueOnce({ ok: false, message: 'Connection lost' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files } });
    const retry = await screen.findByRole('button', { name: 'Retry remaining 2 RAW files' });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Upload needs attention' }));
    expect(uploadMediaRequest).toHaveBeenCalledTimes(2);
    const original = vi.mocked(uploadMediaRequest).mock.calls[1][0].body;
    fireEvent.click(retry);
    await waitFor(() => expect(uploadMediaRequest).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Retry remaining/ })).not.toBeInTheDocument());
    const retryBodies = vi.mocked(uploadMediaRequest).mock.calls.slice(2).map(([request]) => request.body);
    expect(retryBodies.map((body) => body.get('upload_batch_index'))).toEqual(['1', '2']);
    expect(retryBodies.map((body) => body.get('upload_batch_total'))).toEqual(['3', '3']);
    expect(retryBodies[0].get('idempotency_key')).toBe(original.get('idempotency_key'));
    expect(retryBodies[1].get('upload_batch_id')).toBe(original.get('upload_batch_id'));
  });
});
