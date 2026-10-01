import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ImgHTMLAttributes, PropsWithChildren } from 'react';
import { ImageUpload } from './ImageUpload';

const mocks = vi.hoisted(() => ({ post: vi.fn(), toast: vi.fn() }));
vi.mock('axios', () => ({ default: { post: mocks.post, isAxiosError: () => false } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { name: 'Photo User', avatar: '/old.jpg' } }) }));
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: PropsWithChildren) => <div>{children}</div>,
  AvatarImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img alt="Current photo" {...props} />,
  AvatarFallback: ({ children }: PropsWithChildren) => <span>{children}</span>,
}));

function chooseImage() {
  fireEvent.change(screen.getByLabelText('Profile photo'), {
    target: { files: [new File(['image'], 'portrait.png', { type: 'image/png' })] },
  });
}

describe('profile image upload persistence handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('authToken', 'test-token');
    mocks.post.mockResolvedValue({ data: { url: '/new.jpg' } });
  });
  afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

  it('awaits persistence before showing the new photo or success and blocks duplicate actions', async () => {
    let complete!: () => void;
    const change = vi.fn(() => new Promise<void>((resolve) => { complete = resolve; }));
    render(<ImageUpload initialImage="/old.jpg" onChange={change} />);
    chooseImage();
    await waitFor(() => expect(change).toHaveBeenCalledWith('/new.jpg'));
    expect(screen.getByAltText('Current photo')).toHaveAttribute('src', '/old.jpg');
    expect(screen.getByRole('button', { name: 'Uploading...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove profile photo' })).toBeDisabled();
    expect(mocks.toast).not.toHaveBeenCalled();
    await act(async () => complete());
    expect(screen.getByAltText('Current photo')).toHaveAttribute('src', '/new.jpg');
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Image uploaded' }));
  });

  it('retains the previous image and reports only failure when persistence rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<ImageUpload initialImage="/old.jpg" onChange={vi.fn().mockRejectedValue(new Error('Could not save profile'))} />);
    chooseImage();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Upload failed', description: 'Could not save profile' })));
    expect(screen.getByAltText('Current photo')).toHaveAttribute('src', '/old.jpg');
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Change Photo' })).toBeEnabled();
  });

  it('waits for removal to persist and does not fall back to the old authenticated avatar', async () => {
    let complete!: () => void;
    const change = vi.fn(() => new Promise<void>((resolve) => { complete = resolve; }));
    render(<ImageUpload initialImage="/old.jpg" onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove profile photo' }));
    expect(change).toHaveBeenCalledWith('');
    expect(screen.getByAltText('Current photo')).toHaveAttribute('src', '/old.jpg');
    await act(async () => complete());
    expect(screen.getByAltText('Current photo')).not.toHaveAttribute('src');
    expect(screen.queryByRole('button', { name: 'Remove profile photo' })).not.toBeInTheDocument();
  });

  it('keeps the image when removal fails', async () => {
    render(<ImageUpload initialImage="/old.jpg" onChange={vi.fn().mockRejectedValue(new Error('Removal denied'))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove profile photo' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Removal failed' })));
    expect(screen.getByAltText('Current photo')).toHaveAttribute('src', '/old.jpg');
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it('keeps synchronous staged-form callbacks compatible without claiming the profile was saved', async () => {
    const change = vi.fn();
    render(<ImageUpload onChange={change} />);
    chooseImage();
    await waitFor(() => expect(change).toHaveBeenCalledWith('/new.jpg'));
    expect(mocks.toast).toHaveBeenCalledWith({ title: 'Image uploaded', description: 'Your image is ready.' });
    expect(screen.getByRole('button', { name: 'Change Photo' })).toHaveAttribute('type', 'button');
  });
});
