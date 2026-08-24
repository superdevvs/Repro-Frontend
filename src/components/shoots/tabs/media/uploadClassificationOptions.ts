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
 * Post-capture treatments asked for on one individual frame.
 *
 * These travel in their own `treatment` field, never in `media_type`. A frame marked
 * for virtual staging is still a raw of its booked service: it keeps its
 * `shoot_service_id`, it keeps `media_type='raw'`, and so it stays inside its
 * service's bracket stacks, in the Photos tab and in delivery. Writing them into
 * `media_type` — which is a single scalar — is what previously knocked a treated
 * frame out of all three.
 */
export const UPLOAD_TREATMENTS = ['virtual_staging', 'green_grass', 'twilight'] as const;

export type UploadTreatment = (typeof UPLOAD_TREATMENTS)[number];

/** Whether a staged classification is a treatment rather than a media type. */
export const isUploadTreatment = (value: UploadQueueMediaType): value is UploadTreatment =>
  (UPLOAD_TREATMENTS as readonly string[]).includes(value);

/**
 * The upload fields one staged classification contributes.
 *
 * The split is the whole point: a treatment must land in `treatment` and leave
 * `media_type` alone, because `media_type` carries the capture identity that bracket
 * stacking, the Photos tab and delivery all key on. Extra is the opposite case — it
 * genuinely changes what the file is, so it stays a media type and keeps its
 * `is_extra` flag.
 */
export const resolveClassificationUploadFields = (
  value: UploadQueueMediaType | undefined,
): Record<string, string> => {
  if (!value) return {};

  if (isUploadTreatment(value)) {
    return { treatment: value };
  }

  return value === 'extra'
    ? { media_type: value, is_extra: '1' }
    : { media_type: value };
};

/**
 * The per-file controls raw staging offers: VS / GG / TW / EX.
 *
 * Floor Plan and Drone are deliberately absent. Those are capture/service
 * classifications, and they belong to the booked service-group system — a drone frame
 * is owned by the Drone execution row, not by a per-file button that would compete
 * with that ownership. The three treatments and Extra are genuinely properties of an
 * individual image: a treatment is work requested on that frame, and Extra is one
 * unplanned frame inside an otherwise planned batch.
 */
export const RAW_STAGING_CLASSIFICATION_OPTIONS: UploadClassificationOption[] =
  UPLOAD_CLASSIFICATION_OPTIONS.filter(
    (option) => option.type !== 'floorplan' && option.type !== 'drone',
  );

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
