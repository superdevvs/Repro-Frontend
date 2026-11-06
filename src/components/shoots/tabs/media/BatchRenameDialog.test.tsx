import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BatchRenameDialog } from './BatchRenameDialog';

const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup();
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

const files = [{ id: '90', filename: 'front.jpg', can_interact: true }];
const numberedFiles = Array.from({ length: 30 }, (_, index) => ({
  id: String(index + 1), filename: `${String(index + 1).padStart(3, '0')}_2703 Maurleen Drive room ${index + 1}.jpg`, can_interact: true,
}));

async function chooseOption(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: label }), { key: 'ArrowDown' });
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('batch Rename button', () => {
  it('renames the valid twenty-nine files and explains the invalid thirtieth filename outside the five-row preview', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    const validFiles = Array.from({ length: 29 }, (_, index) => ({
      id: String(243017 + index), filename: `${String(index + 1).padStart(3, '0')}_SNAP${5147 + index}.jpg`, can_interact: true,
    }));
    const selection = [...validFiles, { id: '243046', filename: '.jpg', can_interact: true }];
    const close = vi.fn();
    render(<BatchRenameDialog open selectedFiles={selection} onSubmit={submit} onOpenChange={close} apiEnabled />);
    await chooseOption(user, 'Mode', 'Edit numbering');
    await chooseOption(user, 'Numbering action', 'Remove existing numbers');
    expect(screen.getByText('Preview (first 5)')).toBeVisible();
    for (let index = 0; index < 5; index++) expect(screen.getByText(`SNAP${5147 + index}.jpg`)).toBeVisible();
    const rename = screen.getByRole('button', { name: /^Rename(?: selected| 29 files)$/ });
    expect(rename).toBeEnabled();
    expect(rename).toHaveTextContent('Rename 29 files');
    const skippedNotice = screen.getByRole('status');
    expect(skippedNotice).toHaveTextContent('1 file will be skipped');
    expect(within(skippedNotice).getByText('.jpg', { exact: true })).toBeVisible();
    await user.click(rename);
    expect(submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      mode: 'numbering', number_action: 'remove', fileIds: validFiles.map(file => file.id),
    }));
    expect(submit.mock.calls[0][0].fileIds).not.toContain('243046');
    await waitFor(() => expect(close).toHaveBeenCalledExactlyOnceWith(false));
  });

  it('keeps an entirely invalid selection disabled and identifies the unusable filename', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(<BatchRenameDialog open selectedFiles={[{ id: '243046', filename: '.jpg' }]} onSubmit={submit} onOpenChange={vi.fn()} apiEnabled />);
    await chooseOption(user, 'Mode', 'Edit numbering');
    await chooseOption(user, 'Numbering action', 'Remove existing numbers');
    expect(screen.getByRole('button', { name: 'Rename selected' })).toBeDisabled();
    const skippedNotice = screen.getByRole('status');
    expect(skippedNotice).toHaveTextContent('No files can be renamed with this pattern.');
    expect(within(skippedNotice).getByText('.jpg', { exact: true })).toBeVisible();
    expect(submit).not.toHaveBeenCalled();
  });

  it.each(['sequence', 'renumber'] as const)('numbers the accepted subset exactly as the server will after skipping an overlong first file (%s)', async operation => {
    const user = userEvent.setup();
    const submit = vi.fn();
    const overlongAfterNumbering = `${'a'.repeat(249)}.jpg`;
    const selection = [
      { id: '1', filename: overlongAfterNumbering },
      { id: '2', filename: 'Kitchen.jpg' },
    ];
    render(<BatchRenameDialog open selectedFiles={selection} onSubmit={submit} onOpenChange={vi.fn()} apiEnabled />);
    await chooseOption(user, 'Mode', operation === 'sequence' ? 'Sequence' : 'Edit numbering');
    if (operation === 'renumber') await chooseOption(user, 'Numbering action', 'Replace with a new sequence');
    expect(screen.getByLabelText('Start')).toHaveValue('1');
    expect(screen.getByLabelText('Digits')).toHaveValue('2');
    expect(screen.getByLabelText('Separator')).toHaveValue('-');
    expect(screen.getByText('Kitchen-01.jpg', { exact: true })).toBeVisible();
    expect(screen.queryByText('Kitchen-02.jpg', { exact: true })).not.toBeInTheDocument();
    expect(within(screen.getByRole('status')).getByText(overlongAfterNumbering, { exact: true })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Rename 1 file' }));
    expect(submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      mode: operation === 'sequence' ? 'sequence' : 'numbering', fileIds: ['2'], start: 1, digits: 2, separator: '-',
      ...(operation === 'renumber' ? { number_action: 'renumber' } : {}),
    }));
  });

  it('submits Remove existing numbers for thirty selected files after switching from an empty Prefix', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    const close = vi.fn();
    render(<BatchRenameDialog open selectedFiles={numberedFiles} onSubmit={submit} onOpenChange={close} apiEnabled />);
    expect(screen.getByRole('dialog', { name: 'Batch rename (30)' })).toBeVisible();
    expect(screen.getByLabelText('Value')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Rename selected' })).toBeDisabled();
    await chooseOption(user, 'Mode', 'Edit numbering');
    await chooseOption(user, 'Numbering action', 'Remove existing numbers');
    expect(screen.getByText('Preview (first 5)')).toBeVisible();
    for (let index = 1; index <= 5; index++) {
      expect(screen.getByText(`2703 Maurleen Drive room ${index}.jpg`)).toBeVisible();
    }
    expect(screen.queryByLabelText('Value')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Digits')).not.toBeInTheDocument();
    const rename = screen.getByRole('button', { name: 'Rename selected' });
    expect(rename).toBeEnabled();
    await user.click(rename);
    expect(submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ mode: 'numbering', number_action: 'remove' }));
    await waitFor(() => expect(close).toHaveBeenCalledExactlyOnceWith(false));
  });

  it.each(['Remove existing numbers', 'Move existing numbers'])('ignores invalid hidden sequence fields when switching to %s', async action => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(<BatchRenameDialog open selectedFiles={numberedFiles} onSubmit={submit} onOpenChange={vi.fn()} apiEnabled />);
    await chooseOption(user, 'Mode', 'Sequence');
    await user.type(screen.getByLabelText('Filename (optional)'), 'Unused hidden filename');
    await user.clear(screen.getByLabelText('Start'));
    await user.type(screen.getByLabelText('Start'), '-1');
    await user.clear(screen.getByLabelText('Digits'));
    await user.type(screen.getByLabelText('Digits'), '99');
    await user.clear(screen.getByLabelText('Separator'));
    await user.type(screen.getByLabelText('Separator'), '_');
    expect(screen.getByRole('button', { name: 'Rename selected' })).toBeDisabled();
    await chooseOption(user, 'Mode', 'Edit numbering');
    await chooseOption(user, 'Numbering action', action);
    expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Digits')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename selected' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Rename selected' }));
    expect(submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ mode: 'numbering', number_action: action.startsWith('Remove') ? 'remove' : 'move' }));
    const payload = submit.mock.calls[0][0];
    expect(payload.start).toBeUndefined();
    expect(payload.digits).toBeUndefined();
    expect(payload.value).toBeUndefined();
    expect(payload.find).toBeUndefined();
    expect(payload.replace).toBeUndefined();
    if (action.startsWith('Remove')) {
      expect(payload.separator).toBeUndefined();
      expect(payload.number_position).toBeUndefined();
    } else {
      expect(payload.separator).toBe('_');
      expect(payload.number_position).toBe('end');
    }
  });

  it('blocks repeated clicks while the valid subset rename is in progress', async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const submit = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const close = vi.fn();
    render(<BatchRenameDialog open selectedFiles={numberedFiles} onSubmit={submit} onOpenChange={close} apiEnabled />);
    await chooseOption(user, 'Mode', 'Edit numbering');
    const rename = screen.getByRole('button', { name: 'Rename selected' });
    fireEvent.click(rename);
    fireEvent.click(rename);
    expect(submit).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Renaming…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(close).not.toHaveBeenCalled();
    await act(async () => { finish(); });
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
  });

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
