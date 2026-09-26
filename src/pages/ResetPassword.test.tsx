import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from './ResetPassword';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://example.test' }));

const renderPage = (query: string) => render(
  <MemoryRouter initialEntries={[`/reset-password?${query}`]}>
    <ResetPassword />
  </MemoryRouter>,
);

const submitPassword = async (buttonName = 'Reset Password') => {
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'New-password-123' } });
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'New-password-123' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: buttonName })); });
};

describe('ResetPassword email links', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    ['normal', 'token=opaque%2B%2F%3D%26amp%3B%252B&email=client%2Bphotos%40example.com'],
    ['legacy email button', 'token=opaque%2B%2F%3D%26amp%3B%252B&amp;email=client%2Bphotos%40example.com'],
    ['legacy email button with email first', 'email=client%2Bphotos%40example.com&amp;token=opaque%2B%2F%3D%26amp%3B%252B'],
  ])('renders and submits a %s link without decoding credential values twice', async (_, query) => {
    renderPage(query);

    expect(screen.getByRole('heading', { name: 'Reset Your Password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('client+photos@example.com');
    expect(fetchMock).not.toHaveBeenCalled();

    await submitPassword();

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://example.test/api/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'client+photos@example.com',
        token: 'opaque+/=&amp;%2B',
        password: 'New-password-123',
        password_confirmation: 'New-password-123',
      }),
    });
    expect(screen.getByRole('heading', { name: 'Password Reset Successful' })).toBeInTheDocument();
  });

  it('prefers normal query parameters when legacy aliases are also present', async () => {
    renderPage('amp;token=wrong&token=correct&amp;email=wrong%40example.com&email=client%40example.com&amp;mode=create&mode=reset');

    expect(screen.getByRole('heading', { name: 'Reset Your Password' })).toBeInTheDocument();
    await submitPassword();

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ token: 'correct', email: 'client@example.com' });
  });

  it('preserves create-password mode from a legacy email button', async () => {
    renderPage('token=create-token&amp;email=client%40example.com&amp;mode=create');

    expect(screen.getByRole('heading', { name: 'Create Your Password' })).toBeInTheDocument();
    await submitPassword('Create Password');

    expect(screen.getByRole('heading', { name: 'Password Created' })).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ token: 'create-token', email: 'client@example.com' });
  });

  it.each([
    'token=reset-token',
    'amp;email=client%40example.com',
    'token=&amp;token=legacy-token&email=client%40example.com',
    'token=reset-token&email=&amp;email=client%40example.com',
  ])('still rejects missing or empty required credentials: %s', (query) => {
    renderPage(query);

    expect(screen.getByRole('heading', { name: 'Invalid Reset Link' })).toBeInTheDocument();
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps server validation failures visible for a recovered link', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: 'This password reset token is invalid.' }) });
    renderPage('token=expired-token&amp;email=client%40example.com');

    await submitPassword();

    expect(screen.getByText('This password reset token is invalid.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Password Reset Successful' })).not.toBeInTheDocument();
  });
});
