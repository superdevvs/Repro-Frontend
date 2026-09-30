import type { MediaFile } from '@/hooks/useShootFiles';
import { getMediaFilenameBase } from './filenameValidation';

export interface PostRenameSuccess {
  fileId: string;
  previousFilename: string;
  nextFilename: string;
}

export interface PostRenameBatchPlan {
  find: string;
  replace: string;
  /** Other selected files (excluding the one just renamed). */
  selectedFileIds: string[];
  /** Other files in the current view (excluding the one just renamed). */
  allFileIds: string[];
  /** Subset of selectedFileIds whose basename still contains `find`. */
  matchingSelectedFileIds: string[];
  /** Subset of allFileIds whose basename still contains `find`. */
  matchingAllFileIds: string[];
}

const basenameOf = (file: Pick<MediaFile, 'filename'>): string =>
  getMediaFilenameBase(String(file.filename || ''));

/**
 * Derive the smallest find→replace that turns oldBase into newBase by stripping
 * a shared prefix and suffix (e.g. DSC_001 → Kitchen_001 ⇒ DSC → Kitchen).
 */
export const diffBasenameForBatchReplace = (
  oldBase: string,
  newBase: string,
): { find: string; replace: string } | null => {
  const previous = String(oldBase || '');
  const next = String(newBase || '');
  if (!previous || previous === next) {
    return null;
  }

  let prefix = 0;
  const maxPrefix = Math.min(previous.length, next.length);
  while (prefix < maxPrefix && previous[prefix] === next[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  const maxSuffix = Math.min(previous.length - prefix, next.length - prefix);
  while (
    suffix < maxSuffix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const find = previous.slice(prefix, previous.length - suffix);
  const replace = next.slice(prefix, next.length - suffix);

  // Pure insertion/deletion at the edges — fall back to full-base replace.
  if (!find) {
    return { find: previous, replace: next };
  }

  return { find, replace };
};

/**
 * After a successful single rename, ALWAYS return a plan object so the follow-up
 * dialog can open. Do not gate on selection count, sibling basename containing
 * the find token, or a non-null basename diff — empty id arrays and empty
 * find/replace are fine (apply buttons stay disabled; "Just this file" works).
 */
export const buildPostRenameBatchPlan = (
  success: PostRenameSuccess,
  selectedFiles: MediaFile[],
  viewFiles: MediaFile[],
): PostRenameBatchPlan => {
  const diff = diffBasenameForBatchReplace(
    getMediaFilenameBase(success.previousFilename),
    getMediaFilenameBase(success.nextFilename),
  );
  const find = diff?.find ?? '';
  const replace = diff?.replace ?? '';
  const renamedId = String(success.fileId);

  const otherIds = (files: MediaFile[]) =>
    files
      .filter((file) => String(file.id) !== renamedId)
      .map((file) => String(file.id));

  const matchingIds = (files: MediaFile[]) => {
    if (!find) return [] as string[];
    return files
      .filter((file) => String(file.id) !== renamedId)
      .filter((file) => basenameOf(file).includes(find))
      .map((file) => String(file.id));
  };

  return {
    find,
    replace,
    selectedFileIds: otherIds(selectedFiles),
    allFileIds: otherIds(viewFiles),
    matchingSelectedFileIds: matchingIds(selectedFiles),
    matchingAllFileIds: matchingIds(viewFiles),
  };
};
