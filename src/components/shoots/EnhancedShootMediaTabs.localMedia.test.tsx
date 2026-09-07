import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { EnhancedShootMediaTabs } from './EnhancedShootMediaTabs';

const session = vi.hoisted(() => ({ accessToken: 'local-session' }));
const toast = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: vi.fn(() => false) } }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({}) }));
vi.mock('@/components/auth', () => ({ useAuth: () => ({ session }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ session }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }));

const media = {
  data: [{ id: '8', name: 'front.jpg', path: 'shoots/42/front.jpg', size: 4096, mime_type: 'image/jpeg', modified: null,
    thumbnail_link: 'https://api.example.test/storage/shoots/42/thumbs/front.jpg' }],
  counts: { raw_photo_count: 1, edited_photo_count: 0, extra_photo_count: 0, expected_raw_count: 1,
    expected_final_count: 1, raw_missing_count: 0, edited_missing_count: 0, bracket_mode: null },
};

describe('shoot media stays available without Dropbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.get).mockResolvedValue({ data: media });
    vi.mocked(axios.post).mockResolvedValue({ data: { success_count: 1 } });
  });
  afterEach(cleanup);

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
    expect(axios.post).toHaveBeenCalledWith('https://api.example.test/api/shoots/42/upload', expect.any(FormData), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer local-session' }),
    }));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/dropbox/i)).not.toBeInTheDocument();
  });
});
