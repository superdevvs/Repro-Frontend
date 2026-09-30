/** Allowed display-name characters for media rename (matches Backend contract). */
export const MEDIA_FILENAME_SAFE_PATTERN = /^[A-Za-z0-9 ._()-]+$/;

const PATH_SEPARATOR_PATTERN = /[\\/]/;

export type MediaFilenameValidationResult =
  | { ok: true; filename: string }
  | { ok: false; message: string };

/**
 * Normalize a user-entered rename value against the current filename.
 * - Trims whitespace
 * - Rejects path separators and unsafe chars
 * - Caps length at 255
 * - If the user omits an extension, appends the current file's extension
 * - If they supply a different extension, returns an error (Backend would 422)
 */
export const validateMediaFilenameInput = (
  rawInput: string,
  currentFilename: string,
): MediaFilenameValidationResult => {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return { ok: false, message: 'Enter a filename.' };
  }
  if (PATH_SEPARATOR_PATTERN.test(trimmed)) {
    return { ok: false, message: 'Filename cannot include path separators.' };
  }
  if (trimmed.length > 255) {
    return { ok: false, message: 'Filename must be 255 characters or fewer.' };
  }
  if (!MEDIA_FILENAME_SAFE_PATTERN.test(trimmed)) {
    return {
      ok: false,
      message: 'Use letters, numbers, spaces, and . _ - ( ) only.',
    };
  }

  const currentExtMatch = String(currentFilename || '').match(/\.([^.]+)$/);
  const currentExt = currentExtMatch ? currentExtMatch[1] : '';
  const inputExtMatch = trimmed.match(/\.([^.]+)$/);
  const inputExt = inputExtMatch ? inputExtMatch[1] : '';

  let filename = trimmed;
  if (!inputExt && currentExt) {
    filename = `${trimmed}.${currentExt}`;
  } else if (inputExt && currentExt && inputExt.toLowerCase() !== currentExt.toLowerCase()) {
    return {
      ok: false,
      message: `Keep the .${currentExt} extension (or omit it).`,
    };
  }

  if (filename.length > 255) {
    return { ok: false, message: 'Filename must be 255 characters or fewer.' };
  }
  if (!MEDIA_FILENAME_SAFE_PATTERN.test(filename)) {
    return {
      ok: false,
      message: 'Use letters, numbers, spaces, and . _ - ( ) only.',
    };
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
