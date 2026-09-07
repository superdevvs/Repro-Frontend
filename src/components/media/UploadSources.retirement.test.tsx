import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import EnhancedFileUpload from '@/components/EnhancedFileUpload';
import { AvatarUploader } from '@/components/photographers/AvatarUploader';
import { UploadDropzone } from '@/components/shoots/tabs/media/MediaUploadPanels';

const toast = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({}), getImpersonatedUserId: () => null }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/ui/use-toast', () => ({ toast }));

describe('local upload surfaces after Dropbox retirement', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('uploads a computer file through the existing shoot endpoint without a cloud browser', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { success_count: 1 } });
    const complete = vi.fn();
    render(<EnhancedFileUpload shootId={42} onUploadComplete={complete} />);
    expect(screen.queryByText(/dropbox/i)).not.toBeInTheDocument();
    const file = new File(['photo'], 'front.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Choose files from your computer'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload 1 Files' }));
    await waitFor(() => expect(complete).toHaveBeenCalledOnce());
    const [url, body] = vi.mocked(axios.post).mock.calls[0];
    expect(url).toBe('/api/shoots/42/upload');
    expect((body as FormData).get('files[]')).toBe(file);
    expect((body as FormData).get('upload_type')).toBe('raw');
    expect((body as FormData).get('service_category')).toBe('P');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('keeps device selection on the current media dropzone', () => {
    const browse = vi.fn();
    const select = vi.fn();
    render(<UploadDropzone empty accept="image/*" inputId="raw-files" inputTestId="raw-files"
      title="Upload RAW photos" description="Select local photos" buttonLabel="Choose files" browseLabel="Browse"
      onBrowse={browse} onDrop={vi.fn()} onDragOver={vi.fn()} onFileSelect={select}
      sourceImport={{ shootId: 42, uploadType: 'raw' }} />);
    expect(screen.queryByText(/dropbox/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose files' }));
    expect(browse).toHaveBeenCalledOnce();
    const file = new File(['photo'], 'front.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('raw-files'), { target: { files: [file] } });
    expect(select).toHaveBeenCalledOnce();
    expect(select.mock.calls[0][0].target.files[0]).toBe(file);
  });

  it('preserves device and Google Drive avatar options without a Dropbox option', () => {
    render(<AvatarUploader avatarUrl="" showUploadOptions onAvatarChange={vi.fn()} onShowUploadOptions={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Upload from device' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Upload from Google Drive/ })).toBeVisible();
    expect(screen.queryByText(/dropbox/i)).not.toBeInTheDocument();
  });
});
