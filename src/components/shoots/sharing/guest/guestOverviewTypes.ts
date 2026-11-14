export type GuestFile = {
  id: number;
  name: string;
  kind: string;
  preview_url: string;
  download_url: string;
  mls_download_url?: string | null;
  thumbnail_url?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  width?: number | null;
  height?: number | null;
};

export type GuestTour = { label: string; url: string; kind?: 'property' | 'video' | '3d'; provider?: string; file_id?: number };
export type GuestRequest = (suffix: string, body?: object) => Promise<unknown>;
export class GuestRequestError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'GuestRequestError'; }
}

export const isGuestImage = (file: GuestFile) => file.kind === 'photo'
  || file.mime_type?.startsWith('image/') === true || /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name);

export function guestFileSize(bytes?: number | null) {
  if (!bytes || bytes < 0) return '—';
  const unit = bytes >= 1024 ** 3 ? 'GB' : bytes >= 1024 ** 2 ? 'MB' : 'KB';
  const divisor = unit === 'GB' ? 1024 ** 3 : unit === 'MB' ? 1024 ** 2 : 1024;
  return `${(bytes / divisor).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`;
}

export type GuestOverview = {
  property: {
    address: string; city: string; state: string; zip: string;
    beds: number | null; baths: number | null; sqft: number | null;
  };
  services: Array<{ name: string; components: Array<{ label: string; status: string }> }>;
  files: GuestFile[];
  tours: GuestTour[];
  expires_at: string;
};
