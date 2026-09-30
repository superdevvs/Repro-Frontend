import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachPublicApiError,
  dispatchEmailVerificationRequired,
  isUserProfileRequestUrl,
  normalizeApiError,
  resetEmailVerificationEventCooldown,
} from './apiError';

const serverId = '6922f56b-9985-48e7-bf01-ce8b35914187';

describe('public API errors', () => {
  it('keeps validation messages and server correlation while preserving business metadata', () => {
    const data = { message: 'Confirm service removal before saving this shoot.', code: 'service_detach_confirmation_required',
      request_id: serverId, confirmation_token: 'product-confirmation', impact: { removed_service_ids: [12] },
      errors: { services: ['Select a service.'] } };
    const error = { message: 'Request failed', response: { status: 409, data, headers: { 'x-request-id': serverId } } };
    const normalized = attachPublicApiError(error);
    expect(normalized).toMatchObject({ status: 409, code: data.code, requestId: serverId, errors: data.errors });
    expect(error.message).toBe(data.message);
    expect(error.response.data).toBe(data);
    expect(error.response.data.impact.removed_service_ids).toEqual([12]);
  });

  it('keeps resumable upload and MFA envelopes intact', () => {
    for (const data of [
      { message: 'Upload is incomplete.', code: 'upload_incomplete', upload_session: { id: 8 }, missing_chunks: [1, 3] },
      { message: 'Enter your authentication code.', code: 'mfa_required', challenge_id: 'challenge' },
    ]) {
      const error = { response: { status: 409, data } };
      attachPublicApiError(error);
      expect(error.response.data).toBe(data);
    }
  });

  it('uses a safe fallback for non-JSON, network, or malformed envelopes', () => {
    expect(normalizeApiError({ message: 'SQL password=secret-canary', response: { status: 500, data: '<html>secret-canary</html>' } }).message)
      .toBe('The request could not be completed. Please try again.');
    expect(normalizeApiError({ message: 'secret-canary' }).code).toBe('network_error');
    expect(normalizeApiError({ response: { status: 422, data: { message: {}, errors: { password: 'bad shape' }, request_id: 'client-supplied' } } }))
      .toMatchObject({ message: 'Please check the information you entered.', requestId: undefined, errors: undefined });
  });

  it('prefers authoritative response headers and signals verification without changing the session', () => {
    const listener = vi.fn();
    window.addEventListener('email-verification-required', listener);
    localStorage.setItem('authToken', 'existing-session');
    const result = attachPublicApiError({ response: { status: 403,
      data: { code: 'email_verification_required', message: 'Verify your email to continue.', request_id: 'stale-value' },
      headers: { 'x-request-id': serverId } } });
    expect(result.requestId).toBe(serverId);
    expect(listener).toHaveBeenCalledOnce();
    expect(localStorage.getItem('authToken')).toBe('existing-session');
    window.removeEventListener('email-verification-required', listener);
  });
});

describe('email verification gate broadcast', () => {
  beforeEach(() => {
    resetEmailVerificationEventCooldown();
  });

  it('recognizes profile URLs so /user 403 cannot re-enter the gate listener', () => {
    expect(isUserProfileRequestUrl('/api/user')).toBe(true);
    expect(isUserProfileRequestUrl('/user')).toBe(true);
    expect(isUserProfileRequestUrl('https://reprodashboard.com/api/user')).toBe(true);
    expect(isUserProfileRequestUrl('/api/shoots')).toBe(false);
  });

  it('does not broadcast when the failing request is the profile endpoint', () => {
    const spy = vi.fn();
    window.addEventListener('email-verification-required', spy);
    attachPublicApiError({
      response: { status: 403, data: { code: 'email_verification_required' } },
      config: { url: '/api/user' },
    });
    attachPublicApiError({
      response: { status: 403, data: { code: 'email_verification_required' } },
      config: { url: '/user' },
    });
    expect(spy).not.toHaveBeenCalled();
    window.removeEventListener('email-verification-required', spy);
  });

  it('coalesces broadcasts from other endpoints', () => {
    const spy = vi.fn();
    window.addEventListener('email-verification-required', spy);
    for (let i = 0; i < 20; i += 1) {
      attachPublicApiError({
        response: { status: 403, data: { code: 'email_verification_required' } },
        config: { url: '/api/shoots' },
      });
    }
    expect(spy).toHaveBeenCalledTimes(1);
    expect(dispatchEmailVerificationRequired()).toBe(false);
    window.removeEventListener('email-verification-required', spy);
  });
});
