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
  it('renders an unmatched Romanian like as an emoji with its quoted reminder and working link', () => {
    const inbound = message(`A aprobat „${reminder}”`);
    const { container } = render(<SmsMessageBubble message={inbound} />);

    expect(screen.getByRole('img', { name: 'Like reaction from Contact' }).textContent).toBe('👍');
    expect(container.querySelector('blockquote')?.textContent).toBe(reminder);
    expect(container.textContent).not.toContain('A aprobat');
    expect(container.textContent).not.toContain('Liked your message');
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://reprodashboard.com/shoots/2474');
    expect(inbound.body).toBe(`A aprobat „${reminder}”`);
  });

  it.each(['Liked “Message received”', 'Liked "Message received"'])('renders the English transport text %s as an emoji', (body) => {
    const { container } = render(<SmsMessageBubble message={message(body)} />);

    expect(screen.getByRole('img', { name: 'Like reaction from Contact' }).textContent).toBe('👍');
    expect(container.querySelector('blockquote')?.textContent).toBe('Message received');
    expect(container.textContent).not.toContain('Liked');
  });

  it('renders attached reactions on the original outgoing bubble without a quoted duplicate', () => {
    const { container } = render(<SmsMessageBubble
      message={message(reminder, 'OUTBOUND')}
      reactions={[{ emoji: '👍', label: 'Like', sender: '+17035550100' }]}
    />);

    expect(screen.getByRole('img', { name: 'Like reaction from +17035550100' }).textContent).toBe('👍');
    expect(container.querySelector('blockquote')).toBeNull();
    expect(container.querySelector('p')?.textContent).toBe(reminder);
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://reprodashboard.com/shoots/2474');
    expect(container.textContent).not.toContain('Liked');
  });

  it('shows different senders accessibly without replacing the message body', () => {
    const { container } = render(<SmsMessageBubble
      message={message('Shoot reminder', 'OUTBOUND')}
      reactions={[
        { emoji: '👍', label: 'Like', sender: '+17035550100' },
        { emoji: '❤️', label: 'Love', sender: '+17035550200' },
      ]}
    />);

    expect(screen.getByRole('img', { name: 'Like reaction from +17035550100' }).textContent).toBe('👍');
    expect(screen.getByRole('img', { name: 'Love reaction from +17035550200' }).textContent).toBe('❤️');
    expect(container.querySelector('p')?.textContent).toBe('Shoot reminder');
  });

  it('labels an unmatched removed reaction without showing the transport text', () => {
    const { container } = render(<SmsMessageBubble message={message('Removed a like from “Shoot reminder”')} />);

    expect(screen.getByRole('img', { name: 'Removed Like reaction from Contact' }).textContent).toBe('↩️ 👍');
    expect(container.querySelector('blockquote')?.textContent).toBe('Shoot reminder');
    expect(container.textContent).not.toContain('Removed a like from');
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

    expect(screen.queryByRole('img', { name: /reaction from/ })).toBeNull();
    expect(container.querySelector('blockquote')).toBeNull();
    expect(container.querySelector('p')?.textContent).toBe(body);
  });

  it('preserves outbound text even when it matches a reaction envelope', () => {
    const body = 'A aprobat „Shoot reminder”';
    const { container } = render(<SmsMessageBubble message={message(body, 'OUTBOUND')} />);

    expect(screen.queryByRole('img', { name: /reaction from/ })).toBeNull();
    expect(container.querySelector('p')?.textContent).toBe(body);
  });

  it.each([['„', '”'], ['“', '”'], ['«', '»']])('keeps Unicode quotation marks outside ordinary message links: %s%s', (open, close) => {
    const body = `Details: ${open}https://reprodashboard.com/shoots/2474${close}`;
    const { container } = render(<SmsMessageBubble message={message(body)} />);

    expect(screen.getByRole('link').getAttribute('href')).toBe('https://reprodashboard.com/shoots/2474');
    expect(container.querySelector('p')?.textContent).toBe(body);
  });
});
