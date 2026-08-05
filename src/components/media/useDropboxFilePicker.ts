import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Dropbox } from 'dropbox';

import { API_BASE_URL } from '@/config/env';
import { useToast } from '@/hooks/use-toast';

export interface DropboxPickerFile {
  id: string;
  name: string;
  size: number;
  path_display: string;
  client_modified: string;
  content_hash?: string;
}

interface DropboxAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  isConnecting: boolean;
}

interface DropboxPickerOptions {
  active: boolean;
  onFilesAdded: (files: File[]) => void;
  onDisconnect: () => void;
}

const supportedExtensions = new Set([
  'jpg', 'jpeg', 'png', 'tiff', 'tif', 'mp4', 'mov', 'avi', 'zip', 'rar',
]);

const getMimeType = (filename: string): string => {
  const extension = filename.toLowerCase().split('.').pop() || '';
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    cr3: 'image/x-canon-cr3',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
  };
  return mimeTypes[extension] || 'application/octet-stream';
};

const isDropboxFile = (entry: unknown): entry is DropboxPickerFile & { '.tag': 'file' } => {
  if (!entry || typeof entry !== 'object') return false;
  const record = entry as Record<string, unknown>;
  return record['.tag'] === 'file'
    && typeof record.id === 'string'
    && typeof record.name === 'string'
    && typeof record.size === 'number'
    && typeof record.path_display === 'string'
    && typeof record.client_modified === 'string';
};

const readAuthMessage = (data: unknown) => {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (record.type === 'DROPBOX_AUTH_SUCCESS' && typeof record.accessToken === 'string') {
    return { type: 'success' as const, accessToken: record.accessToken };
  }
  if (record.type === 'DROPBOX_AUTH_ERROR') return { type: 'error' as const };
  return null;
};

export function useDropboxFilePicker({ active, onFilesAdded, onDisconnect }: DropboxPickerOptions) {
  const { toast } = useToast();
  const [auth, setAuth] = useState<DropboxAuthState>({
    isAuthenticated: false,
    accessToken: localStorage.getItem('dropbox_access_token'),
    isConnecting: false,
  });
  const [files, setFiles] = useState<DropboxPickerFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loadingFiles, setLoadingFiles] = useState(false);

  const client = useMemo(
    () => auth.accessToken ? new Dropbox({ accessToken: auth.accessToken, fetch }) : null,
    [auth.accessToken],
  );

  const loadFiles = useCallback(async () => {
    if (!client) return;
    setLoadingFiles(true);
    try {
      const response = await client.filesListFolder({
        path: '',
        recursive: true,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
      });
      const supported = (response.result.entries as unknown[])
        .filter(isDropboxFile)
        .filter((file) => supportedExtensions.has(file.name.toLowerCase().split('.').pop() || ''))
        .map(({ id, name, size, path_display, client_modified, content_hash }) => ({
          id,
          name,
          size,
          path_display,
          client_modified,
          content_hash,
        }));
      setFiles(supported);
    } catch (error) {
      console.error('Error loading Dropbox files:', error);
      toast({
        title: 'Error Loading Files',
        description: 'Failed to load files from Dropbox. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingFiles(false);
    }
  }, [client, toast]);

  const connect = useCallback(async () => {
    setAuth((current) => ({ ...current, isConnecting: true }));
    try {
      let appKey = import.meta.env.VITE_APP_DROPBOX_APP_KEY as string | undefined;
      if (!appKey) {
        try {
          const response = await axios.get<{ success?: boolean; config?: { client_id?: string } }>(
            `${API_BASE_URL}/api/dropbox/config`,
          );
          appKey = response.data.success ? response.data.config?.client_id : undefined;
        } catch (error) {
          console.warn('Failed to fetch Dropbox config from backend, using fallback:', error);
        }
      }
      appKey ||= 'wzdzujsjj1iaaiv';
      if (appKey === 'your_dropbox_app_key') throw new Error('Dropbox Client ID is not configured.');

      const redirectUri = `${window.location.origin}/dropbox-callback`;
      const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
      const popup = window.open(authUrl, 'dropbox-auth', 'width=600,height=700,scrollbars=yes,resizable=yes');

      const handleCallback = (event: MessageEvent<unknown>) => {
        if (event.origin !== window.location.origin) return;
        const message = readAuthMessage(event.data);
        if (!message) return;
        if (message.type === 'success') {
          localStorage.setItem('dropbox_access_token', message.accessToken);
          setAuth({ isAuthenticated: true, accessToken: message.accessToken, isConnecting: false });
          popup?.close();
          toast({ title: 'Dropbox Connected', description: 'Successfully connected to Dropbox. Loading your files...' });
        } else {
          setAuth((current) => ({ ...current, isConnecting: false }));
          toast({ title: 'Connection Failed', description: 'Failed to connect to Dropbox. Please try again.', variant: 'destructive' });
          popup?.close();
        }
        window.removeEventListener('message', handleCallback);
      };

      window.addEventListener('message', handleCallback);
      const checkClosed = window.setInterval(() => {
        if (!popup?.closed) return;
        window.clearInterval(checkClosed);
        window.removeEventListener('message', handleCallback);
        setAuth((current) => ({ ...current, isConnecting: false }));
      }, 1000);
    } catch (error) {
      console.error('Dropbox connection error:', error);
      setAuth((current) => ({ ...current, isConnecting: false }));
      toast({ title: 'Connection Error', description: 'An error occurred while connecting to Dropbox.', variant: 'destructive' });
    }
  }, [toast]);

  const toggleFile = useCallback((fileId: string) => {
    setSelectedFiles((current) => {
      const next = new Set(current);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedFiles((current) => current.size === files.length
      ? new Set()
      : new Set(files.map((file) => file.id)));
  }, [files]);

  const addSelectedFiles = useCallback(async () => {
    if (!client || selectedFiles.size === 0) return;
    const downloads: File[] = [];
    try {
      for (const file of files.filter((item) => selectedFiles.has(item.id))) {
        toast({ title: 'Downloading', description: `Downloading ${file.name} from Dropbox...` });
        const response = await client.filesDownload({ path: file.path_display });
        const result = response.result as unknown as { fileBlob?: Blob; fileBinary?: BlobPart };
        const contents = result.fileBlob ?? result.fileBinary;
        if (!contents) throw new Error(`Dropbox returned no file data for ${file.name}`);
        downloads.push(new File([contents], file.name, {
          type: getMimeType(file.name),
          lastModified: new Date(file.client_modified).getTime(),
        }));
      }
      onFilesAdded(downloads);
      setSelectedFiles(new Set());
      toast({ title: 'Files Added', description: `${downloads.length} files downloaded from Dropbox and added to upload queue.` });
    } catch (error) {
      console.error('Error downloading Dropbox files:', error);
      toast({ title: 'Download Error', description: 'Failed to download some files from Dropbox.', variant: 'destructive' });
    }
  }, [client, files, onFilesAdded, selectedFiles, toast]);

  const disconnect = useCallback(() => {
    localStorage.removeItem('dropbox_access_token');
    setAuth({ isAuthenticated: false, accessToken: null, isConnecting: false });
    setFiles([]);
    setSelectedFiles(new Set());
    onDisconnect();
    toast({ title: 'Disconnected', description: 'Successfully disconnected from Dropbox.' });
  }, [onDisconnect, toast]);

  useEffect(() => {
    if (active && auth.isAuthenticated && client && files.length === 0) void loadFiles();
  }, [active, auth.isAuthenticated, client, files.length, loadFiles]);

  useEffect(() => {
    if (auth.accessToken && !auth.isAuthenticated) {
      setAuth((current) => ({ ...current, isAuthenticated: true }));
    }
  }, [auth.accessToken, auth.isAuthenticated]);

  return {
    auth,
    files,
    selectedFiles,
    loadingFiles,
    connect,
    loadFiles,
    toggleFile,
    selectAll,
    addSelectedFiles,
    disconnect,
  };
}
