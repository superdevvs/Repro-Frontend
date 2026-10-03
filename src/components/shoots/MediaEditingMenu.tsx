import { MoreHorizontal } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import type { MediaFile } from '@/hooks/useShootFiles';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { sendShootToEditing } from '@/services/shootEditingDispatch';
import { openMediaVersions } from '@/services/mediaVersions';
import { isImageFile, isPreviewableImage } from './tabs/media/mediaViewerFileTypes';
import { isRawFile } from '@/services/rawPreviewService';
import { triggerShootDetailRefresh } from '@/realtime/realtimeRefreshBus';
import { apiClient } from '@/services/api';
import { studioError } from '@/services/studioWorkspaceService';
import { useState } from 'react';

export function MediaEditingMenu({ file, shootId, beforeOpen, className }: { file: MediaFile; shootId?: string | number; beforeOpen?: () => void; className?: string }) {
  const { role } = useAuth();
  const { toast } = useToast();
  const [helperAvailable, setHelperAvailable] = useState(false);
  const id = shootId ?? file.shoot_id;
  if (!id || !['admin', 'superadmin', 'editing_manager'].includes(role ?? '') || file.is_hidden || (!isImageFile(file) && !isPreviewableImage(file) && !isRawFile(file.filename))) return null;
  const edited = ['completed', 'verified'].includes(file.workflowStage ?? '') || file.media_type === 'edited' || file.is_ai_edited;
  return <DropdownMenu onOpenChange={open => { if (open && edited) void apiClient.get<{ data: { available: boolean } }>('/desktop-editing').then(({ data }) => setHelperAvailable(data.data.available)).catch(() => setHelperAvailable(false)); }}><DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" className={className} aria-label={`Editing actions for ${file.filename}`} onClick={event => event.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent className="z-[220]" onClick={event => event.stopPropagation()}>
      <DropdownMenuItem onSelect={() => { beforeOpen?.(); void sendShootToEditing(id, [Number(file.id)]).then(sent => { if (sent) triggerShootDetailRefresh(String(id)); }).catch(error => toast({ title: 'Editing request failed', description: error.message, variant: 'destructive' })); }}>Send to editing…</DropdownMenuItem>
      {edited && <DropdownMenuItem onSelect={() => { beforeOpen?.(); openMediaVersions({ shootId: id, fileId: file.id, name: file.filename }); }}>Versions / upload saved edit…</DropdownMenuItem>}
      {edited && <DropdownMenuItem onSelect={() => {
        void apiClient.get<{ data: { available: boolean } }>('/desktop-editing').then(async ({ data }) => {
          if (!data.data.available) { beforeOpen?.(); window.location.assign('/settings?tab=desktop-editing'); return; }
          const history = await apiClient.get<{ current_version: number }>(`/shoots/${id}/files/${file.id}/versions`);
          const response = await apiClient.post<{ data: { launch_url: string } }>(`/shoots/${id}/files/${file.id}/desktop-session`, { expected_version: history.data.current_version });
          window.location.assign(response.data.data.launch_url);
        }).catch(error => toast({ title: 'Photoshop could not open', description: studioError(error), variant: 'destructive' }));
      }}>{helperAvailable ? 'Open in Photoshop…' : 'Photoshop setup / manual editing…'}</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
