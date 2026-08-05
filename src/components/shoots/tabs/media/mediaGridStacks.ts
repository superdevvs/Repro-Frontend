import type { MediaFile } from '@/hooks/useShootFiles';
import { isRawFile } from '@/services/rawPreviewService';

export interface MediaStack {
  id: string;
  files: MediaFile[];
  // First file encountered in input order (i.e. respects the user's chosen sort).
  // `files` may be reordered (e.g. by sequence for hover rotation), but the cover
  // tile must keep following the active sort so the dropdown visibly works.
  coverFile: MediaFile;
  expectedSize: number;
}


const MAX_CAPTURED_TIME_STACK_SIZE = 7;
const CAPTURED_BRACKET_GAP_SECONDS = 15;
const FILENAME_OUTER_GAP_SECONDS = 120;
const MAX_FILENAME_SEQUENCE_STACK_SIZE = 7;

interface BuildMediaStacksOptions {
  shouldStackRawFiles: boolean;
  normalizedRawStackSize: number | null;
  isVideo?: (file: MediaFile) => boolean;
}

export function buildMediaStacks(
  stackFiles: MediaFile[],
  {
    shouldStackRawFiles,
    normalizedRawStackSize,
    isVideo,
  }: BuildMediaStacksOptions,
): MediaStack[] {
  const parseCapturedSecond = (value?: string) => {
    if (!value) {
      return null;
    }
  
    const normalizedValue = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    const timestamp = Date.parse(normalizedValue);
  
    return Number.isNaN(timestamp) ? null : Math.floor(timestamp / 1000);
  };
  
  const parseFilenameParts = (filename: string): { prefix: string; sequence: number } | null => {
    const nameWithoutExtension = (filename || '').replace(/\.[^.]+$/, '');
    const match = /^(.*?)(\d+)(?!.*\d)/.exec(nameWithoutExtension);
    if (!match) {
      return null;
    }
    const sequence = Number(match[2]);
    if (!Number.isFinite(sequence)) {
      return null;
    }
    return { prefix: match[1] ?? '', sequence };
  };
  
  const getPositiveNumber = (value: unknown) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
  };
  
  const getStackOrderSecond = (file: MediaFile) =>
    parseCapturedSecond(file.captured_at) ?? parseCapturedSecond(file.created_at);
  
  const compareRawStackingOrder = (left: MediaFile, right: MediaFile) => {
    const leftTime = getStackOrderSecond(left);
    const rightTime = getStackOrderSecond(right);
    if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
  
    const leftFilenameParts = parseFilenameParts(left.filename);
    const rightFilenameParts = parseFilenameParts(right.filename);
    if (leftFilenameParts && rightFilenameParts) {
      const prefixCompare = leftFilenameParts.prefix.localeCompare(rightFilenameParts.prefix, undefined, { numeric: true });
      if (prefixCompare !== 0) {
        return prefixCompare;
      }
  
      if (leftFilenameParts.sequence !== rightFilenameParts.sequence) {
        return leftFilenameParts.sequence - rightFilenameParts.sequence;
      }
    }
  
    return (left.filename || '').localeCompare(right.filename || '', undefined, { numeric: true });
  };
  
  const compareStackMembers = (left: MediaFile, right: MediaFile) => {
    const leftSequence = getPositiveNumber(left.sequence);
    const rightSequence = getPositiveNumber(right.sequence);
    if (leftSequence !== null && rightSequence !== null && leftSequence !== rightSequence) {
      return leftSequence - rightSequence;
    }
  
    return compareRawStackingOrder(left, right);
  };
  
  const isRawStackCandidate = (file: MediaFile) =>
    !file.isExtra &&
    !isVideo?.(file) &&
    ((file.media_type || '').toLowerCase() === 'raw' || isRawFile(file.filename));
  
  const buildStacks = (stackFiles: MediaFile[]): MediaStack[] => {
    if (!shouldStackRawFiles) {
      return stackFiles.map((file) => ({ id: file.id, files: [file], coverFile: file, expectedSize: 1 }));
    }
  
    const normalizeStack = (stack: MediaStack): MediaStack[] => {
      if (stack.files.length <= 1) {
        return [{ ...stack, expectedSize: 1 }];
      }
  
      return [{
        ...stack,
        expectedSize: stack.files.length > 1 ? Math.max(stack.expectedSize, stack.files.length) : 1,
      }];
    };
  
    const stacks: MediaStack[] = [];
    let currentStack: MediaStack | null = null;
  
    const rawCandidates = stackFiles.filter(isRawStackCandidate);
    const rawCandidatesWithGroup = rawCandidates.filter((file) => getPositiveNumber(file.bracket_group) !== null);
  
    if (normalizedRawStackSize || rawCandidatesWithGroup.length > 0) {
      const rawStackByFileId = new Map<string, MediaStack>();
      const bracketGroups = new Map<number, MediaFile[]>();
      const ungroupedRawFiles: MediaFile[] = [];
  
      rawCandidates.forEach((file) => {
        const bracketGroup = getPositiveNumber(file.bracket_group);
        if (bracketGroup !== null) {
          const groupFiles = bracketGroups.get(bracketGroup) ?? [];
          groupFiles.push(file);
          bracketGroups.set(bracketGroup, groupFiles);
          return;
        }
  
        ungroupedRawFiles.push(file);
      });
  
      const getCoverFile = (groupFiles: MediaFile[]) =>
        groupFiles.reduce((currentCover, candidate) => {
          const currentIndex = stackFiles.findIndex((file) => file.id === currentCover.id);
          const candidateIndex = stackFiles.findIndex((file) => file.id === candidate.id);
          return candidateIndex >= 0 && (currentIndex < 0 || candidateIndex < currentIndex)
            ? candidate
            : currentCover;
        }, groupFiles[0]);
  
      const registerStack = (id: string, groupFiles: MediaFile[], expectedSize: number) => {
        if (groupFiles.length === 0) {
          return;
        }
  
        const stack: MediaStack = {
          id,
          files: [...groupFiles].sort(compareStackMembers),
          coverFile: getCoverFile(groupFiles),
          expectedSize,
        };
  
        stack.files.forEach((file) => rawStackByFileId.set(file.id, stack));
      };
  
      const bracketStackLimit = normalizedRawStackSize ?? Number.POSITIVE_INFINITY;
      bracketGroups.forEach((groupFiles, bracketGroup) => {
        const orderedGroupFiles = [...groupFiles].sort(compareStackMembers);
        for (let startIndex = 0; startIndex < orderedGroupFiles.length; startIndex += bracketStackLimit) {
          const stackFilesChunk = orderedGroupFiles.slice(startIndex, startIndex + bracketStackLimit);
          registerStack(
            `bracket-${bracketGroup}:${Math.floor(startIndex / bracketStackLimit)}`,
            stackFilesChunk,
            normalizedRawStackSize ?? stackFilesChunk.length,
          );
        }
      });
  
      if (normalizedRawStackSize) {
        const orderedRawFiles = [...ungroupedRawFiles].sort(compareRawStackingOrder);
        for (let startIndex = 0; startIndex < orderedRawFiles.length; startIndex += normalizedRawStackSize) {
          const stackFilesChunk = orderedRawFiles.slice(startIndex, startIndex + normalizedRawStackSize);
          registerStack(
            `raw-chunk:${startIndex}`,
            stackFilesChunk,
            stackFilesChunk.length > 1 ? normalizedRawStackSize : 1,
          );
        }
      }
  
      const emittedStackIds = new Set<string>();
      const orderedStacks: MediaStack[] = [];
      stackFiles.forEach((file) => {
        const rawStack = rawStackByFileId.get(file.id);
        if (rawStack) {
          if (!emittedStackIds.has(rawStack.id)) {
            orderedStacks.push(rawStack);
            emittedStackIds.add(rawStack.id);
          }
          return;
        }
  
        orderedStacks.push({ id: file.id, files: [file], coverFile: file, expectedSize: 1 });
      });
  
      return orderedStacks.flatMap(normalizeStack);
    }
  
    const bracketStacksByKey = new Map<string, MediaStack>();
  
    stackFiles.forEach((file) => {
      if (!isRawStackCandidate(file)) {
        currentStack = null;
        stacks.push({ id: file.id, files: [file], coverFile: file, expectedSize: 1 });
        return;
      }
  
      const bracketGroup =
        file.bracket_group === null || file.bracket_group === undefined
          ? null
          : Number(file.bracket_group);
      const capturedSecond = parseCapturedSecond(file.captured_at);
      const filenameParts = parseFilenameParts(file.filename);
      const baseKey = typeof bracketGroup === 'number' && Number.isFinite(bracketGroup) && bracketGroup > 0
        ? `bracket-${bracketGroup}`
        : null;
      const bracketStackLimit = normalizedRawStackSize ?? Number.POSITIVE_INFINITY;
  
      if (baseKey) {
        const existingBracketStack = bracketStacksByKey.get(baseKey);
        if (existingBracketStack && existingBracketStack.files.length < bracketStackLimit) {
          existingBracketStack.files.push(file);
          existingBracketStack.expectedSize =
            normalizedRawStackSize ?? existingBracketStack.files.length;
          currentStack = existingBracketStack;
          return;
        }
  
        const newBracketStack: MediaStack = {
          id: `${baseKey}:${stacks.length}`,
          files: [file],
          coverFile: file,
          expectedSize: normalizedRawStackSize ?? 1,
        };
        bracketStacksByKey.set(baseKey, newBracketStack);
        stacks.push(newBracketStack);
        currentStack = newBracketStack;
        return;
      }
  
      // Combined time + filename grouping for non-bracket-tagged files.
      const previousFile = currentStack?.files[currentStack.files.length - 1];
      const previousCapturedSecond = parseCapturedSecond(previousFile?.captured_at);
      const previousFilenameParts = previousFile ? parseFilenameParts(previousFile.filename) : null;
      const burstStackLimit =
        normalizedRawStackSize ?? Math.max(MAX_CAPTURED_TIME_STACK_SIZE, MAX_FILENAME_SEQUENCE_STACK_SIZE);
      const isBurstStack = currentStack?.id.startsWith('burst:') ?? false;
  
      const timeDelta =
        capturedSecond !== null && previousCapturedSecond !== null
          ? Math.abs(capturedSecond - previousCapturedSecond)
          : null;
      const isTimeClose = timeDelta !== null && timeDelta <= CAPTURED_BRACKET_GAP_SECONDS;
      const isTimeWithinOuterBound = timeDelta === null || timeDelta <= FILENAME_OUTER_GAP_SECONDS;
  
      const filenameDelta =
        filenameParts !== null && previousFilenameParts !== null
          ? Math.abs(filenameParts.sequence - previousFilenameParts.sequence)
          : null;
      const isFilenameConsecutive =
        filenameParts !== null &&
        previousFilenameParts !== null &&
        filenameParts.prefix === previousFilenameParts.prefix &&
        filenameDelta === 1;
      const isFilenameContradictory =
        filenameParts !== null &&
        previousFilenameParts !== null &&
        (filenameParts.prefix !== previousFilenameParts.prefix ||
          (filenameDelta !== null && filenameDelta !== 1));
  
      // Merge into the current burst stack when:
      //   - time is close AND filename isn't contradictory, OR
      //   - filename is consecutive AND time is within outer bound (covers minute-boundary / slow saves).
      const shouldContinue =
        isBurstStack &&
        currentStack !== null &&
        currentStack.files.length < burstStackLimit &&
        ((isTimeClose && !isFilenameContradictory) ||
          (isFilenameConsecutive && isTimeWithinOuterBound));
  
      if (shouldContinue && currentStack) {
        currentStack.files.push(file);
        currentStack.expectedSize = normalizedRawStackSize ?? currentStack.files.length;
        return;
      }
  
      // Start a new burst candidate stack when we at least have a time or filename signal.
      if (capturedSecond !== null || filenameParts !== null) {
        currentStack = {
          id: `burst:${stacks.length}`,
          files: [file],
          coverFile: file,
          expectedSize: normalizedRawStackSize ?? 1,
        };
        stacks.push(currentStack);
        return;
      }
  
      currentStack = null;
      stacks.push({ id: file.id, files: [file], coverFile: file, expectedSize: 1 });
    });
  
    // Keep `files` in insertion order (which already matches the user's sort),
    // so the cover tile AND the hover-rotation both follow the active sort.
  
    return stacks.flatMap(normalizeStack);
  };
  

  return buildStacks(stackFiles);
}

