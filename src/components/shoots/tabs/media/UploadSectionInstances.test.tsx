import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { EditedUploadSection } from './EditedUploadSection';
import { RawUploadSection } from './RawUploadSection';

const mocks = vi.hoisted(() => ({ toast: vi.fn(), trackUpload: vi.fn(), uploads: [] }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/context/UploadContext', () => ({ useUpload: () => ({ trackUpload: mocks.trackUpload, uploads: mocks.uploads }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '999', role: 'admin' } }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

const shoot = { id: '101', services: [], location: { address: 'Synthetic QA fixture' } } as ShootData;

describe('simultaneous upload panels for the same shoot', () => {
  it.each([
    ['edited', EditedUploadSection, 'Choose Edited Files'],
    ['raw', RawUploadSection, 'Upload Files'],
  ] as const)('keeps %s file selection in the visible panel through empty and staged views', async (_kind, Section, buttonLabel) => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}>
      <div data-testid="background-panel" hidden><Section shoot={shoot} onUploadComplete={vi.fn()} /></div>
      <div data-testid="visible-panel"><Section shoot={shoot} onUploadComplete={vi.fn()} /></div>
    </QueryClientProvider>);

    const background = screen.getByTestId('background-panel');
    const visible = screen.getByTestId('visible-panel');
    const hiddenInput = background.querySelector<HTMLInputElement>('input[type="file"]')!;
    const visibleInput = visible.querySelector<HTMLInputElement>('input[type="file"]')!;
    const hiddenBrowse = vi.spyOn(hiddenInput, 'click');
    const visibleBrowse = vi.spyOn(visibleInput, 'click');

    await user.click(within(visible).getByRole('button', { name: buttonLabel }));
    expect(visibleBrowse).toHaveBeenCalledOnce();
    expect(hiddenBrowse).not.toHaveBeenCalled();
    expect(visibleInput.id).not.toBe(hiddenInput.id);
    expect(visible.querySelector('label')?.control).toBe(visibleInput);

    await user.upload(visibleInput, new File(['first'], 'first-image.jpg', { type: 'image/jpeg' }));
    expect(within(visible).getByText('first-image.jpg')).toBeVisible();
    expect(within(background).queryByText('first-image.jpg')).not.toBeInTheDocument();

    const stagedInput = visible.querySelector<HTMLInputElement>('input[type="file"]')!;
    const stagedBrowse = vi.spyOn(stagedInput, 'click');
    const moreFiles = within(visible).getByText(/Drag and drop more .* files here or click to browse/);
    expect(moreFiles.closest('label')?.control).toBe(stagedInput);
    await user.click(moreFiles);
    // Native label activation selects this instance's input without a document lookup.
    await user.upload(stagedInput, new File(['second'], 'second-image.jpg', { type: 'image/jpeg' }));
    expect(stagedBrowse).toHaveBeenCalled();
    expect(within(visible).getByText('second-image.jpg')).toBeVisible();
    expect(within(background).queryByText('second-image.jpg')).not.toBeInTheDocument();
    expect(hiddenBrowse).not.toHaveBeenCalled();
    expect(mocks.trackUpload).not.toHaveBeenCalled();
  });
});
