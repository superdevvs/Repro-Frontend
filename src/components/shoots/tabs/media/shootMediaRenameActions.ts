import type { MediaFile } from '@/hooks/useShootFiles';
import { getApiHeaders } from '@/services/api';
import { batchRenameShootMediaFiles, renameShootMediaFile, type BatchRenameMode } from '@/services/shootMediaService';
import { MEDIA_BATCH_RENAME_API_ENABLED, MEDIA_FILENAME_RENAME_API_ENABLED } from '@/features/media-filename-rename/featureFlag';
import { validateMediaFilenameInput } from '@/features/media-filename-rename/filenameValidation';
import type { UseShootMediaActionsParams } from './shootMediaActionTypes';

type RenameActionParams = Pick<UseShootMediaActionsParams,
  'shoot' | 'rawFiles' | 'editedFiles' | 'selectedFiles' | 'setSelectedFiles'
  | 'setRawFiles' | 'setEditedFiles' | 'queryClient' | 'onShootUpdate' | 'toast'
> & {
  updateSingleFile: (fileId: string, updater: (file: MediaFile) => MediaFile) => void;
};

export function createShootMediaRenameActions({
  shoot, rawFiles, editedFiles, selectedFiles, setSelectedFiles,
  setRawFiles, setEditedFiles, queryClient, onShootUpdate, toast, updateSingleFile,
}: RenameActionParams) {
  const handleRenameFilename = async (fileId: string, nextFilename: string) => {
    if (!MEDIA_FILENAME_RENAME_API_ENABLED) {
      toast({
        title: 'Rename not available yet',
        description: 'Filename rename will unlock after the server update is live.',
        variant: 'destructive',
      });
      return { ok: false as const };
    }

    const targetFile = [...rawFiles, ...editedFiles].find((file) => file.id === fileId);
    if (!targetFile) {
      return { ok: false as const };
    }

    const previousFilename = String(targetFile.filename || '').trim();
    const validation = validateMediaFilenameInput(nextFilename, previousFilename);
    if (validation.ok === false) {
      toast({
        title: 'Invalid filename',
        description: validation.message,
        variant: 'destructive',
      });
      return { ok: false as const };
    }

    const mediaQueries = { predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] === 'shootFiles' && String(query.queryKey[1]) === String(shoot.id) };
    await queryClient.cancelQueries(mediaQueries);
    const previousFile = targetFile;
    updateSingleFile(fileId, (file) => ({
      ...file,
      filename: validation.filename,
    }));

    try {
      const headers = getApiHeaders();
      const response = await renameShootMediaFile(shoot.id, fileId, validation.filename, headers);
      const renamed = response?.data;
      const confirmedFilename = String(renamed?.filename || validation.filename).trim() || validation.filename;
      const confirmedStored = renamed?.stored_filename != null
        ? String(renamed.stored_filename)
        : confirmedFilename;

      // Display name is saved `filename`; keep storage key separate when the server returns it.
      updateSingleFile(fileId, (file) => ({
        ...file,
        filename: confirmedFilename,
        stored_filename: confirmedStored,
        media_revision: Number.isFinite(Number(response?.media_revision))
          ? Number(response.media_revision)
          : file.media_revision,
      }));

      queryClient.setQueriesData<MediaFile[]>(mediaQueries, (files) => files?.map((file) =>
        String(file.id) === String(fileId) ? { ...file, filename: confirmedFilename, stored_filename: confirmedStored } : file,
      ));
      // Refetch is source of truth for revision bumps — avoid stale optimistic revert.
      await queryClient.invalidateQueries(mediaQueries);
      onShootUpdate();

      toast({
        title: 'Filename updated',
        description: confirmedFilename,
      });
      return {
        ok: true as const,
        fileId: String(fileId),
        previousFilename,
        nextFilename: confirmedFilename,
      };
    } catch (error: unknown) {
      updateSingleFile(fileId, () => previousFile);
      const axiosMessage =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast({
        title: 'Rename failed',
        description:
          axiosMessage ||
          (error instanceof Error ? error.message : 'Failed to rename file'),
        variant: 'destructive',
      });
      return { ok: false as const };
    }
  };


  const handleBatchRenameFilenames = async (payload: {
    mode: BatchRenameMode;
    value?: string;
    find?: string;
    replace?: string;
    start?: number;
    digits?: number;
    separator?: string;
    number_action?: 'remove' | 'move' | 'renumber';
    number_position?: 'start' | 'end';
    fileIds?: string[];
  }) => {
    if (!MEDIA_BATCH_RENAME_API_ENABLED) {
      toast({
        title: 'Batch rename not available yet',
        description: 'Batch rename will unlock after the server update is live.',
        variant: 'destructive',
      });
      return;
    }

    const fileIds = payload.fileIds?.length ? payload.fileIds.map(String) : Array.from(selectedFiles);
    if (fileIds.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Select one or more files to rename.',
        variant: 'destructive',
      });
      return;
    }

    if (payload.mode === 'replace' && !String(payload.find || '').trim()) {
      toast({
        title: 'Find text required',
        description: 'Replace mode needs a non-empty find value.',
        variant: 'destructive',
      });
      return;
    }

    const previousRawFiles = rawFiles;
    const previousEditedFiles = editedFiles;
    let failureAlreadyToasted = false;

    const formatFailedPerId = (
      items: Array<{ id?: string | number; file_id?: string | number; message?: string; error?: string }>,
    ) =>
      items
        .map((item) => {
          const id = item.id ?? item.file_id;
          const reason = String(item.message || item.error || 'failed').trim();
          return id != null ? `#${id}: ${reason}` : reason;
        })
        .filter(Boolean)
        .slice(0, 5)
        .join('; ');

    try {
      const headers = getApiHeaders();
      const response = await batchRenameShootMediaFiles(
        shoot.id,
        {
          file_ids: fileIds.map((id) => parseInt(id, 10)),
          mode: payload.mode,
          value: payload.value,
          find: payload.find,
          replace: payload.replace,
          start: payload.start,
          digits: payload.digits,
          separator: payload.separator,
          number_action: payload.number_action,
          number_position: payload.number_position,
        },
        headers,
      );

      const updated = Array.isArray(response?.data?.updated) ? response.data.updated : [];
      const failed = Array.isArray(response?.data?.failed) ? response.data.failed : [];

      // BE returns 422 when nothing updated; also guard empty-200 responses.
      if (updated.length === 0) {
        const detail = formatFailedPerId(failed) || 'No files were renamed.';
        failureAlreadyToasted = true;
        toast({
          title: 'Batch rename failed',
          description: detail,
          variant: 'destructive',
        });
        throw new Error(detail);
      }

      const filenameById = new Map(
        updated.map((item) => [String(item.id), String(item.filename || '').trim()]),
      );
      const storedById = new Map(
        updated.map((item) => [
          String(item.id),
          item.stored_filename != null ? String(item.stored_filename) : String(item.filename || '').trim(),
        ]),
      );

      const applyUpdates = (files: MediaFile[]) =>
        files.map((file) => {
          const nextName = filenameById.get(String(file.id));
          if (!nextName) return file;
          return {
            ...file,
            filename: nextName,
            stored_filename: storedById.get(String(file.id)) ?? nextName,
          };
        });

      setRawFiles((prev) => applyUpdates(prev));
      setEditedFiles((prev) => applyUpdates(prev));

      // Same matching as single rename: cached keys may hold the shoot id as a number or a string.
      const mediaQueries = { predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] === 'shootFiles' && String(query.queryKey[1]) === String(shoot.id) };
      queryClient.setQueriesData<MediaFile[]>(mediaQueries, (files) => (Array.isArray(files) ? applyUpdates(files) : files));
      await queryClient.invalidateQueries(mediaQueries);
      onShootUpdate();

      if (failed.length === 0) {
        toast({
          title: 'Files renamed',
          description: `Updated ${updated.length} file${updated.length === 1 ? '' : 's'}.`,
        });
      } else {
        const perId = formatFailedPerId(failed);
        const extra = failed.length > 5 ? ` (+${failed.length - 5} more)` : '';
        toast({
          title: 'Batch rename partial',
          description: `Updated ${updated.length}, failed ${failed.length}${perId ? `: ${perId}${extra}` : '.'}`,
        });
      }

      setSelectedFiles(new Set());
    } catch (error: unknown) {
      setRawFiles(previousRawFiles);
      setEditedFiles(previousEditedFiles);
      const axiosData =
        error && typeof error === 'object' && 'response' in error
          ? (error as {
              response?: {
                data?: {
                  message?: string;
                  data?: {
                    failed?: Array<{
                      id?: string | number;
                      file_id?: string | number;
                      message?: string;
                      error?: string;
                    }>;
                  };
                };
              };
            }).response?.data
          : undefined;
      const failedDetail = Array.isArray(axiosData?.data?.failed)
        ? formatFailedPerId(axiosData.data.failed)
        : undefined;
      const description =
        failedDetail ||
        axiosData?.message ||
        (error instanceof Error ? error.message : 'Failed to rename selected files');
      if (!failureAlreadyToasted) {
        toast({
          title: 'Batch rename failed',
          description,
          variant: 'destructive',
        });
      }
      // Re-throw so BatchRenameDialog stays open on 422 / hard failure.
      throw error instanceof Error ? error : new Error(description);
    }
  };

  return { handleRenameFilename, handleBatchRenameFilenames };
}
