import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { registrationFailure, registrationSuccess } from './registrationResponse';

const apiError = (data: unknown, status = 422) => new AxiosError('Request failed', undefined, undefined, undefined, {
  data, status, statusText: 'Error', headers: {}, config: {} as never,
});

describe('registration responses', () => {
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
