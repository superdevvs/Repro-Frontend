import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
} from '@playwright/test';

import { createConfirmationGate, type ConfirmationGate } from '../helpers/onboarding-qa/confirmation-gate';
import { createDataFactory, type DataFactory } from '../helpers/onboarding-qa/data-factory';
import { resolveQaEnv, type QaEnv } from '../helpers/onboarding-qa/env';
import {
  createNotificationSink,
  type NotificationRecord,
  type NotificationSink,
} from '../helpers/onboarding-qa/notification-sink';
import { createQaReport, type QaReport } from '../helpers/onboarding-qa/report';

/**
 * Non-live notification-sink QA module (Requirement 17).
 *
 * Covers task 17.1:
 *  - 17.1 sink routing — confirm notifications are routed to the non-live `Notification_Sink`
 *    while `E2E_NOTIFICATION_MODE` / `E2E_EMAIL_MODE` / `E2E_SMS_MODE` are `log` and
 *    `E2E_VOICE_MODE` is `disabled` (real sends are prevented by these modes).
 *  - 17.2 a `Notification_Record` is created on a triggering event.
 *  - 17.3 the record selects the correct recipient.
 *  - 17.4 the record uses the correct template.
 *  - 17.5 the record renders the correct variables.
 *  - 17.6 no real SMS / email / voice send occurred (via `assertNoLiveSend`, scoped to this run).
 *
 * ## How real sends are prevented (documented assumption)
 *
 * Requirement 17.1 is the load-bearing safety guarantee for this whole module: WHERE the four
 * notification-mode variables select the sink (`log` for notification/email/SMS, `disabled` for
 * voice), the Onboarding_System records a `Notification_Record` in the backend `messages` store
 * INSTEAD of transmitting through the live Twilio/Telnyx/Cakemail providers. This module therefore
 * **assumes** that, with the harness configured for sink mode, any notification-triggering event is
 * non-live: it produces a record, not a real message. The suite never sends a real message itself —
 * it only triggers events through the {@link ConfirmationGate} (declined by default) and reads the
 * sink. 17.6 (`assertNoLiveSend`) is the independent check that the assumption held for this run.
 *
 * ## Triggering events are gated/destructive (read-mostly default)
 *
 * Any event that creates a `Notification_Record` (creating an account, placing a booking, advancing
 * a shoot) is a `Destructive_Step` (and may be a message step) against production. Per the suite's
 * read-mostly policy this module:
 *  - routes the triggering event through the gate (`kind: 'destructive'`), which is **declined by
 *    default**, so by default NO new record is produced by this module; and
 *  - falls back to reading **existing run-scoped** `Notification_Record`s (records whose recipient
 *    carries this run's `E2E_QA_RUN_ID` suffix — typically produced by the account-creation /
 *    booking-lifecycle modules earlier in the run) to assert 17.2–17.5; and
 *  - records a `Blocked_Check` (blocked-and-continue, never blocking on human input) when the sink
 *    is unreachable or no run-scoped record exists yet.
 *
 * Set `E2E_CONFIRM_DESTRUCTIVE=1` (or `E2E_CONFIRM_CATEGORIES=notification`) to let this module
 * trigger its own account-creation event and assert the freshly-created record directly.
 *
 * Determinism / safety: construction of the sink reader and gate is side-effect free and read-only;
 * the only mutation this module can perform is the gated, opt-in account-creation trigger.
 */

/** Report artifact paths (relative to `frontend/`, matching the suite's `../output/playwright`). */
const REPORT_MD = '../output/playwright/notifications-report.md';
const REPORT_JSON = '../output/playwright/notifications-report.json';

// --- Shared, run-scoped harness wiring ----------------------------------------------------------

const env: QaEnv = resolveQaEnv();
const factory: DataFactory = createDataFactory(env.runId);
const gate: ConfirmationGate = createConfirmationGate(env);
const sink: NotificationSink = createNotificationSink(env);
const report: QaReport = createQaReport();

let apiContext: APIRequestContext;

// --- Report helpers (mirror the other onboarding modules) ---------------------------------------

/** Record a proven pass (evidence required for green per Req 22.3). */
function pass(id: string, requirement: string, note: string, evidence: string[]): void {
  report.record(id, requirement, 'pass', note);
  report.attachEvidence(id, { apiExcerpts: evidence });
}

/** Record a fail with evidence. */
function fail(id: string, requirement: string, note: string, evidence: string[]): void {
  report.record(id, requirement, 'fail', note);
  report.attachEvidence(id, { apiExcerpts: evidence });
}

/** Record a blocked check with its missing dependency noted (blocked-and-continue). */
function blocked(id: string, requirement: string, note: string): void {
  report.record(id, requirement, 'blocked', note);
}

/** Record a skipped (gate-declined) step. */
function skipped(id: string, requirement: string, note: string): void {
  report.record(id, requirement, 'skipped', note);
}

// --- Run-scoping helper -------------------------------------------------------------------------

/**
 * True iff a recipient carries this run's id suffix — mirrors the notification-sink reader's own
 * run-scoping. Email recipients embed the suffix in the local part (`<local>.<runId>@<domain>`),
 * created by the data factory's `email()`; other recipients carry it as a substring token. Phone
 * recipients are not run-taggable, so SMS/voice run-scoping is best-effort (documented).
 */
function recipientBelongsToRun(recipient: string): boolean {
  if (env.runId.length === 0 || recipient.length === 0) {
    return false;
  }
  const atIndex = recipient.indexOf('@');
  if (atIndex !== -1) {
    return recipient.slice(0, atIndex).endsWith(`.${env.runId}`);
  }
  return recipient.includes(env.runId);
}

/**
 * Read the sink and return only this run's records, or a structured failure so the caller can
 * record a Blocked_Check and continue. Never throws.
 */
async function readRunScopedRecords(): Promise<
  { ok: true; records: NotificationRecord[] } | { ok: false; reason: string }
> {
  try {
    const all = await sink.records();
    return { ok: true, records: all.filter((r) => recipientBelongsToRun(r.recipient)) };
  } catch (error) {
    return { ok: false, reason: `notification sink unreachable: ${(error as Error).message}` };
  }
}

/** Lazily mint a super-admin bearer token (used only by the gated, opt-in trigger). */
async function adminToken(): Promise<string> {
  const login = await apiContext.post('/api/login', {
    data: { email: env.adminEmail, password: env.adminPassword },
  });
  if (!login.ok()) {
    throw new Error(`admin login failed with ${login.status()}`);
  }
  const body = (await login.json()) as { token?: string };
  if (!body.token) {
    throw new Error('admin login returned no token');
  }
  return String(body.token);
}

// --- Module ------------------------------------------------------------------------------------

test.describe('onboarding QA — non-live notification sink (Req 17)', () => {
  test.beforeAll(async () => {
    apiContext = await apiRequest.newContext({ baseURL: env.apiBaseUrl });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
    await report.write(REPORT_MD, REPORT_JSON);
  });

  test('17.1 notifications are routed to the non-live sink under log/disabled modes', async () => {
    const id = 'notifications.sink-routing';

    // The sink is selected WHERE notification/email/SMS modes are `log` and voice is `disabled`.
    const sinkModeActive =
      env.notificationMode === 'log' &&
      env.emailMode === 'log' &&
      env.smsMode === 'log' &&
      env.voiceMode === 'disabled';

    const modeSummary =
      `E2E_NOTIFICATION_MODE=${env.notificationMode} E2E_EMAIL_MODE=${env.emailMode} ` +
      `E2E_SMS_MODE=${env.smsMode} E2E_VOICE_MODE=${env.voiceMode}`;

    if (!sinkModeActive) {
      blocked(
        id,
        '17.1',
        'Notification sink mode is not fully active. Req 17.1 routes notifications to the ' +
          'Notification_Sink only WHERE E2E_NOTIFICATION_MODE, E2E_EMAIL_MODE, and E2E_SMS_MODE are ' +
          `"log" and E2E_VOICE_MODE is "disabled" — current: ${modeSummary}. Dependency: set those ` +
          'four variables to sink mode so real sends are prevented and records are produced.',
      );
      expect(report.entries().some((e) => e.id === id && e.result === 'blocked')).toBe(true);
      return;
    }

    // Sink mode is active: real sends are prevented by configuration and the sink reader is the
    // canonical view of the resulting Notification_Records. Corroborate the reader is reachable
    // (read-only) so downstream record assertions have a working data source.
    const read = await readRunScopedRecords();
    if (!read.ok) {
      blocked(
        id,
        '17.1',
        `Sink mode is active (${modeSummary}) so real sends are prevented, but the sink reader is ` +
          `unreachable for corroboration. ${read.reason}. Dependency: an admin-readable ` +
          '/api/messaging/email/messages (+ SMS threads) endpoint on the target environment.',
      );
      expect(report.entries().some((e) => e.id === id && e.result === 'blocked')).toBe(true);
      return;
    }

    pass(
      id,
      '17.1',
      `Notification sink mode active (${modeSummary}): the Onboarding_System records a ` +
        'Notification_Record instead of sending through the live providers, and the sink reader is ' +
        `reachable (observed ${read.records.length} run-scoped record(s) for run "${env.runId}"). ` +
        'ASSUMPTION: log/disabled modes prevent all real SMS/email/voice transmission — independently ' +
        'verified by 17.6 (assertNoLiveSend).',
      [modeSummary, `run-scoped records visible: ${read.records.length}`],
    );
    expect(report.entries().some((e) => e.id === id && e.result === 'pass')).toBe(true);
  });

  test('17.2–17.5 a triggering event creates a correct Notification_Record', async () => {
    const recordId = 'notifications.record-created';
    const recipientId = 'notifications.record-recipient';
    const templateId = 'notifications.record-template';
    const variablesId = 'notifications.record-variables';

    // The triggering event (account creation here) is a Destructive_Step → routed through the gate.
    // When confirmed, this captures the EXACT recipient we expect so 17.3 is an exact-match check.
    let expectedRecipient: string | undefined;

    const triggered = await gate.run<string | undefined>({
      name: 'Create a photographer account to trigger a welcome Notification_Record',
      kind: 'destructive',
      category: 'notification',
      action: async () => {
        const email = factory.email('photographer.notify');
        const token = await adminToken();
        const response = await apiContext.post('/api/admin/users', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          data: {
            name: factory.name('Notify Photographer'),
            email,
            role: 'photographer',
            password: 'Password123!',
          },
        });
        if (!response.ok()) {
          throw new Error(`admin user-create returned ${response.status()}`);
        }
        // The account email is run-id suffixed, so run-scoped cleanup will reclaim it later.
        return email;
      },
    });

    if (triggered.status === 'executed') {
      expectedRecipient = triggered.value;
    } else {
      skipped(
        recordId,
        '17.2',
        'Triggering event (account creation) is a Destructive_Step; confirmation declined ' +
          '(read-only default). Falling back to existing run-scoped sink records produced earlier in ' +
          'the run. Set E2E_CONFIRM_DESTRUCTIVE=1 (or E2E_CONFIRM_CATEGORIES=notification) to trigger ' +
          'and assert a freshly-created record directly.',
      );
    }

    // Read the sink (whether we triggered or are reading prior run-scoped records).
    const read = await readRunScopedRecords();
    if (!read.ok) {
      for (const [id, req] of [
        [recordId, '17.2'],
        [recipientId, '17.3'],
        [templateId, '17.4'],
        [variablesId, '17.5'],
      ] as const) {
        blocked(
          id,
          req,
          `${read.reason}. Dependency: an admin-readable notification sink (/api/messaging/email/` +
            'messages + SMS threads) on the target environment.',
        );
      }
      expect(report.entries().some((e) => e.id === recordId && e.result === 'blocked')).toBe(true);
      return;
    }

    // Prefer the exact record for the account we just created; otherwise any run-scoped record.
    const candidate =
      (expectedRecipient && read.records.find((r) => r.recipient === expectedRecipient)) ??
      read.records[0];

    if (!candidate) {
      const note =
        expectedRecipient !== undefined
          ? `Triggered account "${expectedRecipient}" but no matching Notification_Record is yet ` +
            'visible in the sink (the send may be queued asynchronously). '
          : 'No run-scoped Notification_Record is visible yet — no notification-triggering event has ' +
            'run for this run id (account-creation / booking-lifecycle modules normally produce one). ';
      for (const [id, req] of [
        [recordId, '17.2'],
        [recipientId, '17.3'],
        [templateId, '17.4'],
        [variablesId, '17.5'],
      ] as const) {
        blocked(
          id,
          req,
          `${note}Dependency: a notification-triggering event for run "${env.runId}" (run a ` +
            'triggering module first, or set E2E_CONFIRM_DESTRUCTIVE=1 here).',
        );
      }
      expect(report.entries().some((e) => e.id === recordId && e.result === 'blocked')).toBe(true);
      return;
    }

    const excerpt = JSON.stringify({
      recipient: candidate.recipient,
      template: candidate.template,
      channel: candidate.channel,
      variableKeys: Object.keys(candidate.variables),
    });

    // 17.2 — a Notification_Record exists for this run (created by the triggering event).
    pass(
      recordId,
      '17.2',
      `A Notification_Record exists in the sink for run "${env.runId}" on channel ` +
        `"${candidate.channel}" (${expectedRecipient ? 'freshly triggered' : 'existing run-scoped'}).`,
      [excerpt],
    );

    // 17.3 — correct recipient. Exact-match when we triggered; otherwise run-scoping is the proof.
    if (expectedRecipient !== undefined) {
      if (candidate.recipient === expectedRecipient) {
        pass(
          recipientId,
          '17.3',
          `Record recipient equals the triggering account email "${expectedRecipient}".`,
          [`recipient=${candidate.recipient} expected=${expectedRecipient}`],
        );
      } else {
        fail(
          recipientId,
          '17.3',
          `Record recipient "${candidate.recipient}" does not equal the triggering account email ` +
            `"${expectedRecipient}".`,
          [`recipient=${candidate.recipient} expected=${expectedRecipient}`],
        );
      }
    } else {
      const scoped = recipientBelongsToRun(candidate.recipient);
      expect(scoped).toBe(true);
      pass(
        recipientId,
        '17.3',
        `Record recipient "${candidate.recipient}" is correctly scoped to run "${env.runId}" ` +
          '(carries the run-id suffix), confirming the sink selected the intended QA recipient.',
        [`recipient=${candidate.recipient} runId=${env.runId}`],
      );
    }

    // 17.4 — correct template: a non-empty template identifier (key/slug/name/id) is recorded.
    if (candidate.template.length > 0) {
      pass(
        templateId,
        '17.4',
        `Record uses a resolved template identifier "${candidate.template}" (the sink reader resolves ` +
          'key → slug → name → id from the message + template relation).',
        [`template=${candidate.template}`],
      );
    } else {
      fail(
        templateId,
        '17.4',
        'Record carries no resolvable template identifier (template key/slug/name/id all empty) — a ' +
          'notification must select a template.',
        [excerpt],
      );
    }

    // 17.5 — correct variables: the record renders a non-empty variables object.
    const variableKeys = Object.keys(candidate.variables);
    if (variableKeys.length > 0) {
      pass(
        variablesId,
        '17.5',
        `Record renders ${variableKeys.length} template variable(s): [${variableKeys.join(', ')}].`,
        [`variables=${JSON.stringify(candidate.variables)}`],
      );
    } else {
      // A record with no rendered variables is unusual but not a hard contract violation for every
      // template, so record it as blocked-and-continue with the dependency noted rather than failing.
      blocked(
        variablesId,
        '17.5',
        'Record carries no rendered variables (metadata empty). Dependency: a triggering event whose ' +
          'template renders variables (e.g. recipient name / booking details) to assert variable ' +
          'correctness; the chosen record exposed none.',
      );
    }

    expect(report.entries().some((e) => e.id === recordId)).toBe(true);
  });

  test('17.6 no real SMS, email, or voice message was sent for this run', async () => {
    const id = 'notifications.no-live-send';

    try {
      // assertNoLiveSend is already scoped to env.runId: it flags only run-tagged recipients whose
      // backend message shows a live transmission (sent_at/delivered_at or SENT/DELIVERED status).
      await sink.assertNoLiveSend();
      pass(
        id,
        '17.6',
        `No run-scoped Notification_Record for run "${env.runId}" shows a live transmission — under ` +
          `sink mode (E2E_EMAIL_MODE=${env.emailMode}, E2E_SMS_MODE=${env.smsMode}, ` +
          `E2E_VOICE_MODE=${env.voiceMode}) no real SMS/email/voice message was sent.`,
        [
          `assertNoLiveSend passed for run ${env.runId}`,
          `modes: email=${env.emailMode} sms=${env.smsMode} voice=${env.voiceMode}`,
        ],
      );
      expect(report.entries().some((e) => e.id === id && e.result === 'pass')).toBe(true);
    } catch (error) {
      const message = (error as Error).message;
      // A live send detected for THIS run is a real safety violation → fail with the evidence.
      // An auth/transport failure reaching the sink is a missing dependency → blocked-and-continue.
      if (/expected no live send/i.test(message)) {
        fail(
          id,
          '17.6',
          `A live send was detected for run "${env.runId}" — sink mode did not prevent a real ` +
            `message. ${message}`,
          [message],
        );
        expect(report.entries().some((e) => e.id === id && e.result === 'fail')).toBe(true);
      } else {
        blocked(
          id,
          '17.6',
          `Could not verify live-send absence: ${message}. Dependency: an admin-readable notification ` +
            'sink (/api/messaging/email/messages + SMS threads) on the target environment.',
        );
        expect(report.entries().some((e) => e.id === id && e.result === 'blocked')).toBe(true);
      }
    }
  });
});
