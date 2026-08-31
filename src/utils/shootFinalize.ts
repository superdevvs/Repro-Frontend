import { ShootData } from '@/types/shoots';

const NO_MEDIA_FINALISE_STATUSES = ['scheduled', 'on_hold', 'uploaded', 'editing', 'ready'];
const LEGACY_FAST_FORWARD_STATUSES = ['scheduled', 'on_hold'];
const NORMAL_FINALISE_STATUSES = ['uploaded', 'editing', 'ready'];

const normalizeStatus = (shoot: ShootData | null | undefined): string => {
  const raw = String(
    shoot?.workflowStatus ??
      (shoot as { workflow_status?: string } | null | undefined)?.workflow_status ??
      shoot?.status ??
      '',
  )
    .toLowerCase()
    .trim();
  if (raw === 'booked') return 'scheduled';
  if (raw === 'completed') return 'uploaded';
  return raw;
};

const readRawMediaCount = (shoot: ShootData | null | undefined): number =>
  Number(
    shoot?.rawPhotoCount ??
      (shoot as { raw_photo_count?: number } | null | undefined)?.raw_photo_count ??
      shoot?.mediaSummary?.rawUploaded ??
      0,
  );

const readEditedMediaCount = (shoot: ShootData | null | undefined): number =>
  Number(
    shoot?.editedPhotoCount ??
      (shoot as { edited_photo_count?: number } | null | undefined)?.edited_photo_count ??
      shoot?.mediaSummary?.editedUploaded ??
      0,
  );

const hasKnownUploadedFile = (shoot: ShootData | null | undefined): boolean =>
  Boolean(shoot?.files?.length);

const hasCompletedFile = (shoot: ShootData | null | undefined): boolean =>
  Boolean(
    shoot?.files?.some((file) =>
      ['completed', 'verified'].includes(
        String(file.workflowStage ?? file.workflow_stage ?? '').toLowerCase(),
      ),
    ),
  );

const readNoMediaCapability = (
  shoot: ShootData | null | undefined,
): boolean | undefined => {
  const capability = shoot?.canFinalizeNoMedia ?? shoot?.can_finalize_no_media;
  return typeof capability === 'boolean' ? capability : undefined;
};

/**
 * Whether finalizing this shoot uses the explicit whole-shoot no-media path.
 * New API payloads own the decision through a role-specific capability. The
 * scheduled/on-hold fallback keeps rolling deployments compatible with an
 * older backend that did not advertise the field yet.
 */
export const isFastForwardFinalise = (shoot: ShootData | null | undefined): boolean => {
  if (!shoot) return false;
  const status = normalizeStatus(shoot);
  if (!NO_MEDIA_FINALISE_STATUSES.includes(status)) return false;

  const hasNoMedia =
    readRawMediaCount(shoot) === 0 &&
    readEditedMediaCount(shoot) === 0 &&
    !hasKnownUploadedFile(shoot);
  if (!hasNoMedia) return false;

  const capability = readNoMediaCapability(shoot);
  if (typeof capability === 'boolean') return capability;

  return LEGACY_FAST_FORWARD_STATUSES.includes(status);
};

/** Whether a finalise action should be offered for this shoot. */
export const canFinaliseShoot = (shoot: ShootData | null | undefined): boolean => {
  if (!shoot) return false;
  if (isFastForwardFinalise(shoot)) return true;

  const status = normalizeStatus(shoot);
  const hasEditedMedia = readEditedMediaCount(shoot) > 0 || hasCompletedFile(shoot);
  return NORMAL_FINALISE_STATUSES.includes(status) && hasEditedMedia;
};

/**
 * Build the request body for POST /api/shoots/{id}/finalize. Sends
 * `allow_no_media_delivery: true` only when the server capability authorizes
 * the explicit whole-shoot no-media path.
 */
export const buildFinalizeRequestBody = (
  shoot: ShootData | null | undefined,
  finalStatus: string = 'admin_verified',
): Record<string, unknown> => {
  const body: Record<string, unknown> = { final_status: finalStatus };
  if (isFastForwardFinalise(shoot)) {
    body.allow_no_media_delivery = true;
  }
  return body;
};
