/**
 * Assigned sales_rep Overview Save may only touch schedule / service plan /
 * photographer / notify fields (AssignedRepSchedulePayload + UpdateShootAction
 * repEditableKeys). Overview still seeds client/address/property/payment echo
 * into the draft — strip those before PATCH so sameValue drift cannot 403 a
 * photographer-only change.
 */
export const ASSIGNED_REP_SHOOT_SAVE_KEYS = [
  'scheduled_date',
  'scheduled_at',
  'time',
  'services',
  'service_items',
  'photographer_id',
  'service_photographers',
  'travel_override',
  'travel_override_reason',
  'travel_override_confirmed',
  'travel_override_confirmation_version',
  'travel_location_confirmed',
  'notify_client',
  'notify_photographer',
  'confirm_service_detach',
  'service_detach_confirmation_token',
  'is_featured',
  'ghost_user_ids',
  'tour_links',
] as const;

const ASSIGNED_REP_SHOOT_SAVE_KEY_SET = new Set<string>(ASSIGNED_REP_SHOOT_SAVE_KEYS);

const SERVICE_LINE_KEYS = new Set(['id', 'service_id', 'scheduled_at', 'price', 'quantity', 'photographer_pay']);

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const slimServiceLines = (value: unknown, idKey: 'id' | 'service_id'): unknown[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.map((row) => {
    const record = asRecord(row);
    const next: Record<string, unknown> = {};
    for (const key of SERVICE_LINE_KEYS) {
      if (key === 'id' && idKey !== 'id') continue;
      if (key === 'service_id' && idKey !== 'service_id') continue;
      if (record[key] !== undefined) next[key] = record[key];
    }
    return next;
  }).filter((row) => row[idKey] !== undefined && row[idKey] !== null && row[idKey] !== '');
};

const sameScalar = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  const leftText = String(left).trim();
  const rightText = String(right).trim();
  if (leftText === rightText) return true;
  const leftNum = Number(left);
  const rightNum = Number(right);
  return Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum === rightNum;
};

const normalizeTime = (value: unknown): string => {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return text;
  return `${match[1].padStart(2, '0')}:${match[2]}:${(match[3] ?? '00').padStart(2, '0')}`;
};

const normalizeDate = (value: unknown): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toISOString().slice(0, 10);
};

/** Compare schedule stamps to the minute across floating wall-clock and ISO-Z. */
export const normalizeScheduleStamp = (value: unknown): string => {
  if (value == null || value === '') return '';
  const text = String(value).trim().replace(' ', 'T');
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const match = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    return match ? `${match[1]}T${match[2]}:${match[3]}` : text;
  }
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return text;
  return new Date(ms).toISOString().slice(0, 16);
};

type ShootServiceLike = {
  id?: unknown;
  service_id?: unknown;
  serviceId?: unknown;
  scheduled_at?: unknown;
  scheduledAt?: unknown;
};

type ShootLike = {
  scheduledDate?: unknown;
  scheduled_date?: unknown;
  time?: unknown;
  services?: ShootServiceLike[] | unknown;
  serviceItems?: ShootServiceLike[] | unknown;
  service_items?: ShootServiceLike[] | unknown;
  serviceObjects?: ShootServiceLike[] | unknown;
};

const collectShootScheduleByServiceId = (shoot?: ShootLike | null): Map<string, string> => {
  const map = new Map<string, string>();
  if (!shoot) return map;
  for (const list of [shoot.services, shoot.serviceItems, shoot.service_items, shoot.serviceObjects]) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const record = asRecord(row);
      const id = record.service_id ?? record.serviceId ?? record.id;
      if (id == null || id === '') continue;
      const stamp = record.scheduled_at ?? record.scheduledAt;
      if (stamp == null || stamp === '') continue;
      // First non-empty stamp wins; later lists may be thinner aliases.
      const key = String(id);
      if (!map.has(key)) map.set(key, normalizeScheduleStamp(stamp));
    }
  }
  return map;
};

const hasDirtyServiceSchedules = (
  payload: Record<string, unknown>,
  shoot?: ShootLike | null,
): boolean => {
  const db = collectShootScheduleByServiceId(shoot);
  const collections: Array<{ key: 'services' | 'service_items'; idKey: 'id' | 'service_id' }> = [
    { key: 'services', idKey: 'id' },
    { key: 'service_items', idKey: 'service_id' },
  ];

  for (const { key, idKey } of collections) {
    const lines = payload[key];
    if (!Array.isArray(lines)) continue;
    for (const row of lines) {
      const record = asRecord(row);
      if (!Object.prototype.hasOwnProperty.call(record, 'scheduled_at')) continue;
      const id = record[idKey];
      if (id == null || id === '') continue;
      const incoming = normalizeScheduleStamp(record.scheduled_at);
      const existing = db.get(String(id)) ?? '';
      if (incoming === existing) continue;
      // Both empty (null/undefined/'') — not a schedule edit.
      if (!incoming && !existing) continue;
      return true;
    }
  }
  return false;
};

/**
 * Keep only assigned-rep editable keys. Drop unchanged schedule/service plan
 * echoes so a photographer-only Save becomes
 * `{ photographer_id, service_photographers?, notify_* }`.
 *
 * Do not strip services/service_items when any line's scheduled_at differs from
 * the shoot's stored line (Overview can dirty per-service time while top-level
 * scheduled_date/time still match and get dropped — #395 / 16 Dayton).
 */
export function slimAssignedRepShootSavePayload(
  payload: Record<string, unknown>,
  shoot?: ShootLike | null,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!ASSIGNED_REP_SHOOT_SAVE_KEY_SET.has(key)) continue;
    if (key === 'services') {
      const lines = slimServiceLines(value, 'id');
      if (lines) next.services = lines;
      continue;
    }
    if (key === 'service_items') {
      const lines = slimServiceLines(value, 'service_id');
      if (lines) next.service_items = lines;
      continue;
    }
    if (key === 'tour_links') {
      const links = asRecord(value);
      if (Object.prototype.hasOwnProperty.call(links, 'realtor_client_id')) {
        next.tour_links = { realtor_client_id: links.realtor_client_id };
      }
      continue;
    }
    next[key] = value;
  }

  const shootDate = normalizeDate(shoot?.scheduledDate ?? shoot?.scheduled_date);
  const shootTime = normalizeTime(shoot?.time);
  if (
    Object.prototype.hasOwnProperty.call(next, 'scheduled_date')
    && sameScalar(next.scheduled_date, shootDate)
  ) {
    delete next.scheduled_date;
  }
  if (
    Object.prototype.hasOwnProperty.call(next, 'time')
    && sameScalar(normalizeTime(next.time), shootTime)
  ) {
    delete next.time;
  }
  // Photographer/notify-only saves must not re-echo the full service plan —
  // that path still trips AssignedRepSchedulePayload when line shapes drift.
  // Exception: dirty per-service scheduled_at is a real schedule edit even when
  // top-level date/time keys were dropped as unchanged.
  const photographerOnly = (
    Object.prototype.hasOwnProperty.call(next, 'photographer_id')
    || Object.prototype.hasOwnProperty.call(next, 'service_photographers')
  ) && !Object.prototype.hasOwnProperty.call(next, 'scheduled_date')
    && !Object.prototype.hasOwnProperty.call(next, 'scheduled_at')
    && !Object.prototype.hasOwnProperty.call(next, 'time')
    && !hasDirtyServiceSchedules(next, shoot);

  if (photographerOnly) {
    delete next.services;
    delete next.service_items;
  }

  return next;
}
