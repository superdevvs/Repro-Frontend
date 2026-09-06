/** Matches the server's character minimum and bcrypt's UTF-8 byte boundary. */
export function accountPasswordError(value: string): string | null {
  if (Array.from(value).length < 8) return 'Password must be at least 8 characters.';
  if (new TextEncoder().encode(value).length > 72) return 'Password must be at most 72 UTF-8 bytes.';
  if (value.includes('\0')) return 'Password must not contain null characters.';
  return null;
}
