import { describe, expect, it } from 'vitest';
import { accountPasswordError } from './accountPassword';

describe('new account password rules', () => {
  it('requires eight characters without silently trimming passwords', () => {
    expect(accountPasswordError('1234567')).toMatch(/8 characters/);
    expect(accountPasswordError('1234567 ')).toBeNull();
  });
  it('uses UTF-8 bytes for the bcrypt maximum', () => {
    expect(accountPasswordError('é'.repeat(36))).toBeNull();
    expect(accountPasswordError('é'.repeat(37))).toMatch(/72 UTF-8 bytes/);
    expect(accountPasswordError('😀'.repeat(7))).toMatch(/8 characters/);
    expect(accountPasswordError('😀'.repeat(18))).toBeNull();
    expect(accountPasswordError('😀'.repeat(19))).toMatch(/72 UTF-8 bytes/);
  });
  it('rejects null characters that bcrypt cannot hash', () => {
    expect(accountPasswordError('seven77\0')).toMatch(/null characters/);
    expect(accountPasswordError('Password\0Tail')).toMatch(/null characters/);
  });
});
