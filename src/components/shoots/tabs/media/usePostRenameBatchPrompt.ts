import { useCallback, useMemo, useState } from 'react';
import type { MediaFile } from '@/hooks/useShootFiles';
import { MEDIA_BATCH_RENAME_API_ENABLED } from '@/features/media-filename-rename/featureFlag';
import {
  buildPostRenameBatchPlan,
  type PostRenameSuccess,
} from '@/features/media-filename-rename/postRenameBatchPlan';
import type { BatchRenameMode } from '@/services/shootMediaService';

type RenameHandler = (fileId: string, filename: string) => void | Promise<unknown>;
type BatchRenameHandler = (payload: {
  mode: BatchRenameMode;
  value?: string;
  find?: string;
  replace?: string;
  start?: number;
  digits?: number;
  separator?: string;
  fileIds?: string[];
}) => Promise<void> | void;

interface UsePostRenameBatchPromptParams {
  enabled: boolean;
  selectedFiles: MediaFile[];
  viewFiles: MediaFile[];
  handleRenameFilename: RenameHandler;
  handleBatchRenameFilenames: BatchRenameHandler;
}

export function usePostRenameBatchPrompt({
  enabled,
  selectedFiles,
  viewFiles,
  handleRenameFilename,
  handleBatchRenameFilenames,
}: UsePostRenameBatchPromptParams) {
  const [prompt, setPrompt] = useState<PostRenameSuccess | null>(null);

  const plan = useMemo(
    () => (prompt ? buildPostRenameBatchPlan(prompt, selectedFiles, viewFiles) : null),
    [prompt, selectedFiles, viewFiles],
  );

  const onRenameFilename = useCallback(
    async (fileId: string, filename: string) => {
      const result = await handleRenameFilename(fileId, filename);
      if (
        enabled &&
        MEDIA_BATCH_RENAME_API_ENABLED &&
        result &&
        typeof result === 'object' &&
        'ok' in result &&
        result.ok === true
      ) {
        const success = result as PostRenameSuccess & { ok: true };
        const nextPlan = buildPostRenameBatchPlan(success, selectedFiles, viewFiles);
        if (nextPlan) {
          setPrompt({
            fileId: success.fileId,
            previousFilename: success.previousFilename,
            nextFilename: success.nextFilename,
          });
        }
      }
      return result;
    },
    [enabled, handleRenameFilename, selectedFiles, viewFiles],
  );

  const clearPrompt = useCallback(() => setPrompt(null), []);

  const applySelected = useCallback(async () => {
    if (!plan?.selectedFileIds.length) return;
    // Prefer files that contain the find token so replace actually changes names;
    // fall back to the full selected scope when none match (still honors the button).
    const fileIds =
      plan.matchingSelectedFileIds.length > 0
        ? plan.matchingSelectedFileIds
        : plan.selectedFileIds;
    await handleBatchRenameFilenames({
      mode: 'replace',
      find: plan.find,
      replace: plan.replace,
      fileIds,
    });
  }, [handleBatchRenameFilenames, plan]);

  const applyAll = useCallback(async () => {
    if (!plan?.allFileIds.length) return;
    const fileIds =
      plan.matchingAllFileIds.length > 0
        ? plan.matchingAllFileIds
        : plan.allFileIds;
    await handleBatchRenameFilenames({
      mode: 'replace',
      find: plan.find,
      replace: plan.replace,
      fileIds,
    });
  }, [handleBatchRenameFilenames, plan]);

  return {
    prompt: plan ? prompt : null,
    plan,
    onRenameFilename,
    clearPrompt,
    applySelected,
    applyAll,
  };
}
