export interface MediaVersionRequest { shootId: string | number; fileId: string | number; name: string }
export interface MediaVersion {
  id: string; status: string; version?: number; filename?: string; expected_version: number;
  error?: string; error_code?: string; preview_url?: string; published_file_id?: number; created_at: string;
  can_dismiss?: boolean;
}
let handler: ((request: MediaVersionRequest) => void) | null = null;
export const registerMediaVersions = (next: typeof handler) => { handler = next; return () => { if (handler === next) handler = null; }; };
export const openMediaVersions = (request: MediaVersionRequest) => handler?.(request);
