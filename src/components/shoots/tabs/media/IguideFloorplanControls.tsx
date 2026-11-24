import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { parseCanonicalUploadResponse } from './mediaUploadUtils';
import { uploadMediaRequest } from './uploadMediaRequest';

export interface IguideFloorplanOperations {
  targets: { id: string; name: string; tourStatus?: string; manualCount: number }[];
  linked: boolean;
  providerLinkSaved: boolean;
  imported: number;
  expected: number;
}

export function IguideFloorplanControls({
  operations, shootId, onShootUpdate,
}: {
  operations: IguideFloorplanOperations;
  shootId: string | number;
  onShootUpdate: () => void;
}) {
  const queryClient = useQueryClient();
  const picker = useRef<HTMLInputElement>(null);
  const refreshShoot = useRef(onShootUpdate);
  const [selectedId, setSelectedId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ success: number; errors: string[] } | null>(null);
  const target = operations.targets.length === 1
    ? operations.targets[0]
    : operations.targets.find(item => item.id === selectedId);
  const awaitingImport = (operations.providerLinkSaved && !operations.linked) || operations.expected > operations.imported;

  useEffect(() => {
    refreshShoot.current = onShootUpdate;
  }, [onShootUpdate]);

  useEffect(() => {
    if (!awaitingImport) return;
    let attempts = 0;
    const refresh = window.setInterval(() => {
      refreshShoot.current();
      void queryClient.invalidateQueries({ queryKey: ['shootFiles', shootId] });
      if (++attempts >= 12) window.clearInterval(refresh);
    }, 5000);
    return () => window.clearInterval(refresh);
  }, [awaitingImport, queryClient, shootId]);

  async function addFiles(files: File[]) {
    if (!target || !files.length || uploading) return;
    setUploading(true);
    setFeedback(null);
    const result = { success: 0, errors: [] as string[] };
    try {
      const headers = getApiHeaders();
      for (const file of files) {
        if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) {
          result.errors.push(file.name + ': Choose a PDF, PNG or JPG.');
          continue;
        }
        try {
          const body = new FormData();
          body.append('files[]', file);
          body.append('upload_type', 'edited');
          body.append('media_type', 'floorplan');
          body.append('shoot_service_id', target.id);
          body.append('idempotency_key', crypto.randomUUID());
          const response = await uploadMediaRequest({
            url: API_BASE_URL + '/api/shoots/' + shootId + '/upload',
            body,
            headers: { Accept: 'application/json', Authorization: headers.Authorization,
              'X-Impersonate-User-Id': headers['X-Impersonate-User-Id'] },
            onProgress: () => {},
          });
          if (response.ok === false) throw new Error(response.message);
          const uploaded = parseCanonicalUploadResponse(response.responseText);
          if (uploaded.successCount > 0) {
            result.success++;
          } else {
            result.errors.push(file.name + ': ' + String(uploaded.errors[0]?.message ?? uploaded.message ?? 'The file could not be saved.'));
          }
        } catch (error) {
          result.errors.push(file.name + ': ' + (error instanceof Error ? error.message : 'Upload failed.'));
        }
      }
    } finally {
      setUploading(false);
      setFeedback(result);
      if (result.success > 0) {
        refreshShoot.current();
        void queryClient.invalidateQueries({ queryKey: ['shootFiles', shootId] });
      }
    }
  }

  const deliveryLabel = target?.tourStatus === 'delivered' ? 'Released to client'
    : target?.tourStatus === 'ready' ? 'Ready to release'
      : operations.linked ? 'Tour pending release review' : null;

  return (
    <section className="space-y-3 rounded-md border p-3" aria-label="iGuide sync and floor plans">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={operations.linked ? 'secondary' : 'outline'}>
          {operations.linked ? 'Synced' : operations.providerLinkSaved ? 'Link saved · awaiting sync' : 'iGuide not linked'}
        </Badge>
        {deliveryLabel && <Badge variant="outline">{deliveryLabel}</Badge>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {operations.expected > 0
            ? operations.imported + ' of ' + operations.expected + ' provider floor plans imported'
            : operations.imported + ' provider floor plans imported'}
          {target && target.manualCount > 0 ? ' · ' + target.manualCount + ' added manually' : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {operations.targets.length > 1 && (
            <select aria-label="Floor plan service" className="h-9 rounded-md border bg-background px-2 text-sm"
              value={selectedId} onChange={event => setSelectedId(event.target.value)} disabled={uploading}>
              <option value="">Choose service</option>
              {operations.targets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
          <input ref={picker} type="file" aria-label="Floor plan files" hidden multiple accept=".pdf,.png,.jpg,.jpeg"
            onChange={event => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = '';
              void addFiles(files);
            }}
          />
          <Button type="button" size="sm" variant="outline" disabled={!target || uploading} onClick={() => picker.current?.click()}>
            <Upload className="mr-1.5 size-4" />
            {uploading ? 'Uploading floor plans…' : 'Add floor plans'}
          </Button>
        </div>
      </div>
      {!operations.linked && <p className="text-xs text-muted-foreground">
        Save the correct iGuide URL in Tour to sync. Use Sync iGuide there to retry a saved link.
      </p>}
      {feedback && <div className="space-y-1 text-sm" role="status">
        {feedback.success > 0 && <p>{feedback.success} floor plan {feedback.success === 1 ? 'file' : 'files'} accepted.</p>}
        {feedback.errors.map((error, index) => <p key={index} className="text-destructive">{error}</p>)}
      </div>}
    </section>
  );
}
