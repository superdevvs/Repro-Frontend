import { describe, expect, it } from 'vitest';
import { getMediaFilenameBase, validateMediaFilenameInput } from './filenameValidation';

describe('validateMediaFilenameInput', () => {
  it('appends the current extension when omitted', () => {
    expect(validateMediaFilenameInput('living-room-01', 'shot.jpg')).toEqual({
      ok: true,
      filename: 'living-room-01.jpg',
    });
  });

  it('accepts the same extension', () => {
    expect(validateMediaFilenameInput('living-room-01.jpg', 'shot.jpg')).toEqual({
      ok: true,
      filename: 'living-room-01.jpg',
    });
  });

  it('rejects a different extension', () => {
    expect(validateMediaFilenameInput('living-room-01.png', 'shot.jpg')).toMatchObject({
      ok: false,
    });
  });

  it('rejects path separators and unsafe characters', () => {
    expect(validateMediaFilenameInput('../evil.jpg', 'shot.jpg')).toMatchObject({ ok: false });
    expect(validateMediaFilenameInput('bad/name.jpg', 'shot.jpg')).toMatchObject({ ok: false });
    expect(validateMediaFilenameInput('bad*name.jpg', 'shot.jpg')).toMatchObject({ ok: false });
  });

  it('exposes basename for the input default', () => {
    expect(getMediaFilenameBase('living-room-01.jpg')).toBe('living-room-01');
  });
});
