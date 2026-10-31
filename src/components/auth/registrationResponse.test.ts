import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { registrationFailure, registrationSuccess } from './registrationResponse';

const apiError = (data: unknown, status = 422) => new AxiosError('Request failed', undefined, undefined, undefined, {
  data, status, statusText: 'Error', headers: {}, config: {} as never,
});

describe('registration responses', () => {
  it('directs eligible unverified claim accounts to sign in or reset their password', () => {
    const failure = registrationFailure(apiError({ code: 'account_exists',
      message: 'An account with this email already exists. Please verify your email, then log in.',
      email_verification_required: true,
    }), '/listing-studio/claim');
    expect(failure).toMatchObject({ accountExists: true,
      message: 'An account with this email already exists. Sign in to download your edited photos, or reset your password if needed.',
      emailMessage: 'An account with this email already exists. Sign in to download your edited photos, or reset your password if needed.',
    });
  });

  it.each([false, undefined])('preserves unavailable-account support instructions in the claim flow (flag: %s)', (required) => {
    const message = 'An account with this email already exists. Please contact support for help accessing it.';
    expect(registrationFailure(apiError({ code: 'account_exists', message, email_verification_required: required }), '/listing-studio/claim'))
      .toMatchObject({ accountExists: true, message, emailMessage: message });
  });

  it.each(['/listing-studio/free-edits', '/dashboard', '/listing-studio/claim?extra=1'])('preserves verification guidance outside the exact claim destination: %s', (returnTo) => {
    const message = 'An account with this email already exists. Please verify your email, then log in.';
    expect(registrationFailure(apiError({ code: 'account_exists', message, email_verification_required: true }), returnTo))
      .toMatchObject({ accountExists: true, message, emailMessage: message });
  });

  it.each([true, false])('preserves existing-account instructions (verification required: %s)', (required) => {
    const message = `An account with this email already exists. ${required ? 'Please verify your email, then log in.' : 'Please log in.'}`;
    expect(registrationFailure(apiError({ code: 'account_exists', message, email_verification_required: required })))
      .toMatchObject({ accountExists: true, message, emailMessage: message });
  });

  it('makes older duplicate-email responses actionable', () => {
    expect(registrationFailure(apiError({ errors: { email: ['The email has already been taken.'] } })))
      .toMatchObject({ accountExists: true, message: expect.stringContaining('Please verify your email, then log in.') });
  });

  it('shows a useful validation detail for fields other than email', () => {
    expect(registrationFailure(apiError({ message: 'Validation failed.', errors: { password: ['Password must be at least 8 characters.'] } })))
      .toMatchObject({ accountExists: false, message: 'Password must be at least 8 characters.' });
  });

  it.each([
    '<!doctype html><h1>Under construction</h1>',
    { message: '<html>Under construction</html>' },
    { errors: { email: [{ unexpected: true }] } },
    { message: 42 },
  ])('replaces HTML or malformed errors with form-safe feedback: %j', (data) => {
    const failure = registrationFailure(apiError(data, 500));
    expect(failure.message).toContain("We couldn't complete registration.");
    expect(failure.message).not.toContain('Under construction');
    expect(failure.accountExists).toBe(false);
  });

  it('explains throttling and network failures without exposing request internals', () => {
    expect(registrationFailure(apiError({}, 429)).message).toContain('Too many registration attempts');
    expect(registrationFailure(new AxiosError('secret network detail')).message).toContain("We couldn't complete registration.");
  });

  it.each(['<html>Under construction</html>', {}, { token: 'token' }, { user: { id: 1, name: 'Client', email: 'client@example.com' } }])(
    'rejects incomplete or HTML success payloads: %j', (data) => {
      expect(registrationSuccess(data)).toBeNull();
    },
  );

  it('preserves a valid new-account success response', () => {
    expect(registrationSuccess({ token: 'test-token', user: {
      id: 42, name: 'New Client', email: 'client@example.com', role: 'client', company_name: 'Company',
      account_status: 'active', email_health: { status: 'unverified' },
    } })).toMatchObject({ token: 'test-token', user: {
      id: '42', name: 'New Client', email: 'client@example.com', role: 'client', company: 'Company',
      isActive: true, email_health: { status: 'unverified' },
    } });
  });
});
