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
  /** Other selected files that still contain `find` in the basename. */
  selectedFileIds: string[];
  /** Other files in the current view that still contain `find` in the basename. */
  allFileIds: string[];
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
 * After a successful single rename, derive a find→replace batch plan so the user
 * can apply the same basename change to other selected files or the whole view.
 */
export const buildPostRenameBatchPlan = (
  success: PostRenameSuccess,
  selectedFiles: MediaFile[],
  viewFiles: MediaFile[],
): PostRenameBatchPlan | null => {
  const diff = diffBasenameForBatchReplace(
    getMediaFilenameBase(success.previousFilename),
    getMediaFilenameBase(success.nextFilename),
  );
  if (!diff) {
    return null;
  }

  const { find, replace } = diff;

  const eligibleIds = (files: MediaFile[]) =>
    files
      .filter((file) => String(file.id) !== String(success.fileId))
      .filter((file) => basenameOf(file).includes(find))
      .map((file) => String(file.id));

  const selectedFileIds = eligibleIds(selectedFiles);
  const allFileIds = eligibleIds(viewFiles);

  if (selectedFileIds.length === 0 && allFileIds.length === 0) {
    return null;
  }

  return { find, replace, selectedFileIds, allFileIds };
};
