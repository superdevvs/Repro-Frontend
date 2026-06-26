import { request as apiRequest, type APIRequestContext } from '@playwright/test';

import type { ConfirmationGate } from './confirmation-gate';
import type { DataFactory } from './data-factory';
import type { EntityTracker } from './entity-tracker';
import type { QaEnv } from './env';
import { PERSONAS, type PersonaSpec } from './personas';

/**
 * Run-id test-data provisioning for the photographer onboarding QA harness.
 *
 * Provisions the EXACT fixed persona set defined in `personas.ts` (Requirement 3) ONCE per run.
 * Each account is suffixed by the run-id data factory (Requirement 1.7), created through the
 * existing super-admin account-creation API (`POST /api/admin/users`, the same call site exercised
 * by `team-onboarding-admin-create.e2e.ts`), and registered with the run-scoped entity tracker as a
 * `QA_Entity` of type `account` (Requirement 3.8) so the cleanup spec can remove it run-scoped.
 *
 * Because creating an account mutates persistent data, provisioning is a `Destructive_Step` and is
 * therefore routed through the {@link ConfirmationGate} (Requirement 2.2). With the gate declined
 * (the read-only default), no account is created and the persona is simply absent from the result.
 *
 * Persona → payload notes:
 * - `photoEditor` / `videoEditor` use the single `editor` role (this codebase does not model
 *   distinct editor account *types*); their lane is arranged at provision time on
 *   `metadata.editing_capabilities` (`['photo']` / `['video']`) per the `personas.ts` note.
 * - Photographer A/B/C carry their `specialties`, `serviceRadiusMiles`, and `availability` on
 *   `metadata` so the deterministic distance/availability/service scenarios have identifiable data
 *   (Requirements 3.3–3.5).
 * - The sales rep persona is OPTIONAL (Requirement 3.7): it is NOT created by {@link TestData.provisionAll}
 *   and is provisioned lazily on demand via {@link TestData.provision}.
 *
 * See design.md "Components and Interfaces → 3. Fixed personas + test-data provisioning".
 */

/** A persona account that was actually provisioned during the run. */
export interface ProvisionedPersona {
  /** The fixed persona key (matches {@link PersonaSpec.key}). */
  key: PersonaSpec['key'];
  /** The created account's backend identifier. */
  id: string | number;
  /** The account email, carrying the run-id suffix (e.g. `client.qa.{RUN_ID}@example.test`). */
  email: string;
  /** The backend role assigned to the account. */
  role: string;
}

/**
 * The test-data provisioner contract.
 *
 * - {@link provisionAll} creates the required (non-optional) persona set once per run, gated, and
 *   tags each created account as a `QA_Entity`.
 * - {@link get} returns a previously provisioned persona by key (or `undefined` if not provisioned,
 *   e.g. the gate declined, or the persona is the optional sales rep that was never requested).
 * - {@link provision} provisions a single persona on demand (used for the optional sales rep), and
 *   is idempotent — a persona already provisioned is returned as-is rather than re-created.
 */
export interface TestData {
  /** Provision every required persona once per run (gated; tags each as a `QA_Entity`). */
  provisionAll(): Promise<ProvisionedPersona[]>;
  /** Look up a previously provisioned persona by key. */
  get(key: PersonaSpec['key']): ProvisionedPersona | undefined;
  /** Provision a single persona on demand (idempotent); returns null when the gate declines. */
  provision(key: PersonaSpec['key']): Promise<ProvisionedPersona | null>;
}

/** Build the `metadata` payload for a persona's account-create call. */
function buildMetadata(persona: PersonaSpec): Record<string, unknown> | undefined {
  const metadata: Record<string, unknown> = {};

  // Editor lane specialization lives on metadata.editing_capabilities (see personas.ts note).
  if (persona.key === 'photoEditor') {
    metadata.editing_capabilities = ['photo'];
  } else if (persona.key === 'videoEditor') {
    metadata.editing_capabilities = ['video'];
  }

  // Photographer attributes carried so distance/service/availability scenarios are deterministic.
  if (persona.specialties) {
    metadata.specialties = persona.specialties;
  }
  if (persona.serviceRadiusMiles !== undefined) {
    metadata.service_radius_miles = persona.serviceRadiusMiles;
  }
  if (persona.availability) {
    metadata.availability = persona.availability;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Create the {@link TestData} provisioner.
 *
 * The provisioner lazily mints its own {@link APIRequestContext} (pinned to `env.apiBaseUrl`) and a
 * super-admin bearer token (via `POST /api/login`, matching `qa-acceptance.e2e.ts`) the first time a
 * persona is provisioned, so construction is side-effect free and read-only by default.
 */
export function createTestData(
  env: QaEnv,
  factory: DataFactory,
  gate: ConfirmationGate,
  tracker: EntityTracker,
): TestData {
  const provisioned = new Map<PersonaSpec['key'], ProvisionedPersona>();
  const byKey = new Map<PersonaSpec['key'], PersonaSpec>(
    PERSONAS.map((persona) => [persona.key, persona]),
  );

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
        `Admin API login failed with ${login.status()} while provisioning QA test data`,
      );
    }
    const body = (await login.json()) as { token?: string };
    if (!body.token) {
      throw new Error('Admin API login did not return a token while provisioning QA test data');
    }
    token = String(body.token);
    return token;
  }

  /** Create a single persona account through the gated, super-admin account-creation API. */
  async function provisionPersona(persona: PersonaSpec): Promise<ProvisionedPersona | null> {
    // Provision once per run: return the already-created account if present (idempotent).
    const existing = provisioned.get(persona.key);
    if (existing) {
      return existing;
    }

    const email = factory.email(persona.baseLabel);
    const name = factory.name(persona.baseLabel);
    const metadata = buildMetadata(persona);

    // Account creation mutates persistent data → route through the confirmation gate (Req 2.2).
    const result = await gate.run<ProvisionedPersona>({
      name: `Provision ${persona.key} account (${email})`,
      kind: 'destructive',
      category: 'account-create',
      action: async () => {
        const ctx = await ensureContext();
        const bearer = await ensureToken();

        const response = await ctx.post('/api/admin/users', {
          headers: {
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json',
          },
          data: {
            name,
            email,
            role: persona.role,
            account_status: 'active',
            ...(metadata ? { metadata } : {}),
          },
        });

        if (response.status() !== 201) {
          throw new Error(
            `Provisioning ${persona.key} failed: POST /api/admin/users returned ${response.status()} — ${await response.text()}`,
          );
        }

        const body = (await response.json()) as { user?: { id: string | number } };
        const id = body.user?.id;
        if (id === undefined || id === null) {
          throw new Error(`Provisioning ${persona.key} did not return a created account id`);
        }

        const account: ProvisionedPersona = { key: persona.key, id, email, role: persona.role };

        // Tag the created account as a QA_Entity for run-scoped cleanup (Req 3.8, 21.1).
        tracker.track('account', id, email);

        return account;
      },
    });

    if (result.status === 'executed' && result.value) {
      provisioned.set(persona.key, result.value);
      return result.value;
    }

    // Gate declined (read-only default) or otherwise not executed → persona is simply absent.
    return null;
  }

  return {
    async provisionAll(): Promise<ProvisionedPersona[]> {
      const created: ProvisionedPersona[] = [];
      for (const persona of PERSONAS) {
        // Optional personas (the sales rep, Req 3.7) are provisioned lazily, not here.
        if (persona.optional) {
          continue;
        }
        const account = await provisionPersona(persona);
        if (account) {
          created.push(account);
        }
      }
      return created;
    },

    get(key: PersonaSpec['key']): ProvisionedPersona | undefined {
      return provisioned.get(key);
    },

    async provision(key: PersonaSpec['key']): Promise<ProvisionedPersona | null> {
      const persona = byKey.get(key);
      if (!persona) {
        throw new Error(`Unknown persona key: ${key}`);
      }
      return provisionPersona(persona);
    },
  };
}
