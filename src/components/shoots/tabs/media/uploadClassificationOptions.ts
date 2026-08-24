/**
 * Media-type classification vocabulary, upload constants and the per-file
 * classification options rendered by the upload panels.
 *
 * Extracted verbatim from `mediaUploadUtils.ts` to keep that module under the
 * repository file-size limit. `mediaUploadUtils` re-exports every symbol here,
 * so existing import paths and the public API are unchanged.
 */

export type UploadQueueMediaType =
  | 'floorplan'
  | 'extra'
  | 'virtual_staging'
  | 'green_grass'
  | 'twilight'
  | 'drone';

export type QueueClassificationMap = Record<string, UploadQueueMediaType | undefined>;

export type UploadClassificationOption = {
  type: UploadQueueMediaType;
  label: string;
  title: string;
  activeClassName: string;
  inactiveClassName: string;
  photoOnly?: boolean;
};

export const FULL_UPLOAD_ACCEPT = 'image/*,video/*,application/pdf,.pdf,.raw,.cr2,.cr3,.nef,.nrw,.arw,.srf,.sr2,.dng,.raf,.orf,.pef,.rw2,.srw,.3fr,.fff,.iiq,.rwl,.x3f,.erf,.kdc,.mef,.mos,.mrw,.bay,.bmq,.cap,.cine,.dc2,.dcr,.drf,.eip,.gpr,.mdc,.mdf,.mrw,.obm,.ptx,.pxn,.r3d,.rdc,.rmf';

export const TRACKED_MEDIA_TYPES: UploadQueueMediaType[] = [
  'extra',
  'virtual_staging',
  'green_grass',
  'twilight',
  'drone',
  'floorplan',
];

export const DEFAULT_UPLOAD_LIMITS = {
  perFileBytes: 2000 * 1024 * 1024,
  totalRequestBytes: 2200 * 1024 * 1024,
  perFileLabel: '2GB',
  totalRequestLabel: '2.2GB',
} as const;

export const UPLOAD_CLASSIFICATION_OPTIONS: UploadClassificationOption[] = [
  {
    type: 'floorplan',
    label: 'FP',
    title: 'Floorplan',
    activeClassName: 'bg-blue-600 text-white',
    inactiveClassName: 'bg-muted text-muted-foreground hover:bg-muted/80',
    photoOnly: true,
  },
  {
    type: 'virtual_staging',
    label: 'VS',
    title: 'Virtual Staging',
    activeClassName: 'bg-violet-600 text-white',
    inactiveClassName: 'bg-muted text-muted-foreground hover:bg-muted/80',
    photoOnly: true,
  },
  {
    type: 'green_grass',
    label: 'GG',
    title: 'Green Grass',
    activeClassName: 'bg-emerald-600 text-white',
    inactiveClassName: 'bg-muted text-muted-foreground hover:bg-muted/80',
    photoOnly: true,
  },
  {
    type: 'twilight',
    label: 'TW',
    title: 'Twilight',
    activeClassName: 'bg-indigo-600 text-white',
    inactiveClassName: 'bg-muted text-muted-foreground hover:bg-muted/80',
    photoOnly: true,
  },
  {
    type: 'drone',
    label: 'DR',
    title: 'Drone',
    activeClassName: 'bg-sky-600 text-white',
    inactiveClassName: 'bg-muted text-muted-foreground hover:bg-muted/80',
  },
  {
    type: 'extra',
    label: 'EX',
    title: 'Extra',
    activeClassName: 'bg-amber-500 text-white',
    inactiveClassName: 'bg-muted text-muted-foreground hover:bg-muted/80',
  },
];

/**
 * The only per-file control raw staging offers.
 *
 * Everything else on that row used to be a media-type shortcut — Floor Plan,
 * Virtual Staging, Green Grass, Twilight, Drone — which duplicated the booked-service
 * grouping model and was offered even when the shoot had never booked those services.
 * Ownership is the group's booked service; treatments are applied to existing media
 * afterwards through the reclassify action. Extra survives because it is genuinely a
 * per-file exception: one unplanned frame inside an otherwise planned batch, and it is
 * a property of the file rather than a service that was sold.
 */
export const RAW_STAGING_CLASSIFICATION_OPTIONS: UploadClassificationOption[] =
  UPLOAD_CLASSIFICATION_OPTIONS.filter((option) => option.type === 'extra');

export const MEDIA_TYPE_CARD_LABELS: Record<UploadQueueMediaType, string> = {
  extra: 'EX',
  virtual_staging: 'VS',
  green_grass: 'GG',
  twilight: 'TW',
  drone: 'DR',
  floorplan: 'FP',
};

export const MEDIA_TYPE_SUMMARY_LABELS: Record<UploadQueueMediaType, string> = {
  extra: 'Extra',
  virtual_staging: 'Virtual Staging',
  green_grass: 'Green Grass',
  twilight: 'Twilight',
  drone: 'Drone',
  floorplan: 'Floorplan',
};
