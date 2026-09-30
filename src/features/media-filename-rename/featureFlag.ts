/**
 * Kill switches for media filename rename.
 * Single rename: ON (Backend PATCH …/rename live at SHA 11391dc).
 * Batch rename: OFF until Backend POST …/media/batch-rename is live.
 */
const disabledValues = new Set(['0', 'false', 'off', 'disabled']);

const envEnabled = (value: string | undefined, defaultValue: string) =>
  !disabledValues.has(String(value ?? defaultValue).trim().toLowerCase());

/** Single-file rename in the media lightbox. Default ON. */
export const MEDIA_FILENAME_RENAME_API_ENABLED = envEnabled(
  import.meta.env.VITE_MEDIA_FILENAME_RENAME_ENABLED,
  'true',
);

/** Multi-select batch rename. Default OFF until BE batch-rename is live. */
export const MEDIA_BATCH_RENAME_API_ENABLED = envEnabled(
  import.meta.env.VITE_MEDIA_BATCH_RENAME_ENABLED,
  'false',
);
