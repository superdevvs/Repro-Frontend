import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { SmsMessageDetail } from '@/types/messaging';
import { SmsMessageBubble } from './SmsMessageBubble';

afterEach(cleanup);

const reminder = 'Shoot reminder\n104 Test Lane, Unit 2\nOct 15, 2026 2:30 PM EDT\nContact: Test Contact 703-555-0100\nDetails: https://reprodashboard.com/shoots/2474';
const message = (body: string, direction: SmsMessageDetail['direction'] = 'INBOUND'): SmsMessageDetail => ({
  id: 'message-1', threadId: 'thread-1', direction, body,
});

describe('SmsMessageBubble reactions', () => {
  it('explains a Romanian like and keeps its quoted reminder and working link', () => {
    const inbound = message(`A aprobat „${reminder}”`);
    const { container } = render(<SmsMessageBubble message={inbound} />);

    expect(screen.getByText('👍 Liked your message')).toBeTruthy();
    expect(container.querySelector('blockquote')?.textContent).toBe(reminder);
    expect(container.textContent).not.toContain('A aprobat');
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://reprodashboard.com/shoots/2474');
    expect(inbound.body).toBe(`A aprobat „${reminder}”`);
  });

  it.each(['Liked “Message received”', 'Liked "Message received"'])('explains the English transport text %s', (body) => {
    const { container } = render(<SmsMessageBubble message={message(body)} />);

    expect(screen.getByText('👍 Liked your message')).toBeTruthy();
    expect(container.querySelector('blockquote')?.textContent).toBe('Message received');
  });

  it.each([
    'Thanks, I will be there.',
    'A aprobat „Shoot reminder” and added a note.',
    'Note: A aprobat „Shoot reminder”',
    'A aprobat „”',
    'Liked ""',
    'A aprobat „Shoot reminder',
  ])('preserves ordinary or incomplete incoming text: %s', (body) => {
    const { container } = render(<SmsMessageBubble message={message(body)} />);

    expect(screen.queryByText('👍 Liked your message')).toBeNull();
    expect(container.querySelector('blockquote')).toBeNull();
    expect(container.querySelector('p')?.textContent).toBe(body);
  });

  it('preserves outbound text even when it matches a reaction envelope', () => {
    const body = 'A aprobat „Shoot reminder”';
    const { container } = render(<SmsMessageBubble message={message(body, 'OUTBOUND')} />);

    expect(screen.queryByText('👍 Liked your message')).toBeNull();
    expect(container.querySelector('p')?.textContent).toBe(body);
  });

  it.each([['„', '”'], ['“', '”'], ['«', '»']])('keeps Unicode quotation marks outside ordinary message links: %s%s', (open, close) => {
    const body = `Details: ${open}https://reprodashboard.com/shoots/2474${close}`;
    const { container } = render(<SmsMessageBubble message={message(body)} />);

    expect(screen.getByRole('link').getAttribute('href')).toBe('https://reprodashboard.com/shoots/2474');
    expect(container.querySelector('p')?.textContent).toBe(body);
  });
});
