import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComposeRobbie, ComposeVariables } from './composeDeskParts';

const post = vi.hoisted(() => vi.fn());
vi.mock('@/services/api', () => ({ apiClient: { post } }));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('automatic recipient fields', () => {
  it('offers recipient insertion without asking for a shared name value', () => {
    const onInsert = vi.fn();
    render(<ComposeVariables suggestions={[{ name: 'recipient_first_name', label: 'First name' }, { name: 'recipient_note', label: 'Note' }]} missing={['recipient_first_name', 'recipient_note']} json="" onJson={vi.fn()} onInsert={onInsert}/>);
    expect(screen.queryByRole('textbox', { name: 'recipient_first_name' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'recipient_note' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Insert variable' }));
    fireEvent.click(screen.getByRole('button', { name: /recipient_first_name/ }));
    expect(onInsert).toHaveBeenCalledWith('recipient_first_name');
  });
});

describe('Robbie compose edits', () => {
  it('changes and undoes only the subject for subject assistance', async () => {
    const onBody = vi.fn(), onSubject = vi.fn(), onRestore = vi.fn();
    post.mockResolvedValue({ data: { subject: 'A better subject', body: 'Unexpected body rewrite' } });
    render(<ComposeRobbie body="Existing copy" bodyHtml='<table><tr><td>Existing copy</td></tr></table>' subject="Original subject" onBody={onBody} onSubject={onSubject} onRestore={onRestore}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Subject' }));
    await waitFor(() => expect(onSubject).toHaveBeenCalledWith('A better subject'));
    expect(onBody).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onRestore).toHaveBeenCalledWith({ subject: 'Original subject' });
  });

  it('keeps unchanged body HTML and restores the exact HTML after a real rewrite', async () => {
    const onBody = vi.fn(), onSubject = vi.fn(), onRestore = vi.fn();
    const bodyHtml = '<table style="background:navy"><tr><td>Existing copy</td></tr></table>';
    post.mockResolvedValueOnce({ data: { subject: 'Original subject', body: 'Existing copy' } });
    render(<ComposeRobbie body="Existing copy" bodyHtml={bodyHtml} subject="Original subject" onBody={onBody} onSubject={onSubject} onRestore={onRestore}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Warmer' }));
    await screen.findByText('The current wording is unchanged.');
    expect(onBody).not.toHaveBeenCalled();
    post.mockResolvedValueOnce({ data: { subject: 'Original subject', body: 'Revised copy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Shorter' }));
    await waitFor(() => expect(onBody).toHaveBeenCalledWith('Revised copy'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onRestore).toHaveBeenCalledWith({ body: 'Existing copy', bodyHtml });
  });
});
