import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageMediaFile } from '@/services/messageMedia';
import type { SmsMessageDetail } from '@/types/messaging';
import { SmsMessageBubble } from './SmsMessageBubble';

vi.mock('@/services/messageMedia', () => ({ fetchMessageMediaBlob: vi.fn() }));
vi.mock('@/hooks/shootHistoryDownloadHelpers', () => ({ downloadBlob: vi.fn() }));
import { fetchMessageMediaBlob } from '@/services/messageMedia';
import { downloadBlob } from '@/hooks/shootHistoryDownloadHelpers';

const link = 'https://api.reprodashboard.com/api/messaging/media/bundle/5f0c2f6e-8d3b-4a53-9c38-1c4f1f6f2a10?expires=1797000000&signature=abc123';
const message = (body: string, direction: SmsMessageDetail['direction']): SmsMessageDetail => ({ id: '41', threadId: '7', direction, body });
const media = (id: string, change: Partial<MessageMediaFile> = {}): MessageMediaFile => ({
  id, name: `${id}.jpg`, size: 2_400_000, type: 'image/jpeg', status: 'ready',
  download_url: `/api/messaging/media/files/${id}`, preview_url: `/api/messaging/media/files/${id}?preview=1`, ...change,
});
const show = (ui: ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  let made = 0;
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => `blob:media-${made += 1}`), revokeObjectURL: vi.fn() }));
  vi.mocked(fetchMessageMediaBlob).mockReset().mockResolvedValue(new Blob(['image'], { type: 'image/jpeg' }));
  vi.mocked(downloadBlob).mockReset();
});
afterEach(cleanup);

describe('attachments in an SMS bubble', () => {
  it('shows a sent photo inline in place of the attachment link and keeps the written text', async () => {
    show(<SmsMessageBubble message={message(`Front elevation for you.\n\nAttachments (1)\n${link}`, 'OUTBOUND')} attachments={[media('front')]} />);

    const image = await screen.findByRole('img', { name: 'front.jpg' });
    expect(image).toHaveAttribute('src', 'blob:media-1');
    expect(fetchMessageMediaBlob).toHaveBeenCalledWith('/api/messaging/media/files/front?preview=1', expect.anything());
    expect(screen.getByText('Front elevation for you.')).toBeInTheDocument();
    expect(screen.queryByText(/Attachments \(1\)/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('opens a larger view with the file name, size and a download of the same bytes', async () => {
    const user = userEvent.setup();
    show(<SmsMessageBubble message={message('', 'INBOUND')} attachments={[media('kitchen')]} />);

    await user.click(await screen.findByRole('button', { name: 'View kitchen.jpg larger' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('img', { name: 'kitchen.jpg' })).toBeInTheDocument();
    expect(within(dialog).getByText('2.3 MB')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Download' }));
    expect(downloadBlob).toHaveBeenCalledWith('kitchen.jpg', expect.any(Blob));
    expect(fetchMessageMediaBlob).toHaveBeenCalledTimes(1);
  });

  it('lists other files as named downloads and fetches them only when asked', async () => {
    const user = userEvent.setup();
    const pdf = media('plan', { name: 'Floor plan.pdf', type: 'application/pdf', size: 880_000, preview_url: '/api/messaging/media/files/plan?preview=1' });
    show(<SmsMessageBubble message={message('Plan attached', 'INBOUND')} attachments={[pdf]} />);

    const button = screen.getByRole('button', { name: 'Download Floor plan.pdf' });
    expect(within(button).getByText('859 KB')).toBeInTheDocument();
    expect(fetchMessageMediaBlob).not.toHaveBeenCalled();

    await user.click(button);

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith('Floor plan.pdf', expect.any(Blob)));
    expect(fetchMessageMediaBlob).toHaveBeenCalledWith('/api/messaging/media/files/plan');
  });

  it('says when a download fails and lets the same file be tried again', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchMessageMediaBlob).mockRejectedValueOnce(new Error('Network Error'));
    show(<SmsMessageBubble message={message('', 'INBOUND')} attachments={[media('deck', { name: 'deck.zip', type: 'application/zip' })]} />);

    await user.click(screen.getByRole('button', { name: 'Download deck.zip' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Download failed. Select the file to try again.');

    await user.click(screen.getByRole('button', { name: 'Download deck.zip' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith('deck.zip', expect.any(Blob)));
  });

  it('explains media that is still arriving, blocked, or lost instead of offering it', () => {
    show(<SmsMessageBubble message={message('', 'INBOUND')} attachments={[
      media('a', { status: 'importing' }), media('b', { status: 'scanning' }),
      media('c', { status: 'rejected' }), media('d', { status: 'unavailable' }),
    ]} />);

    expect(screen.getByText('Receiving attachment…')).toBeInTheDocument();
    expect(screen.getByText('Checking attachment for viruses…')).toBeInTheDocument();
    expect(screen.getByText('An attachment was blocked by the virus scan.')).toBeInTheDocument();
    expect(screen.getByText('An attachment could not be retrieved from the carrier.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(fetchMessageMediaBlob).not.toHaveBeenCalled();
  });

  it('keeps the original link when the files cannot be listed, and hides it only while they load', () => {
    const sent = message(`Attachments (2)\n${link}`, 'OUTBOUND');
    const { rerender } = show(<SmsMessageBubble message={sent} attachmentsLoading />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    rerender(<QueryClientProvider client={new QueryClient()}><SmsMessageBubble message={sent} attachments={[]} /></QueryClientProvider>);
    expect(screen.getByRole('link')).toHaveAttribute('href', link);
  });

  it('never rewrites text a contact sent, even when it looks like an attachment link', () => {
    const body = `Attachments (1)\n${link}`;
    show(<SmsMessageBubble message={message(body, 'INBOUND')} attachments={[media('x', { status: 'importing' })]} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', link);
  });
});
