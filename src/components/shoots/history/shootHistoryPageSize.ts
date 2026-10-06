/** Live Shoot History list/grid default — hardcoded as per_page: 12 before this control. */
export const DEFAULT_SHOOT_HISTORY_PAGE_SIZE = 12 as const

export const SHOOT_HISTORY_PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const

export type ShootHistoryPageSize = (typeof SHOOT_HISTORY_PAGE_SIZE_OPTIONS)[number]

/** localStorage key scoped per account (matches clientDeliveredShootTracker / onboarding fallback). */
export const shootHistoryPageSizeStorageKey = (userId: string | number | null | undefined) =>
  userId != null && String(userId).length > 0
    ? `shoot-history-page-size:${String(userId)}`
    : 'shoot-history-page-size:anonymous'

/**
 * Profile preference key for a future BE sync via PUT /api/profile
 * `{ preferences: { shootHistoryPageSize } }`. Not written yet — avoid relying on
 * an unverified preference allowlist; FE account-scoped storage is the source of truth.
 */
export const SHOOT_HISTORY_PAGE_SIZE_PREF_KEY = 'shootHistoryPageSize'

export function isShootHistoryPageSize(value: unknown): value is ShootHistoryPageSize {
  const numeric = typeof value === 'string' ? Number(value) : value
  return (
    typeof numeric === 'number' &&
    Number.isFinite(numeric) &&
    (SHOOT_HISTORY_PAGE_SIZE_OPTIONS as readonly number[]).includes(numeric)
  )
}

export function readShootHistoryPageSize(
  userId: string | number | null | undefined,
): ShootHistoryPageSize {
  if (typeof window === 'undefined') return DEFAULT_SHOOT_HISTORY_PAGE_SIZE
  try {
    const raw = window.localStorage.getItem(shootHistoryPageSizeStorageKey(userId))
    if (raw != null && isShootHistoryPageSize(raw)) return Number(raw) as ShootHistoryPageSize
  } catch {
    // private mode / quota
  }
  return DEFAULT_SHOOT_HISTORY_PAGE_SIZE
}

export function writeShootHistoryPageSize(
  userId: string | number | null | undefined,
  size: ShootHistoryPageSize,
) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(shootHistoryPageSizeStorageKey(userId), String(size))
  } catch {
    // Ignore storage failures; keep the in-memory selection.
  }
}
