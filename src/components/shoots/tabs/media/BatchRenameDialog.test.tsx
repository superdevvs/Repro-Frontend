import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BatchRenameDialog } from './BatchRenameDialog';

afterEach(cleanup);

const files = [{ id: '90', filename: 'front.jpg', can_interact: true }];

describe('batch Rename button', () => {
  it('enables Rename after entering a pattern and submits the displayed selection', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    const close = vi.fn();
    render(<BatchRenameDialog open selectedFiles={files} onSubmit={submit} onOpenChange={close} apiEnabled />);
    expect(screen.getByRole('dialog', { name: 'Batch rename (1)' })).toBeVisible();
    const rename = screen.getByRole('button', { name: 'Rename selected' });
    expect(rename).toBeDisabled();
    await user.type(screen.getByLabelText('Value'), 'Entry-');
    expect(rename).toBeEnabled();
    expect(screen.getByText('Entry-front.jpg')).toBeVisible();
    await user.click(rename);
    expect(submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ mode: 'prefix', value: 'Entry-' }));
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  });

  it('keeps the dialog and pattern ready for retry after a rejected rename', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(undefined);
    const close = vi.fn();
    render(<BatchRenameDialog open selectedFiles={files} onSubmit={submit} onOpenChange={close} apiEnabled />);
    await user.type(screen.getByLabelText('Value'), 'Entry-');
    await user.click(screen.getByRole('button', { name: 'Rename selected' }));
    expect(await screen.findByText('Connection lost')).toBeVisible();
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Value')).toHaveValue('Entry-');
    await user.click(screen.getByRole('button', { name: 'Rename selected' }));
    expect(submit).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  });
});
