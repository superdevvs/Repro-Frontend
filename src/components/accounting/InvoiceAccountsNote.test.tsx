import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceAccountsNote } from './InvoiceAccountsNote';
import { fetchInvoiceAccountsNote, saveInvoiceAccountsNote } from '@/services/invoiceAccountsNoteService';
import type { InvoiceAccountsNote as Note } from '@/services/invoiceAccountsNoteService';

vi.mock('@/services/invoiceAccountsNoteService', () => ({
  fetchInvoiceAccountsNote: vi.fn(), saveInvoiceAccountsNote: vi.fn(),
}));
const stored = (note: string): Note => ({ note, author: { id: 3, name: 'Accounts' }, created_at: null, updated_at: null });
const deferred = () => {
  let resolve!: (value: Note) => void;
  const promise = new Promise<Note>((done) => { resolve = done; });
  return { promise, resolve };
};
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

describe('Private invoice accounts notes', () => {
  it('loads and saves to the selected invoice only, retaining the returned author metadata', async () => {
    vi.mocked(fetchInvoiceAccountsNote).mockResolvedValue(stored('Existing note'));
    vi.mocked(saveInvoiceAccountsNote).mockResolvedValue({ ...stored('Updated note'), updated_at: '2026-09-27T10:00:00Z' });
    render(<InvoiceAccountsNote invoiceId={17} />);
    const input = await screen.findByDisplayValue('Existing note');
    fireEvent.change(input, { target: { value: 'Updated note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(saveInvoiceAccountsNote).toHaveBeenCalledWith(17, 'Updated note'));
    expect(await screen.findByRole('status')).toHaveTextContent('saved');
    expect(screen.getByText(/Saved by Accounts/)).toBeInTheDocument();
  });

  it('ignores late fetches from a previously selected invoice', async () => {
    const first = deferred();
    vi.mocked(fetchInvoiceAccountsNote).mockReturnValueOnce(first.promise).mockResolvedValueOnce(stored('Second invoice'));
    const view = render(<InvoiceAccountsNote invoiceId={1} />);
    view.rerender(<InvoiceAccountsNote invoiceId={2} />);
    await screen.findByDisplayValue('Second invoice');
    await act(async () => first.resolve(stored('First invoice secret')));
    expect(screen.queryByDisplayValue('First invoice secret')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Second invoice')).toBeEnabled();
  });

  it('resets a pending save on invoice change and ignores its late response', async () => {
    const pendingSave = deferred();
    vi.mocked(fetchInvoiceAccountsNote).mockResolvedValueOnce(stored('First')).mockResolvedValueOnce(stored('Second'));
    vi.mocked(saveInvoiceAccountsNote).mockReturnValue(pendingSave.promise);
    const view = render(<InvoiceAccountsNote invoiceId={1} />);
    fireEvent.change(await screen.findByDisplayValue('First'), { target: { value: 'Changed first' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    view.rerender(<InvoiceAccountsNote invoiceId={2} />);
    expect(await screen.findByDisplayValue('Second')).toBeEnabled();
    await act(async () => pendingSave.resolve(stored('Changed first')));
    expect(screen.getByDisplayValue('Second')).toBeEnabled();
    expect(screen.queryByDisplayValue('Changed first')).not.toBeInTheDocument();
  });

  it('keeps edits available after save failure and blocks editing a failed load', async () => {
    vi.mocked(fetchInvoiceAccountsNote).mockResolvedValueOnce(stored('Original')).mockRejectedValueOnce(new Error('Unavailable'));
    vi.mocked(saveInvoiceAccountsNote).mockRejectedValue(new Error('Unavailable'));
    const view = render(<InvoiceAccountsNote invoiceId={1} />);
    fireEvent.change(await screen.findByDisplayValue('Original'), { target: { value: 'Unsaved' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your changes are still here');
    expect(screen.getByDisplayValue('Unsaved')).toBeEnabled();
    view.rerender(<InvoiceAccountsNote invoiceId={2} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not load'));
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
