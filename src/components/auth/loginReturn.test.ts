import { describe, expect, it } from 'vitest';
import { getLoginPath, getLoginReturnPath, sanitizeLoginReturnPath } from './loginReturn';

describe('login return locations', () => {
  it('preserves the upload guide and other query parameters across the login URL', () => {
    const loginPath = getLoginPath({ pathname: '/dashboard', search: '?guide=uploads&source=email', hash: '#guide' });
    expect(getLoginReturnPath(new URL(loginPath, 'https://reprodashboard.com').search))
      .toBe('/dashboard?guide=uploads&source=email#guide');
  });

  it.each([
    null,
    '',
    'https://attacker.example/dashboard',
    'https://reprodashboard.com/dashboard',
    '//attacker.example/dashboard',
    '/\\attacker.example/dashboard',
    '\\attacker.example/dashboard',
    '/\n/attacker.example/dashboard',
    '/\t/attacker.example/dashboard',
    '/folder/..//attacker.example/dashboard',
    'javascript:alert(1)',
    'dashboard?guide=uploads',
    '/?returnTo=%2Fdashboard',
    '/folder/..',
  ])('uses the dashboard fallback for an unsafe or looping target: %s', (target) => {
    expect(sanitizeLoginReturnPath(target)).toBe('/dashboard');
  });

  it('does not decode an encoded query value into a new redirect target', () => {
    expect(getLoginReturnPath('?returnTo=%252F%252Fattacker.example')).toBe('/dashboard');
    expect(sanitizeLoginReturnPath('/dashboard?source=https%3A%2F%2Fexample.com')).toBe('/dashboard?source=https%3A%2F%2Fexample.com');
  });
});
