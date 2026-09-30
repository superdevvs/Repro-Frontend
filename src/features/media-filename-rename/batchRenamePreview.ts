import type { BatchRenameMode } from '@/services/shootMediaService';

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
}

/** Client-side preview of batch rename results (does not call the API). */
export const previewBatchRenameFilenames = (
  filenames: string[],
  input: BatchRenamePreviewInput,
): string[] => {
  const start = Number.isFinite(input.start) ? Number(input.start) : 1;
  const digits = Number.isFinite(input.digits) ? Math.max(1, Number(input.digits)) : 2;
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
      default:
        return filename;
    }
  });
};
