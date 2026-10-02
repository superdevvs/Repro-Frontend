/** Allowed display-name characters for media rename (matches Backend contract). */
export const MEDIA_FILENAME_SAFE_PATTERN = /^[\p{L}\p{N}_. ()[\]-]+$/u;

/** Remove unsupported characters and path syntax, matching the server cleanup. */
export const sanitizeMediaFilename = (filename: string): string =>
  String(filename || '')
    .trim()
    .replace(/[^\p{L}\p{N}_. ()[\]-]/gu, '')
    .replace(/\.{2,}/g, '')
    .replace(/^[ .]+|[ .]+$/g, '');

export type MediaFilenameValidationResult =
  | { ok: true; filename: string }
  | { ok: false; message: string };

/**
 * Normalize a user-entered rename value against the current filename.
 * - Trims whitespace
 * - Removes unsupported characters and path syntax
 * - Caps length at 255
 * - If the user omits an extension, appends the current file's extension
 * - If they supply a different extension, returns an error (Backend would 422)
 */
export const validateMediaFilenameInput = (
  rawInput: string,
  currentFilename: string,
): MediaFilenameValidationResult => {
  const trimmed = sanitizeMediaFilename(rawInput);
  if (!trimmed) {
    return { ok: false, message: 'Enter a filename with supported characters.' };
  }
  if (new TextEncoder().encode(trimmed).length > 255) {
    return { ok: false, message: 'Filename must be 255 characters or fewer.' };
  }

  const currentExtMatch = String(currentFilename || '').match(/\.([^.]+)$/);
  const currentExt = currentExtMatch ? currentExtMatch[1] : '';
  const inputExtMatch = trimmed.match(/\.([^.]+)$/);
  const inputExt = inputExtMatch ? inputExtMatch[1] : '';

  let filename = trimmed;
  if (!inputExt && currentExt) {
    filename = `${trimmed}.${currentExt.toLowerCase()}`;
  } else if (inputExt && currentExt && inputExt.toLowerCase() !== currentExt.toLowerCase()) {
    return {
      ok: false,
      message: `Keep the .${currentExt} extension (or omit it).`,
    };
  }

  if (new TextEncoder().encode(filename).length > 255) {
    return { ok: false, message: 'Filename must be 255 characters or fewer.' };
  }

  return { ok: true, filename };
};

/** Basename without extension, for the rename input default. */
export const getMediaFilenameBase = (filename: string): string => {
  const raw = String(filename || '').trim();
  if (!raw) return '';
  const match = raw.match(/^(.*)\.([^.]+)$/);
  return match ? match[1] : raw;
};
