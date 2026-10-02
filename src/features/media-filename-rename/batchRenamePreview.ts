import type { BatchRenameMode } from '@/services/shootMediaService';
import { sanitizeMediaFilename } from './filenameValidation';

const splitName = (filename: string): { base: string; ext: string } => {
  const raw = String(filename || '').trim();
  const match = raw.match(/^(.*)\.([^.]+)$/);
  if (!match) {
    return { base: raw, ext: '' };
  }
  return { base: match[1], ext: match[2] };
};

const withExt = (base: string, ext: string) => (ext ? `${base}.${ext}` : base);

export interface BatchRenamePreviewInput {
  mode: BatchRenameMode;
  value?: string;
  find?: string;
  replace?: string;
  start?: number;
  digits?: number;
  separator?: string;
  number_action?: 'remove' | 'move' | 'renumber';
  number_position?: 'start' | 'end';
}

/** Only a separate number token is numbering; street numbers and camera IDs stay intact. */
export const splitFilenameNumber = (base: string): { stem: string; number?: string } => {
  const leading = base.match(/^(\d+)[_-]+(.+)$/);
  if (leading) return { stem: leading[2], number: leading[1] };
  const trailing = base.match(/^(.+)[_-]+(\d+)$/);
  if (trailing) return { stem: trailing[1], number: trailing[2] };
  return { stem: base };
};

/** Client-side preview of batch rename results (does not call the API). */
export const previewBatchRenameFilenames = (
  filenames: string[],
  input: BatchRenamePreviewInput,
): string[] => {
  const start = Number.isFinite(input.start) ? Number(input.start) : 1;
  const digits = Number.isFinite(input.digits) ? Math.min(10, Math.max(1, Math.trunc(Number(input.digits)))) : 2;
  const separator = input.separator ?? '-';
  const value = input.value ?? '';

  return filenames.map((filename, index) => {
    const { base, ext } = splitName(filename);
    switch (input.mode) {
      case 'prefix':
        return withExt(`${value}${base}`, ext);
      case 'suffix':
        return withExt(`${base}${value}`, ext);
      case 'replace': {
        const find = input.find ?? '';
        if (!find) return filename;
        return withExt(base.split(find).join(input.replace ?? ''), ext);
      }
      case 'sequence': {
        const stem = value || base;
        const padded = String(start + index).padStart(digits, '0');
        return withExt(`${stem}${separator}${padded}`, ext);
      }
      case 'numbering': {
        const existing = splitFilenameNumber(base);
        const action = input.number_action ?? 'remove';
        if (action === 'remove') return withExt(existing.stem, ext);
        const number = action === 'renumber'
          ? String(start + index).padStart(digits, '0')
          : existing.number;
        if (!number) return filename;
        const stem = action === 'renumber' && value ? value : existing.stem;
        return withExt(input.number_position === 'start'
          ? `${number}${separator}${stem}`
          : `${stem}${separator}${number}`, ext);
      }
      default:
        return filename;
    }
  }).map(sanitizeMediaFilename);
};
