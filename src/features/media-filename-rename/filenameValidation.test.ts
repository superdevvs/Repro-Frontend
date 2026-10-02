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

  it('removes commas from an address while preserving the RAW extension', () => {
    expect(validateMediaFilenameInput('18502 Boysenberry Dr 156, Gaithersburg, MD_5129.CR3', 'SNAP5129.CR3')).toEqual({
      ok: true,
      filename: '18502 Boysenberry Dr 156 Gaithersburg MD_5129.CR3',
    });
  });

  it.each([
    ['../evil.jpg', 'evil.jpg'],
    ['bad/name.jpg', 'badname.jpg'],
    ['bad\\name.jpg', 'badname.jpg'],
    ['bad,*?:<>|"\u0000\r\n\tname.jpg', 'badname.jpg'],
    [' .Café (entrée) [2].jpg. ', 'Café (entrée) [2].jpg'],
  ])('cleans %s into a safe display name', (input, filename) => {
    expect(validateMediaFilenameInput(input, 'shot.jpg')).toEqual({ ok: true, filename });
  });

  it.each(['', ',/?*', ',/?*.jpg', ' ... '])('rejects %s when cleanup leaves no name', (input) => {
    expect(validateMediaFilenameInput(input, 'shot.jpg')).toMatchObject({ ok: false });
  });

  it('keeps the final name within the server byte limit', () => {
    expect(validateMediaFilenameInput('é'.repeat(126), 'shot.jpg')).toMatchObject({ ok: false });
  });

  it('exposes basename for the input default', () => {
    expect(getMediaFilenameBase('living-room-01.jpg')).toBe('living-room-01');
  });
});
