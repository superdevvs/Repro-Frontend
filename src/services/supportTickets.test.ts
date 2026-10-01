import { beforeEach, expect, it, vi } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { createSupportTicket, replySupportTicket } from './supportTickets';

const wire = vi.hoisted(() => vi.fn());
vi.mock('./api', async () => {
  const { default: axios } = await import('axios');
  return { apiClient: axios.create({ headers: { 'Content-Type': 'application/json' }, adapter: async (config: InternalAxiosRequestConfig) => {
    wire(config); return { config, data: { data: { id: 44 } }, status: 201, statusText: 'Created', headers: {} };
  } }) };
});
beforeEach(() => wire.mockClear());
it('sends real files as multipart after Axios transforms rather than serializing them to JSON', async () => {
  const file = new File(['image-bytes'], 'screen.png', { type: 'image/png' });
  await createSupportTicket({ request_key: 'same-key', subject: 'Help with upload', category: 'uploads', body: 'My upload is stuck.', attachments: [file] });
  const config = wire.mock.calls[0][0] as InternalAxiosRequestConfig;
  expect(config.data).toBeInstanceOf(FormData);
  expect(config.headers.get('Content-Type')).toBe('multipart/form-data');
  expect(config.data.get('attachments[]')).toBe(file);
  expect(config.data.get('request_key')).toBe('same-key');
  expect(config.data.get('body')).toBe('My upload is stuck.');
});
it('keeps ordinary submissions JSON and encodes multipart internal-note booleans for Laravel', async () => {
  await replySupportTicket(44, { request_key: 'reply-key', body: 'Update', internal: false });
  expect(JSON.parse(wire.mock.calls[0][0].data)).toEqual({ request_key: 'reply-key', body: 'Update', internal: false });
  await replySupportTicket(44, { request_key: 'note-key', body: 'Staff note', internal: true, attachments: [new File(['data'], 'note.txt')] });
  expect(wire.mock.calls[1][0].data.get('internal')).toBe('1');
  expect(wire.mock.calls[1][0].url).toBe('/support/tickets/44/replies');
});
