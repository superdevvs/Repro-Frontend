import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { SmsThreadSummary } from '@/types/messaging';
import { SmsThreadListItem } from './SmsThreadListItem';

afterEach(cleanup);

const thread = (lastMessageSnippet: string, lastDirection: SmsThreadSummary['lastDirection'] = 'INBOUND'): SmsThreadSummary => ({
  id: 'thread-1', unread: false, lastMessageSnippet, lastDirection,
  contact: { id: 'contact-1', name: 'Test Photographer', numbers: [] },
});

describe('SmsThreadListItem reaction previews', () => {
  it.each(['A aprobat „Shoot reminder”', 'Liked “Shoot reminder”', 'Liked "Shoot reminder"'])('explains a complete inbound like: %s', (body) => {
    const { container } = render(<SmsThreadListItem thread={thread(body)} />);

    expect(screen.getByText('👍 Liked your message')).toBeTruthy();
    expect(container.textContent).not.toContain(body);
  });

  it('preserves matching outbound text', () => {
    const body = 'A aprobat „Shoot reminder”';
    render(<SmsThreadListItem thread={thread(body, 'OUTBOUND')} />);

    expect(screen.getByText(body)).toBeTruthy();
    expect(screen.queryByText('👍 Liked your message')).toBeNull();
  });

  it.each(['Thanks, I will be there.', 'A aprobat „”', 'A aprobat „Shoot reminder…', 'A aprobat „Shoot reminder” with a note'])('preserves normal or incomplete inbound previews: %s', (body) => {
    render(<SmsThreadListItem thread={thread(body)} />);

    expect(screen.getByText(body)).toBeTruthy();
    expect(screen.queryByText('👍 Liked your message')).toBeNull();
  });
});
