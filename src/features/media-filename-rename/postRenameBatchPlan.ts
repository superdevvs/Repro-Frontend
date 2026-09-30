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
 * After a successful single rename, always offer a batch follow-up when any other
 * file exists in the current selection or view. Eligibility is NOT gated on
 * siblings containing the derived find token — that made unique renames skip the
 * dialog entirely. Matching subsets are still tracked so apply can prefer files
 * that will actually change under replace mode.
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
  const renamedId = String(success.fileId);

  const otherIds = (files: MediaFile[]) =>
    files
      .filter((file) => String(file.id) !== renamedId)
      .map((file) => String(file.id));

  const matchingIds = (files: MediaFile[]) =>
    files
      .filter((file) => String(file.id) !== renamedId)
      .filter((file) => basenameOf(file).includes(find))
      .map((file) => String(file.id));

  const selectedFileIds = otherIds(selectedFiles);
  const allFileIds = otherIds(viewFiles);
  const matchingSelectedFileIds = matchingIds(selectedFiles);
  const matchingAllFileIds = matchingIds(viewFiles);

  // Always prompt when at least one other file exists in selection or view.
  if (selectedFileIds.length === 0 && allFileIds.length === 0) {
    return null;
  }

  return {
    find,
    replace,
    selectedFileIds,
    allFileIds,
    matchingSelectedFileIds,
    matchingAllFileIds,
  };
};
