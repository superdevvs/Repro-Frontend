/**
 * Environment resolution for the photographer onboarding QA harness.
 *
 * Centralizes the documented environment variables (Requirement 1.4), the notification-sink
 * variables (Requirements 1.5, 17.1), the managed-server toggle (Requirement 1.6), and the
 * confirmation-gate / seeded-address flags. Values and defaults match `frontend/e2e/README.md`
 * and `playwright.config.ts` EXACTLY so behavior is unchanged from the existing suite.
 *
 * This module only RESOLVES configuration — it does not change the managed-server branch logic
 * in `playwright.config.ts` (which keys off `E2E_NO_SERVER` / `E2E_BASE_URL`). The `noServer`
 * field here mirrors that toggle for harness code that needs to know the same fact.
 *
 * See design.md "Components and Interfaces → 1. Environment resolution (`env.ts`)".
 */

/** Default Dashboard base URL — matches `playwright.config.ts` and README. */
const DEFAULT_BASE_URL = 'http://localhost:5173';

export type NotificationMode = 'log' | 'live';
export type VoiceMode = 'disabled' | 'live';

export interface QaEnv {
  baseUrl: string; // E2E_BASE_URL ?? http://localhost:5173
  apiBaseUrl: string; // E2E_API_BASE_URL ?? E2E_BASE_URL ?? default
  noServer: boolean; // E2E_NO_SERVER === '1'
  adminEmail: string; // E2E_ADMIN_EMAIL
  adminPassword: string; // E2E_ADMIN_PASSWORD
  previewStorageState?: string; // E2E_PREVIEW_STORAGE_STATE
  runId: string; // E2E_QA_RUN_ID ?? timestamp
  externalBookingApiKey?: string; // E2E_EXTERNAL_BOOKING_API_KEY

  // Notification sink (Req 1.5, 17.1)
  notificationMode: NotificationMode; // E2E_NOTIFICATION_MODE ?? 'log'
  emailMode: NotificationMode; // E2E_EMAIL_MODE ?? 'log'
  smsMode: NotificationMode; // E2E_SMS_MODE ?? 'log'
  voiceMode: VoiceMode; // E2E_VOICE_MODE ?? 'disabled'

  // Confirmation gate allow-flags (Req 2), default declined → read-only
  confirmDestructive: boolean; // E2E_CONFIRM_DESTRUCTIVE === '1'
  confirmCharge: boolean; // E2E_CONFIRM_CHARGE === '1'
  confirmMessage: boolean; // E2E_CONFIRM_MESSAGE === '1'

  // Optional category-scoped confirm + seeded-address pin
  confirmCategories?: string[]; // E2E_CONFIRM_CATEGORIES (comma list)
  seededAddressSet?: string; // E2E_SEEDED_ADDRESS_SET (fixture id)
}

/**
 * Generate the default run id: a compact UTC timestamp (YYYYMMDDHHMMSS), matching the fallback
 * used by `qa-acceptance.e2e.ts` so QA-created names/emails/addresses stay consistent across the
 * suite when `E2E_QA_RUN_ID` is not supplied.
 */
function defaultRunId(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

/**
 * Read an optional env var, treating empty/blank strings as "unset" so an exported-but-empty
 * variable does not override a documented default.
 */
function optional(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Resolve a notification channel mode, defaulting to 'log' for any unset/unrecognized value. */
function notificationMode(value: string | undefined): NotificationMode {
  return optional(value)?.toLowerCase() === 'live' ? 'live' : 'log';
}

/** Resolve the voice mode, defaulting to 'disabled' for any unset/unrecognized value. */
function voiceMode(value: string | undefined): VoiceMode {
  return optional(value)?.toLowerCase() === 'live' ? 'live' : 'disabled';
}

/** A flag is enabled only when explicitly set to the string '1' (read-only by default). */
function flag(value: string | undefined): boolean {
  return value === '1';
}

/** Parse a comma-separated category list, returning undefined when no categories are provided. */
function categories(value: string | undefined): string[] | undefined {
  const raw = optional(value);
  if (raw === undefined) {
    return undefined;
  }
  const parsed = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return parsed.length > 0 ? parsed : undefined;
}

/**
 * Resolve the QA harness environment from `process.env`.
 *
 * `apiBaseUrl` follows the same precedence as `qa-acceptance.e2e.ts`:
 * `E2E_API_BASE_URL ?? E2E_BASE_URL ?? <default>`. The managed-server toggle (`noServer`)
 * mirrors `playwright.config.ts` (`E2E_NO_SERVER === '1'`) without altering that config's branch.
 */
export function resolveQaEnv(): QaEnv {
  const baseUrl = optional(process.env.E2E_BASE_URL) ?? DEFAULT_BASE_URL;

  return {
    baseUrl,
    apiBaseUrl:
      optional(process.env.E2E_API_BASE_URL) ??
      optional(process.env.E2E_BASE_URL) ??
      DEFAULT_BASE_URL,
    noServer: flag(process.env.E2E_NO_SERVER),
    adminEmail: optional(process.env.E2E_ADMIN_EMAIL) ?? 'admin@example.com',
    adminPassword: optional(process.env.E2E_ADMIN_PASSWORD) ?? 'password',
    previewStorageState: optional(process.env.E2E_PREVIEW_STORAGE_STATE),
    runId: optional(process.env.E2E_QA_RUN_ID) ?? defaultRunId(),
    externalBookingApiKey: optional(process.env.E2E_EXTERNAL_BOOKING_API_KEY),

    // Notification sink (Req 1.5, 17.1)
    notificationMode: notificationMode(process.env.E2E_NOTIFICATION_MODE),
    emailMode: notificationMode(process.env.E2E_EMAIL_MODE),
    smsMode: notificationMode(process.env.E2E_SMS_MODE),
    voiceMode: voiceMode(process.env.E2E_VOICE_MODE),

    // Confirmation gate allow-flags (Req 2) — default declined → read-only
    confirmDestructive: flag(process.env.E2E_CONFIRM_DESTRUCTIVE),
    confirmCharge: flag(process.env.E2E_CONFIRM_CHARGE),
    confirmMessage: flag(process.env.E2E_CONFIRM_MESSAGE),

    // Optional category-scoped confirm + seeded-address pin
    confirmCategories: categories(process.env.E2E_CONFIRM_CATEGORIES),
    seededAddressSet: optional(process.env.E2E_SEEDED_ADDRESS_SET),
  };
}
