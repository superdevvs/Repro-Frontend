import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useRescanFile } from '@/hooks/useRescanFile';
import { useToast } from '@/hooks/use-toast';
import type { MediaFile } from '@/hooks/useShootFiles';
import { apiClient } from '@/services/api';
import { isRawFile } from '@/services/rawPreviewService';

import { ScanStatusBadge } from './ScanStatusBadge';

interface ShootFileScanStatusRendererOptions {
  shootId: string | number | undefined;
  canViewScanStatus: boolean;
  isSuperadmin: boolean;
}

export function useShootFileScanStatusRenderer({
  shootId,
  canViewScanStatus,
  isSuperadmin,
}: ShootFileScanStatusRendererOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const rescanFile = useRescanFile();
  const [rebuildingPreviewFileId, setRebuildingPreviewFileId] = useState<string | null>(null);

  const handleRescan = useCallback((fileId: string) => {
    if (!shootId) return;
    rescanFile.mutate(
      { shootId, fileId },
      {
        onSuccess: () => toast({
          title: 'Scan re-enqueued',
          description: 'The file is being re-scanned.',
        }),
        onError: (error) => {
          const description = error?.response?.status === 409
            ? 'Only files whose scan failed can be re-scanned.'
            : (error?.response?.data?.message
              ?? 'Could not retry the scan. Please try again.');
          toast({ title: 'Could not retry scan', description, variant: 'destructive' });
        },
      },
    );
  }, [rescanFile, shootId, toast]);

  const handlePreviewRebuild = useCallback(async (fileId: string) => {
    if (!shootId || rebuildingPreviewFileId) return;
    setRebuildingPreviewFileId(fileId);
    try {
      await apiClient.post(`/shoots/${shootId}/files/${fileId}/rebuild-preview`);
      toast({
        title: 'Preview rebuild queued',
        description: 'The RAW thumbnail will refresh when processing finishes.',
      });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shootId, 'raw'] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', shootId, 'all'] });
    } catch (error) {
      const apiMessage = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast({
        title: 'Could not rebuild preview',
        description: apiMessage || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRebuildingPreviewFileId(null);
    }
  }, [queryClient, rebuildingPreviewFileId, shootId, toast]);

  const rescanningFileId = (rescanFile.isPending && rescanFile.variables)
    ? String(rescanFile.variables.fileId)
    : null;

  return useMemo(() => {
    if (!canViewScanStatus) return undefined;

    return (file: MediaFile) => {
      const status = file.scan_status ?? file.scanStatus ?? null;
      if (!status) return null;

      const rawPreviewUnavailable = status === 'clean'
        && isRawFile(file.filename)
        && (!file.thumbnail_path || !file.web_path)
        && Boolean(file.processing_failed_at || file.processed_at);
      const fileId = String(file.id);

      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <ScanStatusBadge
            status={status}
            onRetry={() => handleRescan(fileId)}
            isRetrying={rescanningFileId === fileId}
            size="sm"
          />
          {isSuperadmin && rawPreviewUnavailable && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground"
              disabled={rebuildingPreviewFileId === fileId}
              onClick={(event) => {
                event.stopPropagation();
                void handlePreviewRebuild(fileId);
              }}
            >
              {rebuildingPreviewFileId === fileId
                ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                : <RefreshCw className="h-3 w-3" aria-hidden="true" />}
              Rebuild preview
            </Button>
          )}
        </div>
      );
    };
  }, [
    canViewScanStatus,
    handlePreviewRebuild,
    handleRescan,
    isSuperadmin,
    rebuildingPreviewFileId,
    rescanningFileId,
  ]);
}
