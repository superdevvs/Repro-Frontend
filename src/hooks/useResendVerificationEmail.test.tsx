import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResendVerificationEmail } from './useResendVerificationEmail';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), setUser: vi.fn(), toast: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ setUser: mocks.setUser }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/utils/authToken', () => ({ getAuthToken: () => 'test-token' }));
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch);
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ sent: true, message: 'Verification sent.' }) });
  window.history.replaceState({}, '', '/');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

describe('verification email return destination', () => {
  it('includes only the explicitly allowed free edit route', async () => {
    const { result } = renderHook(useResendVerificationEmail);
    await act(async () => { await result.current.resendVerification('/listing-studio/free-edits'); });
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ return_to: '/listing-studio/free-edits' });
  });
  it('preserves the offer destination when the global verification notice sends the email', async () => {
    window.history.replaceState({}, '', '/listing-studio/free-edits');
    const { result } = renderHook(useResendVerificationEmail);
    await act(async () => { await result.current.resendVerification(); });
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ return_to: '/listing-studio/free-edits' });
  });
  it.each([undefined, '/dashboard', 'https://unsafe.example', '//unsafe.example', '/listing-studio/free-edits?returnTo=unsafe'])('keeps default verification behavior for %s', async destination => {
    const { result } = renderHook(useResendVerificationEmail);
    await act(async () => { await result.current.resendVerification(destination); });
    expect(mocks.fetch.mock.calls[0][1]).not.toHaveProperty('body');
  });
  it('does not change staff resends for other accounts', async () => {
    window.history.replaceState({}, '', '/listing-studio/free-edits');
    const { result } = renderHook(useResendVerificationEmail);
    await act(async () => { await result.current.resendForAccount({ id: 8 }); });
    expect(mocks.fetch.mock.calls[0][1]).not.toHaveProperty('body');
  });
});
