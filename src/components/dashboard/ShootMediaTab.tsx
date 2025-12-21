import React from 'react';
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, File as FileIcon, Check, ArrowRight } from "lucide-react";
import { ShootData } from '@/types/shoots';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';

interface ShootMediaTabProps {
  shoot: ShootData;
  isPhotographer: boolean;
}

export function ShootMediaTab({ shoot, isPhotographer: _isPhotographer }: ShootMediaTabProps) {
  const { toast } = useToast();
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const files = Array.isArray((shoot as any).files) ? (shoot as any).files : [] as any[];

  const rawFiles = files.filter((f:any) => (
    f?.workflowStage === 'todo' ||
    (f?.path || '').toLowerCase().includes('todo') ||
    (f?.dropboxPath || '').toLowerCase().includes('/todo')
  ));
  const editedFiles = files.filter((f:any) => (
    f?.workflowStage === 'completed' ||
    f?.workflowStage === 'verified' ||
    (f?.path || '').toLowerCase().includes('completed') ||
    (f?.dropboxPath || '').toLowerCase().includes('/completed')
  ));

  const token = (typeof window !== 'undefined') ? (localStorage.getItem('authToken') || localStorage.getItem('token')) : null;
  const baseUrl = API_BASE_URL;

  const isImageFile = (f:any) => {
    if (f?.isImage) return true;
    const t = (f?.fileType || f?.mime || '').toString().toLowerCase();
    if (t.startsWith('image/')) return true;
    const name = (f?.filename || f?.storedFilename || '').toLowerCase();
    return /(\.jpg|\.jpeg|\.png|\.gif|\.bmp|\.tiff|\.tif|\.heic|\.heif)$/.test(name);
  };

  const buildDisplayUrl = (f:any): string | null => {
    const u = f?.url;
    if (typeof u === 'string' && u.length > 0) {
      if (/^https?:\/\//i.test(u)) return u;
      if (u.startsWith('/')) return `${baseUrl}${u}`;
    }
    const p = f?.path;
    if (typeof p === 'string' && p.length > 0) {
      const clean = p.replace(/^\/+/, '');
      const rel = clean.startsWith('storage/') ? clean : `storage/${clean}`;
      return `${baseUrl}/${rel}`;
    }
    return null;
  };

  const postAction = async (fileId: string, action: 'verify' | 'move') => {
    try {
      const url = action === 'verify'
        ? `${API_BASE_URL}/api/shoots/${shoot.id}/files/${fileId}/verify`
        : `${API_BASE_URL}/api/shoots/${shoot.id}/files/${fileId}/move-to-completed`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error('Action failed');
      toast({ title: action === 'verify' ? 'File verified' : 'Moved to Completed' });
    } catch (e:any) {
      toast({ title: 'Error', description: e?.message || 'Operation failed', variant: 'destructive' });
    }
  };

  const renderFile = (f:any) => {
    const isImg = isImageFile(f);
    const displayUrl = buildDisplayUrl(f);
    return (
      <div key={f.id} className="border rounded-md p-2 flex items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {isImg && displayUrl ? (
            <a href={displayUrl} target="_blank" rel="noreferrer" className="flex-shrink-0">
              <img src={displayUrl} alt={f.filename || 'Preview'} className="h-36 w-48 object-cover rounded" />
            </a>
          ) : (
            <div className="h-12 w-12 flex items-center justify-center bg-muted rounded">
              <FileIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium" title={f.filename || f.storedFilename}>{f.filename || f.storedFilename}</div>
            {f.formattedSize && <div className="text-xs text-muted-foreground">{f.formattedSize}</div>}
            {!isImg && displayUrl && (
              <a className="text-xs underline" href={displayUrl} target="_blank" rel="noreferrer">Open</a>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {isAdmin && (
            <>
              <Button variant="ghost" size="icon" onClick={() => postAction(f.id, 'verify')} title="Verify">
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => postAction(f.id, 'move')} title="Move to Completed">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-2">Raw Uploads (ToDo)</h3>
        {rawFiles.length === 0 ? (
          <div className="text-sm text-muted-foreground">No raw files uploaded yet.</div>
        ) : (
          <div className="space-y-2">
            {rawFiles.map(renderFile)}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Edited Uploads (Completed)</h3>
        {editedFiles.length === 0 ? (
          <div className="text-sm text-muted-foreground">No edited files uploaded yet.</div>
        ) : (
          <div className="space-y-2">
            {editedFiles.map(renderFile)}
          </div>
        )}
      </div>
    </div>
  );
}
