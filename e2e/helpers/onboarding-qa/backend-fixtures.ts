/**
 * Backend fixture wrappers for the photographer onboarding QA harness.
 *
 * Thin, typed wrappers that DOCUMENT and INVOKE the existing Laravel `artisan` seed/admin
 * commands as test fixtures, so domain specs can arrange realistic backend state without any
 * bespoke setup. **No new backend commands are introduced** — each wrapper maps onto a command
 * that already ships in `backend/app/Console/Commands/`.
 *
 * These fixtures are typically invoked **out-of-band**: an operator (or a deploy step) runs them,
 * or they are shelled per the suite's deployment. The harness therefore does NOT assume a live
 * shell is reachable from Playwright. Each wrapper instead resolves to an explicit, inspectable
 * {@link ArtisanInvocation} (the command name plus its argv plus a copy-pasteable command line),
 * and execution is opt-in through an injected {@link ArtisanRunner}.
 *
 * See design.md "Components and Interfaces → 12. Backend fixtures (`backend-fixtures.ts`)".
 *
 * | Concern               | Command(s)                                                                                   | Used by                         |
 * | --------------------- | -------------------------------------------------------------------------------------------- | ------------------------------- |
 * | Availability windows  | `photographers:seed-availability`                                                            | settings (20.1/20.2), calendar  |
 * | Blocked windows       | `photographers:seed-blocked-windows`                                                         | settings (20.3/20.4), calendar  |
 * | Test addresses        | `photographers:seed-test-addresses`                                                          | service-radius (8.x)            |
 * | Previous shoot        | `photographers:seed-previous-shoot`                                                          | shoot-workflow (12.x), 11.x     |
 * | Onboarding blocks     | `onboarding:seed-team`                                                                        | account-creation (5.x), 7.x     |
 * | CubiCasa webhook/sync  | `cubicasa:register-webhook`, `cubicasa:resync-pending`, `cubicasa:backfill-assets`           | cubicasa (4.x)                  |
 * | Invoicing/reporting   | `invoices:generate`, `messaging:invoice-summaries`, `reports:sales:weekly`, `payouts:send`, `messaging:invoice-reminders`, `messaging:payment-reminders-sweep` | invoicing-reporting (18.x) |
 */

import type { StepKind } from './confirmation-gate';

/**
 * A resolved artisan command invocation.
 *
 * `args` is the raw, unquoted argv (suitable for argv-style execution such as `execFile`), while
 * `commandLine` is a shell-quoted, copy-pasteable string for documentation / manual runs.
 */
export interface ArtisanInvocation {
  /** The artisan command signature name, e.g. `photographers:seed-availability`. */
  command: string;
  /** Raw, unquoted arguments (excluding the leading `artisan` + command), e.g. `['--start=09:00']`. */
  args: string[];
  /** A copy-pasteable, shell-quoted command line, e.g. `php artisan photographers:seed-availability --start=09:00`. */
  commandLine: string;
}

/** Acceptable value types for a single artisan option. */
export type ArtisanOptionValue = string | number | boolean | string[];

/** Documentation for a single option exposed by an artisan command. */
export interface FixtureOptionDoc {
  /** The option flag (without the leading `--`), e.g. `start`. */
  flag: string;
  /** Human-readable description of the option. */
  description: string;
  /** The backend default applied when the option is omitted, when one exists. */
  default?: string;
  /** True for value-less boolean flags (e.g. `--dry-run`, `--weekly`). */
  boolean?: boolean;
  /** True for repeatable array options (e.g. `--role=*`). */
  array?: boolean;
}

/**
 * A documented wrapper over one existing artisan command. The wrapper is metadata-first: it
 * records WHICH command it maps to, WHY (the requirements it arranges), and HOW (its options),
 * and exposes {@link BackendFixture.build} to resolve a concrete {@link ArtisanInvocation}.
 */
export interface BackendFixture<Options> {
  /** Stable key used to look the fixture up in {@link BACKEND_FIXTURES}. */
  key: string;
  /** The backing PHP command class under `backend/app/Console/Commands/`. */
  className: string;
  /** The artisan command signature name, e.g. `photographers:seed-availability`. */
  command: string;
  /** What backend state this fixture arranges. */
  concern: string;
  /** The command's own one-line description, copied from its `$description`. */
  description: string;
  /**
   * The gate category this fixture maps to when routed through the confirmation gate: seeders
   * are `destructive` (they write rows), send/report commands are `message` (they can emit mail
   * or SMS). Domain specs use this to gate the fixture consistently with the rest of the harness.
   */
  kind: StepKind;
  /** Granular requirement clauses this fixture helps arrange. */
  requirements: string[];
  /** Spec modules / domains that rely on this fixture. */
  usedBy: string[];
  /** The options the command accepts (documented for callers). */
  options: FixtureOptionDoc[];
  /** Resolve a concrete {@link ArtisanInvocation}, applying any supplied option overrides. */
  build(options?: Options): ArtisanInvocation;
}

/** The base executable used when rendering the copy-pasteable command line. */
const ARTISAN_BIN = 'php artisan';

/** Shell-quote a single token for the copy-pasteable command line (only when needed). */
function quoteToken(token: string): string {
  if (token.length > 0 && /^[A-Za-z0-9._:=,/@-]+$/.test(token)) {
    return token;
  }
  // Wrap in double quotes and escape embedded quotes/backslashes.
  return `"${token.replace(/(["\\$`])/g, '\\$1')}"`;
}

/**
 * Build raw argv for a set of options. `string`/`number` become `--flag=value`; `true` booleans
 * become a bare `--flag` (and `false`/omitted booleans are dropped); arrays repeat `--flag=value`.
 * Properties whose value is `undefined` are skipped so the backend default applies.
 */
function buildArgs(options: Record<string, ArtisanOptionValue | undefined> = {}): string[] {
  const args: string[] = [];

  for (const [flag, value] of Object.entries(options)) {
    if (value === undefined) {
      continue;
    }

    if (typeof value === 'boolean') {
      if (value) {
        args.push(`--${flag}`);
      }
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        args.push(`--${flag}=${entry}`);
      }
      continue;
    }

    args.push(`--${flag}=${value}`);
  }

  return args;
}

/**
 * Assemble an {@link ArtisanInvocation} from a command name and its raw argv. The `php artisan`
 * binary is kept literal (it contains a space by design); only the command and its args are
 * shell-quoted in the copy-pasteable `commandLine`.
 */
function invocation(command: string, args: string[]): ArtisanInvocation {
  const quoted = [command, ...args].map(quoteToken).join(' ');
  return {
    command,
    args,
    commandLine: `${ARTISAN_BIN} ${quoted}`.trim(),
  };
}

// ---------------------------------------------------------------------------------------------
// Per-fixture option types
// ---------------------------------------------------------------------------------------------

/** Options for `photographers:seed-availability` (recurring availability windows). */
export interface SeedAvailabilityOptions {
  /** Default start time in 24h `HH:mm` (backend default `09:00`). */
  start?: string;
  /** Default end time in 24h `HH:mm` (backend default `17:00`). */
  end?: string;
  /** Comma-separated days, e.g. `mon,tue,wed,thu,fri` (backend default `mon,tue,wed,thu,fri`). */
  days?: string;
}

/** Options for `photographers:seed-blocked-windows` (unavailable blocks). */
export interface SeedBlockedWindowsOptions {
  /** Preview without writing to the database. */
  dryRun?: boolean;
}

/** Options for `photographers:seed-test-addresses` (fixed lat/long photographer addresses). */
export interface SeedTestAddressesOptions {
  /** Preview updates without writing to the database. */
  dryRun?: boolean;
}

/** Options for `photographers:seed-previous-shoot` (one prior scheduled shoot). */
export interface SeedPreviousShootOptions {
  /** Shoot date (backend default `2026-05-08`). */
  date?: string;
  /** Start time in 24h `HH:mm` (backend default `09:00`). */
  time?: string;
  /** Photographer name or numeric ID (backend default `Ethan Cole`). */
  photographer?: string;
  /** Preview without writing to the database. */
  dryRun?: boolean;
}

/** Roles accepted by `onboarding:seed-team` (`--role=*`). */
export type OnboardingSeedRole = 'photographer' | 'salesRep' | 'editing_manager' | 'editor';

/** Options for `onboarding:seed-team` (dashboard onboarding eligibility). */
export interface SeedOnboardingTeamOptions {
  /** Preview without writing to the database. */
  dryRun?: boolean;
  /** Restrict seeding to these roles (defaults to all four when omitted). */
  roles?: OnboardingSeedRole[];
}

/** `cubicasa:register-webhook` takes no options. */
export type RegisterCubiCasaWebhookOptions = Record<string, never>;

/** Options for `cubicasa:resync-pending` (re-fetch non-Ready CubiCasa orders). */
export interface ResyncPendingCubiCasaOptions {
  /** Max shoots per run (backend default `100`). */
  limit?: number;
}

/** Options for `cubicasa:backfill-assets` (ingest deliverables into ShootFile rows). */
export interface BackfillCubiCasaAssetsOptions {
  /** Max shoots to scan (backend default `200`). */
  limit?: number;
  /** Restrict backfill to a single shoot id. */
  shoot?: number;
}

/** Options for `invoices:generate` (weekly invoice generation). */
export interface GenerateInvoicesOptions {
  /** Period start date (required together with `end` unless `weekly` is set). */
  start?: string;
  /** Period end date (required together with `start` unless `weekly` is set). */
  end?: string;
  /** Generate invoices for the last completed week (alternative to `start`/`end`). */
  weekly?: boolean;
  /** Do not send email notifications (prefer this non-charging/non-messaging path in QA). */
  noEmail?: boolean;
}

/** Commands below take no options. */
export type NoOptions = Record<string, never>;

// ---------------------------------------------------------------------------------------------
// Fixture definitions
// ---------------------------------------------------------------------------------------------

/** Availability windows — `photographers:seed-availability` (App\Console\Commands\SeedPhotographerAvailability). */
export const seedPhotographerAvailability: BackendFixture<SeedAvailabilityOptions> = {
  key: 'seedPhotographerAvailability',
  className: 'SeedPhotographerAvailability',
  command: 'photographers:seed-availability',
  concern: 'Availability windows',
  description: 'Ensure every photographer has recurring availability windows',
  kind: 'destructive',
  requirements: ['20.1', '20.2', '9.1', '9.5'],
  usedBy: ['settings', 'calendar-availability'],
  options: [
    { flag: 'start', description: 'Default start time (24h format)', default: '09:00' },
    { flag: 'end', description: 'Default end time (24h format)', default: '17:00' },
    { flag: 'days', description: 'Comma separated days', default: 'mon,tue,wed,thu,fri' },
  ],
  build(options: SeedAvailabilityOptions = {}): ArtisanInvocation {
    return invocation(
      this.command,
      buildArgs({ start: options.start, end: options.end, days: options.days }),
    );
  },
};

/** Blocked windows — `photographers:seed-blocked-windows` (App\Console\Commands\SeedPhotographerBlockedWindows). */
export const seedPhotographerBlockedWindows: BackendFixture<SeedBlockedWindowsOptions> = {
  key: 'seedPhotographerBlockedWindows',
  className: 'SeedPhotographerBlockedWindows',
  command: 'photographers:seed-blocked-windows',
  concern: 'Blocked windows',
  description: 'Seed varied unavailable blocks for photographer availability testing',
  kind: 'destructive',
  requirements: ['20.3', '20.4', '9.1'],
  usedBy: ['settings', 'calendar-availability'],
  options: [{ flag: 'dry-run', description: 'Preview without writing to the database', boolean: true }],
  build(options: SeedBlockedWindowsOptions = {}): ArtisanInvocation {
    return invocation(this.command, buildArgs({ 'dry-run': options.dryRun }));
  },
};

/** Test addresses — `photographers:seed-test-addresses` (App\Console\Commands\SeedPhotographerTestAddresses). */
export const seedPhotographerTestAddresses: BackendFixture<SeedTestAddressesOptions> = {
  key: 'seedPhotographerTestAddresses',
  className: 'SeedPhotographerTestAddresses',
  command: 'photographers:seed-test-addresses',
  concern: 'Test addresses',
  description: 'Seed photographer addresses near 6424 Vale Street, Alexandria, VA for distance testing',
  kind: 'destructive',
  requirements: ['8.1', '8.2', '8.3', '8.4', '8.5'],
  usedBy: ['service-radius'],
  options: [{ flag: 'dry-run', description: 'Preview updates without writing to the database', boolean: true }],
  build(options: SeedTestAddressesOptions = {}): ArtisanInvocation {
    return invocation(this.command, buildArgs({ 'dry-run': options.dryRun }));
  },
};

/** Previous shoot — `photographers:seed-previous-shoot` (App\Console\Commands\SeedPhotographerPreviousShoot). */
export const seedPhotographerPreviousShoot: BackendFixture<SeedPreviousShootOptions> = {
  key: 'seedPhotographerPreviousShoot',
  className: 'SeedPhotographerPreviousShoot',
  command: 'photographers:seed-previous-shoot',
  concern: 'Previous shoot',
  description: 'Seed one scheduled prior shoot for testing distance from previous shoot location in Book Shoot',
  kind: 'destructive',
  requirements: ['12.1', '11.1', '9.2'],
  usedBy: ['shoot-workflow', 'booking-lifecycle'],
  options: [
    { flag: 'date', description: 'Shoot date for the test previous shoot', default: '2026-05-08' },
    { flag: 'time', description: 'Start time in 24-hour format', default: '09:00' },
    { flag: 'photographer', description: 'Photographer name or ID', default: 'Ethan Cole' },
    { flag: 'dry-run', description: 'Preview without writing to the database', boolean: true },
  ],
  build(options: SeedPreviousShootOptions = {}): ArtisanInvocation {
    return invocation(
      this.command,
      buildArgs({
        date: options.date,
        time: options.time,
        photographer: options.photographer,
        'dry-run': options.dryRun,
      }),
    );
  },
};

/** Onboarding blocks — `onboarding:seed-team` (App\Console\Commands\SeedDashboardOnboardingForTeam). */
export const seedDashboardOnboardingForTeam: BackendFixture<SeedOnboardingTeamOptions> = {
  key: 'seedDashboardOnboardingForTeam',
  className: 'SeedDashboardOnboardingForTeam',
  command: 'onboarding:seed-team',
  concern: 'Onboarding blocks',
  description:
    'Apply dashboard onboarding eligibility to existing photographer, salesRep, editing_manager, and editor users.',
  kind: 'destructive',
  requirements: ['5.1', '5.2', '7.1', '7.5'],
  usedBy: ['account-creation', 'profile-completeness'],
  options: [
    { flag: 'dry-run', description: 'Preview without writing to the database', boolean: true },
    {
      flag: 'role',
      description: 'Restrict to these roles (photographer, salesRep, editing_manager, editor)',
      array: true,
    },
  ],
  build(options: SeedOnboardingTeamOptions = {}): ArtisanInvocation {
    return invocation(
      this.command,
      buildArgs({ 'dry-run': options.dryRun, role: options.roles }),
    );
  },
};

/** CubiCasa webhook — `cubicasa:register-webhook` (App\Console\Commands\RegisterCubiCasaWebhookCommand). */
export const registerCubiCasaWebhook: BackendFixture<RegisterCubiCasaWebhookOptions> = {
  key: 'registerCubiCasaWebhook',
  className: 'RegisterCubiCasaWebhookCommand',
  command: 'cubicasa:register-webhook',
  concern: 'CubiCasa webhook',
  description: 'Register the configured CUBICASA_WEBHOOK_URL with CubiCasa via PATCH /companies/webhook.',
  kind: 'message',
  requirements: ['4.8'],
  usedBy: ['cubicasa'],
  options: [],
  build(): ArtisanInvocation {
    return invocation(this.command, []);
  },
};

/** CubiCasa resync — `cubicasa:resync-pending` (App\Console\Commands\ResyncPendingCubiCasaCommand). */
export const resyncPendingCubiCasa: BackendFixture<ResyncPendingCubiCasaOptions> = {
  key: 'resyncPendingCubiCasa',
  className: 'ResyncPendingCubiCasaCommand',
  command: 'cubicasa:resync-pending',
  concern: 'CubiCasa sync',
  description: 'Re-fetch CubiCasa orders for shoots whose status is still pending/fixing/new/draft.',
  kind: 'message',
  requirements: ['4.7'],
  usedBy: ['cubicasa'],
  options: [{ flag: 'limit', description: 'Max shoots per run', default: '100' }],
  build(options: ResyncPendingCubiCasaOptions = {}): ArtisanInvocation {
    return invocation(this.command, buildArgs({ limit: options.limit }));
  },
};

/** CubiCasa backfill — `cubicasa:backfill-assets` (App\Console\Commands\BackfillCubiCasaAssetsCommand). */
export const backfillCubiCasaAssets: BackendFixture<BackfillCubiCasaAssetsOptions> = {
  key: 'backfillCubiCasaAssets',
  className: 'BackfillCubiCasaAssetsCommand',
  command: 'cubicasa:backfill-assets',
  concern: 'CubiCasa sync',
  description: 'Backfill CubiCasa deliverables (PDFs/JPG floors) into ShootFile rows for historical shoots.',
  kind: 'destructive',
  requirements: ['4.7'],
  usedBy: ['cubicasa'],
  options: [
    { flag: 'limit', description: 'Max shoots to scan', default: '200' },
    { flag: 'shoot', description: 'Restrict backfill to a single shoot id' },
  ],
  build(options: BackfillCubiCasaAssetsOptions = {}): ArtisanInvocation {
    return invocation(this.command, buildArgs({ limit: options.limit, shoot: options.shoot }));
  },
};

/** Invoicing — `invoices:generate` (App\Console\Commands\GenerateInvoices). */
export const generateInvoices: BackendFixture<GenerateInvoicesOptions> = {
  key: 'generateInvoices',
  className: 'GenerateInvoices',
  command: 'invoices:generate',
  concern: 'Invoicing/reporting',
  description: 'Generate weekly invoices for photographers and sales reps over a given period',
  kind: 'message',
  requirements: ['18.1'],
  usedBy: ['invoicing-reporting'],
  options: [
    { flag: 'start', description: 'Period start date (with --end)' },
    { flag: 'end', description: 'Period end date (with --start)' },
    { flag: 'weekly', description: 'Generate invoices for the last completed week', boolean: true },
    { flag: 'no-email', description: 'Do not send email notifications (non-messaging path)', boolean: true },
  ],
  build(options: GenerateInvoicesOptions = {}): ArtisanInvocation {
    return invocation(
      this.command,
      buildArgs({
        start: options.start,
        end: options.end,
        weekly: options.weekly,
        'no-email': options.noEmail,
      }),
    );
  },
};

/** Weekly invoice summaries — `messaging:invoice-summaries` (App\Console\Commands\SendWeeklyInvoiceSummaries). */
export const sendWeeklyInvoiceSummaries: BackendFixture<NoOptions> = {
  key: 'sendWeeklyInvoiceSummaries',
  className: 'SendWeeklyInvoiceSummaries',
  command: 'messaging:invoice-summaries',
  concern: 'Invoicing/reporting',
  description: 'Send weekly invoice summaries to clients and reps via automation rules',
  kind: 'message',
  requirements: ['18.1'],
  usedBy: ['invoicing-reporting'],
  options: [],
  build(): ArtisanInvocation {
    return invocation(this.command, []);
  },
};

/** Weekly sales reports — `reports:sales:weekly` (App\Console\Commands\SendWeeklySalesReports). */
export const sendWeeklySalesReports: BackendFixture<NoOptions> = {
  key: 'sendWeeklySalesReports',
  className: 'SendWeeklySalesReports',
  command: 'reports:sales:weekly',
  concern: 'Invoicing/reporting',
  description: 'Send weekly sales reports to all sales reps',
  kind: 'message',
  requirements: ['18.1'],
  usedBy: ['invoicing-reporting'],
  options: [],
  build(): ArtisanInvocation {
    return invocation(this.command, []);
  },
};

/** Payout reports — `payouts:send` (App\Console\Commands\SendPayoutReports). */
export const sendPayoutReports: BackendFixture<NoOptions> = {
  key: 'sendPayoutReports',
  className: 'SendPayoutReports',
  command: 'payouts:send',
  concern: 'Invoicing/reporting',
  description: 'Compile and email weekly payout approvals for reps and photographers.',
  kind: 'message',
  requirements: ['18.1'],
  usedBy: ['invoicing-reporting'],
  options: [],
  build(): ArtisanInvocation {
    return invocation(this.command, []);
  },
};

/** Invoice reminders — `messaging:invoice-reminders` (App\Console\Commands\ProcessInvoiceReminders). */
export const processInvoiceReminders: BackendFixture<NoOptions> = {
  key: 'processInvoiceReminders',
  className: 'ProcessInvoiceReminders',
  command: 'messaging:invoice-reminders',
  concern: 'Invoicing/reporting',
  description: 'Send invoice due and overdue reminders via automation rules',
  kind: 'message',
  requirements: ['18.5', '18.6'],
  usedBy: ['invoicing-reporting'],
  options: [],
  build(): ArtisanInvocation {
    return invocation(this.command, []);
  },
};

/** Payment reminders sweep — `messaging:payment-reminders-sweep` (App\Console\Commands\PaymentRemindersSweep). */
export const paymentRemindersSweep: BackendFixture<NoOptions> = {
  key: 'paymentRemindersSweep',
  className: 'PaymentRemindersSweep',
  command: 'messaging:payment-reminders-sweep',
  concern: 'Invoicing/reporting',
  description: 'Roll the payment-reminder cadence forward for every unpaid, ready-notified shoot',
  kind: 'message',
  requirements: ['18.5', '18.6'],
  usedBy: ['invoicing-reporting'],
  options: [],
  build(): ArtisanInvocation {
    return invocation(this.command, []);
  },
};

// ---------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------

/**
 * The complete, named registry of backend fixtures keyed by fixture key. Each entry maps to an
 * existing artisan command (no new commands are introduced). Domain specs reference fixtures by
 * key to document the exact command + arguments the domain relies on.
 */
export const BACKEND_FIXTURES = {
  seedPhotographerAvailability,
  seedPhotographerBlockedWindows,
  seedPhotographerTestAddresses,
  seedPhotographerPreviousShoot,
  seedDashboardOnboardingForTeam,
  registerCubiCasaWebhook,
  resyncPendingCubiCasa,
  backfillCubiCasaAssets,
  generateInvoices,
  sendWeeklyInvoiceSummaries,
  sendWeeklySalesReports,
  sendPayoutReports,
  processInvoiceReminders,
  paymentRemindersSweep,
} as const;

/** The set of valid fixture keys. */
export type BackendFixtureKey = keyof typeof BACKEND_FIXTURES;

/** All fixtures as a flat list (e.g. for documentation tables or coverage assertions). */
export function listBackendFixtures(): ReadonlyArray<BackendFixture<unknown>> {
  return Object.values(BACKEND_FIXTURES) as ReadonlyArray<BackendFixture<unknown>>;
}

// ---------------------------------------------------------------------------------------------
// Optional, opt-in execution
// ---------------------------------------------------------------------------------------------

/** The result of running an {@link ArtisanInvocation} through an {@link ArtisanRunner}. */
export interface ArtisanResult {
  /** Process exit code, when the runner exposes one. */
  exitCode: number | null;
  /** Captured stdout. */
  stdout: string;
  /** Captured stderr. */
  stderr: string;
}

/**
 * A pluggable executor for an {@link ArtisanInvocation}. The harness does NOT assume a live shell
 * is reachable from Playwright, so execution is always supplied explicitly by the caller (e.g. a
 * CI step that has the Laravel app on PATH, or a stub in tests). When no runner is wired, fixtures
 * are documentation/arrangement only and resolve to inspectable invocations via `build`.
 */
export type ArtisanRunner = (invocation: ArtisanInvocation) => Promise<ArtisanResult>;

/**
 * Resolve a fixture to its invocation and run it through the supplied {@link ArtisanRunner}. This
 * is the single, explicit execution entry point — there is no implicit shelling out.
 */
export async function runFixture<Options>(
  fixture: BackendFixture<Options>,
  runner: ArtisanRunner,
  options?: Options,
): Promise<ArtisanResult> {
  return runner(fixture.build(options));
}
