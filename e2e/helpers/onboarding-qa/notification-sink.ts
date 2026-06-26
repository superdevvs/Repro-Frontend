import { request as apiRequest, type APIRequestContext } from '@playwright/test';

import type { QaEnv } from './env';

/**
 * Notification-sink reader for the photographer onboarding QA harness.
 *
 * When `E2E_NOTIFICATION_MODE` / `E2E_EMAIL_MODE` / `E2E_SMS_MODE` are `log` and `E2E_VOICE_MODE`
 * is `disabled`, the Onboarding_System routes notifications to a non-live `Notification_Sink`
 * instead of transmitting real messages (Requirement 17.1). This reader retrieves the persisted
 * `Notification_Record`s so a spec can assert the correct recipient (Req 17.3), template
 * (Req 17.4), and rendered variables (Req 17.5), and can assert that **no real message was sent**
 * (Req 17.6).
 *
 * ## Backend source (the Notification_Sink)
 *
 * The sink is the backend `messages` table (`App\Models\Message`). Every intended email / SMS /
 * voice notification is recorded there with:
 * - `to_address`  → the recipient (Req 17.3)
 * - `template_id` + the `template` relation (`key` / `slug` / `name`) → the template (Req 17.4)
 * - `metadata`    → the rendered template variables (Req 17.5)
 * - `channel`     → `EMAIL` | `SMS` | `VOICE`
 * - `status` / `provider` / `sent_at` / `delivered_at` → whether a *live* transmission occurred
 *   (used by {@link NotificationSink.assertNoLiveSend}, Req 17.6)
 *
 * ## Read endpoints (and the documented assumption)
 *
 * The canonical **flat** read API for that store is the admin-scoped, paginated
 * `GET /api/messaging/email/messages` (see `EmailMessagingController::messages` +
 * `MessagingService::getMessageLogs`). That controller currently constrains the query to
 * `channel = EMAIL`, so this reader observes EMAIL records through it. SMS records are exposed
 * through the thread API (`GET /api/messaging/sms/threads` → `GET /api/messaging/sms/threads/{id}`)
 * and are flattened here. VOICE has no dedicated flat read endpoint, and because
 * `E2E_VOICE_MODE` is `disabled` in sink mode no voice records are produced — so the `voice`
 * channel resolves to an empty result with a documented gap.
 *
 * **ASSUMPTION (so a spec can adjust):** if/when the backend exposes a single cross-channel
 * message-log endpoint, point {@link EMAIL_MESSAGES_PATH} at it and broaden
 * {@link mapRawChannel}. The shape this reader depends on is Laravel's standard paginated
 * envelope (`{ data: Message[], current_page, last_page, next_page_url }`) plus the documented
 * `Message` columns above.
 *
 * The reader authenticates exactly like the rest of the harness: it lazily mints its own
 * {@link APIRequestContext} pinned to `env.apiBaseUrl` and a super-admin bearer token via
 * `POST /api/login` (matching `test-data.ts` / `qa-acceptance.e2e.ts`). Construction is therefore
 * side-effect free and read-only.
 *
 * See design.md "Components and Interfaces → 8. Notification sink reader (`notification-sink.ts`)".
 */

/** The flat, admin-scoped, paginated read endpoint for the shared `Message` store (EMAIL channel). */
const EMAIL_MESSAGES_PATH = '/api/messaging/email/messages';

/** The paginated SMS thread list; each thread is expanded to its messages for flattening. */
const SMS_THREADS_PATH = '/api/messaging/sms/threads';

/** Page size requested from paginated endpoints. */
const PER_PAGE = 100;

/** Safety cap on pages / threads fetched so a reader call cannot run away on a large store. */
const MAX_PAGES = 25;
const MAX_THREADS = 200;

/** A notification channel as modeled by the sink. */
export type NotificationChannel = 'email' | 'sms' | 'voice';

/** Channels the reader can query by default (voice has no flat read endpoint; see module docs). */
const DEFAULT_CHANNELS: readonly NotificationChannel[] = ['email', 'sms'];

/** Backend message statuses (and timestamps) that indicate a real, live transmission occurred. */
const LIVE_SEND_STATUSES = new Set(['SENT', 'DELIVERED']);

/**
 * A single intended notification, recorded in the non-live `Notification_Sink` instead of being
 * transmitted (Requirement 17 / glossary `Notification_Record`).
 */
export interface NotificationRecord {
  /** The intended recipient — email address or phone number (Req 17.3). */
  recipient: string;
  /** The template key/slug/name (or numeric id as a string) used to render the message (Req 17.4). */
  template: string;
  /** The rendered template variables captured for the message (Req 17.5). */
  variables: Record<string, unknown>;
  /** The delivery channel the notification targets. */
  channel: NotificationChannel;
}

/**
 * The notification-sink reader contract.
 *
 * - {@link records} retrieves `Notification_Record`s, optionally narrowed by a partial match on
 *   recipient / template / variables / channel.
 * - {@link assertNoLiveSend} asserts that no record produced during this run was actually
 *   transmitted on a live channel (Req 17.6).
 */
export interface NotificationSink {
  /** Retrieve notification records, optionally filtered by a partial {@link NotificationRecord}. */
  records(filter?: Partial<NotificationRecord>): Promise<NotificationRecord[]>;
  /** Assert no record exists that was sent live (no real SMS/email/voice send occurred). Req 17.6 */
  assertNoLiveSend(): Promise<void>;
}

/**
 * A raw `Message` row as returned by the backend read endpoints. All fields are optional so the
 * reader degrades gracefully across the email/SMS resource shapes.
 */
interface RawMessage {
  channel?: string | null;
  to_address?: string | null;
  to?: string | null;
  recipient?: string | null;
  template_id?: number | string | null;
  template?: { id?: number | string; key?: string; slug?: string; name?: string } | null;
  metadata?: Record<string, unknown> | null;
  variables?: Record<string, unknown> | null;
  status?: string | null;
  provider?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
}

/** A raw message paired with the channel it was fetched under (so SMS rows are tagged correctly). */
interface ChannelRawMessage {
  channel: NotificationChannel;
  raw: RawMessage;
}

/** Map a backend `channel` string to the sink's {@link NotificationChannel} union. */
function mapRawChannel(value: string | null | undefined, fallback: NotificationChannel): NotificationChannel {
  switch ((value ?? '').toUpperCase()) {
    case 'EMAIL':
      return 'email';
    case 'SMS':
      return 'sms';
    case 'VOICE':
      return 'voice';
    default:
      return fallback;
  }
}

/** Resolve the human-facing template identifier from a raw message (key → slug → name → id). */
function resolveTemplate(raw: RawMessage): string {
  const template = raw.template;
  const fromRelation = template?.key ?? template?.slug ?? template?.name;
  if (fromRelation) {
    return String(fromRelation);
  }
  const id = template?.id ?? raw.template_id;
  return id !== undefined && id !== null ? String(id) : '';
}

/** Resolve the recipient from a raw message across the email/SMS resource shapes. */
function resolveRecipient(raw: RawMessage): string {
  return String(raw.to_address ?? raw.to ?? raw.recipient ?? '');
}

/** Resolve the rendered variables, tolerating either a `metadata` or `variables` column. */
function resolveVariables(raw: RawMessage): Record<string, unknown> {
  const source = raw.metadata ?? raw.variables;
  return source && typeof source === 'object' ? source : {};
}

/** Map a raw message (tagged with its channel) to a {@link NotificationRecord}. */
function toRecord(entry: ChannelRawMessage): NotificationRecord {
  return {
    recipient: resolveRecipient(entry.raw),
    template: resolveTemplate(entry.raw),
    variables: resolveVariables(entry.raw),
    channel: mapRawChannel(entry.raw.channel, entry.channel),
  };
}

/** True iff a raw message shows evidence of a real, live transmission (Req 17.6). */
function isLiveSend(raw: RawMessage): boolean {
  if (raw.sent_at || raw.delivered_at) {
    return true;
  }
  return LIVE_SEND_STATUSES.has((raw.status ?? '').toUpperCase());
}

/**
 * True iff a recipient carries this run's id suffix. Email recipients embed the suffix in the
 * local part (`<local>.<runId>@<domain>`); names/other values carry it as a trailing token. Phone
 * recipients are not run-taggable, so SMS/voice live-send scoping is best-effort (documented).
 */
function recipientBelongsToRun(recipient: string, runId: string): boolean {
  if (runId.length === 0 || recipient.length === 0) {
    return false;
  }
  const atIndex = recipient.indexOf('@');
  if (atIndex !== -1) {
    return recipient.slice(0, atIndex).endsWith(`.${runId}`);
  }
  return recipient.includes(runId);
}

/** Shallow-match a filter's variables against a record (every provided key/value must match). */
function variablesMatch(
  filter: Record<string, unknown>,
  actual: Record<string, unknown>,
): boolean {
  return Object.entries(filter).every(
    ([key, value]) => JSON.stringify(actual[key]) === JSON.stringify(value),
  );
}

/** True iff a record satisfies every field present in the partial filter. */
function matchesFilter(record: NotificationRecord, filter: Partial<NotificationRecord>): boolean {
  if (filter.channel !== undefined && record.channel !== filter.channel) {
    return false;
  }
  if (filter.recipient !== undefined && record.recipient !== filter.recipient) {
    return false;
  }
  if (filter.template !== undefined && record.template !== filter.template) {
    return false;
  }
  if (filter.variables !== undefined && !variablesMatch(filter.variables, record.variables)) {
    return false;
  }
  return true;
}

/** Extract a list payload from either a Laravel paginator envelope or a bare array. */
function extractList(body: unknown): { items: RawMessage[]; nextPageUrl: string | null } {
  if (Array.isArray(body)) {
    return { items: body as RawMessage[], nextPageUrl: null };
  }
  if (body && typeof body === 'object') {
    const envelope = body as { data?: unknown; next_page_url?: string | null };
    if (Array.isArray(envelope.data)) {
      return { items: envelope.data as RawMessage[], nextPageUrl: envelope.next_page_url ?? null };
    }
  }
  return { items: [], nextPageUrl: null };
}

/**
 * Create the {@link NotificationSink} reader.
 *
 * The reader is bound only to {@link QaEnv}: it derives the API base URL, admin credentials, and
 * the run id from the resolved environment. It does not mutate any state.
 */
export function createNotificationSink(env: QaEnv): NotificationSink {
  let context: APIRequestContext | undefined;
  let token: string | undefined;

  /** Lazily create the API request context pinned to the resolved API base URL. */
  async function ensureContext(): Promise<APIRequestContext> {
    if (!context) {
      context = await apiRequest.newContext({ baseURL: env.apiBaseUrl });
    }
    return context;
  }

  /** Lazily authenticate as the bootstrap super admin and cache the bearer token. */
  async function ensureToken(): Promise<string> {
    if (token) {
      return token;
    }
    const ctx = await ensureContext();
    const login = await ctx.post('/api/login', {
      data: { email: env.adminEmail, password: env.adminPassword },
    });
    if (!login.ok()) {
      throw new Error(
        `Admin API login failed with ${login.status()} while reading the notification sink`,
      );
    }
    const body = (await login.json()) as { token?: string };
    if (!body.token) {
      throw new Error('Admin API login did not return a token while reading the notification sink');
    }
    token = String(body.token);
    return token;
  }

  /** Issue an authenticated GET and return the parsed JSON body (or null on a non-OK response). */
  async function getJson(path: string): Promise<unknown> {
    const ctx = await ensureContext();
    const bearer = await ensureToken();
    const response = await ctx.get(path, {
      headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' },
    });
    if (!response.ok()) {
      throw new Error(`GET ${path} failed with ${response.status()} while reading the notification sink`);
    }
    return response.json();
  }

  /** Fetch the EMAIL-channel rows from the shared `Message` store (paginated). */
  async function fetchEmail(): Promise<ChannelRawMessage[]> {
    const collected: ChannelRawMessage[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const body = await getJson(`${EMAIL_MESSAGES_PATH}?per_page=${PER_PAGE}&page=${page}`);
      const { items, nextPageUrl } = extractList(body);
      for (const raw of items) {
        collected.push({ channel: 'email', raw });
      }
      if (items.length < PER_PAGE && !nextPageUrl) {
        break;
      }
      if (!nextPageUrl) {
        break;
      }
    }
    return collected;
  }

  /** Fetch SMS rows by listing threads then flattening each thread's messages. */
  async function fetchSms(): Promise<ChannelRawMessage[]> {
    const collected: ChannelRawMessage[] = [];
    const threadIds: Array<number | string> = [];

    for (let page = 1; page <= MAX_PAGES && threadIds.length < MAX_THREADS; page += 1) {
      const body = await getJson(`${SMS_THREADS_PATH}?per_page=${PER_PAGE}&page=${page}`);
      const { items, nextPageUrl } = extractList(body);
      for (const thread of items as Array<{ id?: number | string }>) {
        if (thread.id !== undefined && thread.id !== null) {
          threadIds.push(thread.id);
        }
      }
      if (items.length < PER_PAGE || !nextPageUrl) {
        break;
      }
    }

    for (const id of threadIds.slice(0, MAX_THREADS)) {
      const body = (await getJson(`${SMS_THREADS_PATH}/${id}`)) as { messages?: unknown };
      const { items } = extractList(body?.messages);
      for (const raw of items) {
        collected.push({ channel: 'sms', raw });
      }
    }

    return collected;
  }

  /** Fetch raw messages for the requested channels. */
  async function fetchRaw(channels: readonly NotificationChannel[]): Promise<ChannelRawMessage[]> {
    const batches: ChannelRawMessage[][] = [];
    if (channels.includes('email')) {
      batches.push(await fetchEmail());
    }
    if (channels.includes('sms')) {
      batches.push(await fetchSms());
    }
    // 'voice' has no flat read endpoint and is disabled in sink mode → no records (documented).
    return batches.flat();
  }

  return {
    async records(filter?: Partial<NotificationRecord>): Promise<NotificationRecord[]> {
      // Narrow the channels we query when the caller pins a channel; otherwise read the defaults.
      const channels = filter?.channel ? [filter.channel] : DEFAULT_CHANNELS;
      const raw = await fetchRaw(channels);
      const mapped = raw.map(toRecord);
      return filter ? mapped.filter((record) => matchesFilter(record, filter)) : mapped;
    },

    async assertNoLiveSend(): Promise<void> {
      const raw = await fetchRaw(DEFAULT_CHANNELS);

      // Scope to THIS run's recipients so unrelated production traffic is never flagged. Email
      // recipients carry the run-id suffix; SMS/voice phone recipients are not run-taggable, so
      // their live-send detection is best-effort (see module docs).
      const offenders = raw.filter(
        (entry) =>
          isLiveSend(entry.raw) &&
          recipientBelongsToRun(resolveRecipient(entry.raw), env.runId),
      );

      if (offenders.length > 0) {
        const detail = offenders
          .map((entry) => {
            const recipient = resolveRecipient(entry.raw);
            const status = entry.raw.status ?? 'unknown';
            return `${entry.channel}:${recipient} (status=${status})`;
          })
          .join(', ');
        throw new Error(
          `Notification_Sink expected no live send for run "${env.runId}", but found ${offenders.length}: ${detail}`,
        );
      }
    },
  };
}
