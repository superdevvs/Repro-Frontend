/**
 * Upload intake capability and lane resolution.
 *
 * Extracted verbatim from `mediaUploadUtils.ts` to keep that module under the
 * repository file-size limit. `mediaUploadUtils` re-exports every symbol here,
 * so existing import paths and the public API are unchanged.
 */

/**
 * Which upload lane a catalogue service declares it can receive, from
 * `services.upload_intake_type`. This is capability data: a commercial catalogue
 * entry is not automatically an upload target.
 */
export type UploadIntakeType = 'photo' | 'video' | 'photo_video' | 'none';

/** The raw intake lanes the product has. */
export type UploadLane = 'photo' | 'video';

export const UPLOAD_LANE_PHOTO: UploadLane = 'photo';
export const UPLOAD_LANE_VIDEO: UploadLane = 'video';

const UPLOAD_INTAKE_TYPES: readonly UploadIntakeType[] = ['photo', 'video', 'photo_video', 'none'];

/**
 * Read a declared capability, defaulting to `none`.
 *
 * Unknown means "not selectable", never "probably photo". The resolver this
 * replaced treated anything whose name did not match /video/ as photo-like, which
 * is precisely how fees, floor plans, virtual staging and 3D tour products became
 * raw upload targets.
 */
export const readUploadIntakeType = (value: unknown): UploadIntakeType => {
  const candidate = String(value ?? '').trim().toLowerCase();
  return (UPLOAD_INTAKE_TYPES as readonly string[]).includes(candidate)
    ? (candidate as UploadIntakeType)
    : 'none';
};

export const intakeTypeSupportsLane = (intakeType: UploadIntakeType, lane: UploadLane): boolean => {
  if (intakeType === 'photo_video') return true;
  return intakeType === lane;
};

/** The lane a file belongs to, from its MIME type only. Never from its name. */
export const resolveUploadLaneForFile = (file: { type?: string | null }): UploadLane =>
  String(file?.type ?? '').toLowerCase().startsWith('video/')
    ? UPLOAD_LANE_VIDEO
    : UPLOAD_LANE_PHOTO;

/** Distinct lanes represented in a set of staged files. Empty input means photo. */
export const resolveUploadLanesForFiles = (files: Array<{ type?: string | null }>): UploadLane[] => {
  const lanes = new Set<UploadLane>();
  files.forEach((file) => lanes.add(resolveUploadLaneForFile(file)));
  return lanes.size === 0 ? [UPLOAD_LANE_PHOTO] : Array.from(lanes);
};
