import { ShootData } from '@/types/shoots';

/**
 * Workflow statuses from which an admin can "fast-forward" a shoot straight to
 * Delivered without any raw/edited uploads. These are the pre-upload states:
 * a booked/scheduled shoot or one currently on hold.
 */
const FAST_FORWARD_STATUSES = ['scheduled', 'booked', 'on_hold'];

const normalizeStatus = (shoot: ShootData | null | undefined): string => {
  const raw = String(shoot?.workflowStatus ?? shoot?.status ?? '')
    .toLowerCase()
    .trim();
  // Treat the legacy "booked" alias as scheduled.
  return raw === 'booked' ? 'scheduled' : raw;
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

/**
 * Whether finalizing this shoot would be a "fast-forward" / no-media delivery:
 * the shoot is still in a pre-upload state (scheduled/on hold) and has no media.
 * This is the only path that should send `allow_no_media_delivery` to the
 * backend; finalizing an uploaded/editing/ready shoot continues to require
 * edited media, so normal billable deliveries stay protected.
 */
export const isFastForwardFinalise = (shoot: ShootData | null | undefined): boolean => {
  if (!shoot) return false;
  const status = normalizeStatus(shoot);
  if (!FAST_FORWARD_STATUSES.includes(status)) return false;
  return readRawMediaCount(shoot) === 0 && readEditedMediaCount(shoot) === 0;
};

/**
 * Build the request body for POST /api/shoots/{id}/finalize. Sends
 * `allow_no_media_delivery: true` only for the explicit fast-forward (no-media)
 * path so the backend keeps enforcing media requirements for the normal
 * finalize flow.
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
