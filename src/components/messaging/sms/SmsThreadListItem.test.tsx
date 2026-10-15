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
  it.each(['A aprobat „Shoot reminder”', 'Liked “Shoot reminder”', 'Liked "Shoot reminder"'])('previews a complete inbound like as an emoji and quoted text: %s', (body) => {
    const { container } = render(<SmsThreadListItem thread={thread(body)} />);

    expect(screen.getByText('👍 Shoot reminder')).toBeTruthy();
    expect(container.textContent).not.toContain(body);
    expect(container.textContent).not.toContain('Liked your message');
  });

  it('previews only the first line of a reacted-to multiline reminder', () => {
    const { container } = render(<SmsThreadListItem thread={thread('Loved “Shoot reminder\n104 Test Lane\nDetails: https://reprodashboard.com/shoots/2474”')} />);

    expect(screen.getByText('❤️ Shoot reminder')).toBeTruthy();
    expect(container.textContent).not.toContain('104 Test Lane');
  });

  it('previews a removed reaction clearly', () => {
    render(<SmsThreadListItem thread={thread('Removed a like from “Shoot reminder”')} />);

    expect(screen.getByText('Removed 👍')).toBeTruthy();
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
