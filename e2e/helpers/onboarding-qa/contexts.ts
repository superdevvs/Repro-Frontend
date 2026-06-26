import { type Browser, type BrowserContext, type Page } from '@playwright/test';

import {
  PHOTO_EDITOR_EMAIL,
  PHOTO_EDITOR_PASSWORD,
  VIDEO_EDITOR_EMAIL,
  VIDEO_EDITOR_PASSWORD,
  loginAsAdmin,
  loginAsEditor,
} from '../auth';
import type { QaEnv } from './env';
import type { PersonaSpec } from './personas';
import type { TestData } from './test-data';

/**
 * Multi-role browser contexts for the photographer onboarding QA harness.
 *
 * Creates up to SEVEN independent Playwright `BrowserContext` sessions within a single run
 * (Requirement 15.1) so the admin, photographer, client, photo editor, video editor, editing
 * manager, and (optionally) sales rep are authenticated simultaneously and maintained
 * independently (Requirement 15.2). Each session authenticates through the shared login helper
 * at `helpers/auth.ts` (Requirement 1.3) and exposes its own page plus the bearer token read from
 * `localStorage` (`authToken` / `token`) — matching the pattern already used by
 * `account-delete-cache-access.e2e.ts` and `qa-acceptance.e2e.ts`. The session's
 * `APIRequestContext` is available as `session.context.request` for API-level assertions, so no
 * separate field is needed.
 *
 * The six non-optional roles are authenticated eagerly when the contexts are created; the sales
 * rep and the alternate photographers (B/C) are authenticated lazily only when a scenario needs
 * them, via {@link RoleContexts.ensureSalesRep} and {@link RoleContexts.asPhotographer}.
 *
 * Credential resolution (per the design's "Technology and conventions"):
 * - `admin` uses the documented `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` (via {@link QaEnv}).
 * - `photoEditor` / `videoEditor` use the lane credentials defined in `helpers/auth.ts`
 *   (`E2E_PHOTO_EDITOR_EMAIL` / `E2E_VIDEO_EDITOR_EMAIL`, etc.), so they work against pre-seeded
 *   editor accounts without requiring provisioning.
 * - Every other role logs in with its provisioned persona email (from {@link TestData}) and the
 *   shared default password (`E2E_DEFAULT_PASSWORD`, defaulting to the admin password — the
 *   suite-wide default of `password`).
 *
 * Documented deviation: `helpers/auth.ts` exports `loginAsAdmin` and the generic `loginAsEditor`
 * (the login form is identical for every role — only the seeded credentials differ). This module
 * therefore uses `loginAsEditor` as the generic email/password login routine for all non-admin
 * roles, including the photographer and client, rather than introducing a new login helper.
 *
 * See design.md "Components and Interfaces → 6. Multi-role contexts (`contexts.ts`)".
 */

/** A single authenticated role session: its context, a ready page, and its bearer token. */
export interface RoleSession {
  /** The isolated browser context for this role (its `request` is the API context). */
  context: BrowserContext;
  /** A page already authenticated and landed on the dashboard for this role. */
  page: Page;
  /** The bearer token read from `localStorage` after login (for API-level assertions). */
  token: string;
}

/** The named photographer personas that {@link RoleContexts.asPhotographer} can authenticate. */
export type PhotographerKey = 'photographerA' | 'photographerB' | 'photographerC';

/**
 * The set of concurrently held role sessions plus lazy accessors for the on-demand roles.
 *
 * The six non-optional sessions are present immediately; `salesRep` is populated only after
 * {@link ensureSalesRep} is called. `asPhotographer` returns Photographer A, B, or C, caching each
 * session so repeated calls reuse the same authenticated context.
 */
export interface RoleContexts {
  /** Admin_Context — authenticated as the super admin (Req 15.1). */
  admin: RoleSession;
  /** Photographer_Context — Photographer A by default (Req 15.1). */
  photographer: RoleSession;
  /** Client_Context (Req 15.1). */
  client: RoleSession;
  /** Photo_Editor_Context — photo-lane editor (Req 15.1). */
  photoEditor: RoleSession;
  /** Video_Editor_Context — video-lane editor (Req 15.1). */
  videoEditor: RoleSession;
  /** Editing_Manager_Context (Req 15.1). */
  editingManager: RoleSession;
  /** Sales_Rep_Context — optional, populated by {@link ensureSalesRep} (Req 3.7, 15.1). */
  salesRep?: RoleSession;
  /** Lazily authenticate a named photographer (A/B/C) when a scenario needs it; cached. */
  asPhotographer(key: PhotographerKey): Promise<RoleSession>;
  /** Lazily provision (if needed) and authenticate the sales rep; cached. */
  ensureSalesRep(): Promise<RoleSession>;
  /** Close every context created by this harness. */
  dispose(): Promise<void>;
}

/** Resolved login credentials for a role. */
interface Credentials {
  email: string;
  password: string;
}

/**
 * Create the multi-role contexts.
 *
 * Eagerly authenticates the six non-optional roles in parallel (so they are held open
 * simultaneously, Req 15.1/15.2) and returns a {@link RoleContexts} with lazy accessors for the
 * optional sales rep and the alternate photographers. Construction throws only if a role's
 * credentials cannot be resolved (e.g. a provisioned persona is missing because the confirmation
 * gate declined account creation) or if login does not yield a bearer token.
 */
export async function createRoleContexts(
  browser: Browser,
  env: QaEnv,
  data: TestData,
): Promise<RoleContexts> {
  // Shared default password for provisioned (non-admin, non-editor-env) accounts. Defaults to the
  // admin password, which itself defaults to the suite-wide `password`, keeping it consistent.
  const defaultPassword = process.env.E2E_DEFAULT_PASSWORD ?? env.adminPassword;

  const openContexts: BrowserContext[] = [];
  const photographerSessions = new Map<PhotographerKey, RoleSession>();
  let salesRepSession: RoleSession | undefined;

  /** Resolve the login credentials for a persona key. */
  function credentialsFor(key: PersonaSpec['key']): Credentials {
    switch (key) {
      case 'admin':
        return { email: env.adminEmail, password: env.adminPassword };
      case 'photoEditor':
        return { email: PHOTO_EDITOR_EMAIL, password: PHOTO_EDITOR_PASSWORD };
      case 'videoEditor':
        return { email: VIDEO_EDITOR_EMAIL, password: VIDEO_EDITOR_PASSWORD };
      default: {
        const persona = data.get(key);
        if (!persona) {
          throw new Error(
            `Cannot authenticate role "${key}": no provisioned account found. Ensure ` +
              `TestData.provisionAll()/provision('${key}') ran (the confirmation gate must allow ` +
              `account creation) before createRoleContexts.`,
          );
        }
        return { email: persona.email, password: defaultPassword };
      }
    }
  }

  /** Read the bearer token from `localStorage`, matching the existing suite's convention. */
  async function readToken(page: Page, key: PersonaSpec['key']): Promise<string> {
    const token = await page.evaluate(
      () => localStorage.getItem('authToken') || localStorage.getItem('token'),
    );
    if (!token) {
      throw new Error(`Login for role "${key}" did not yield an auth token in localStorage`);
    }
    return token;
  }

  /** Open an isolated context, authenticate it through `helpers/auth.ts`, and read its token. */
  async function openSession(key: PersonaSpec['key']): Promise<RoleSession> {
    const { email, password } = credentialsFor(key);
    const context = await browser.newContext({ baseURL: env.baseUrl });
    openContexts.push(context);

    const page = await context.newPage();
    // The login form is identical for every role; `admin` uses the dedicated helper and every
    // other role uses the generic email/password login routine (see module deviation note).
    if (key === 'admin') {
      await loginAsAdmin(page, email, password);
    } else {
      await loginAsEditor(page, email, password);
    }

    const token = await readToken(page, key);
    return { context, page, token };
  }

  // Authenticate the six non-optional roles simultaneously (Req 15.1/15.2). Photographer A is the
  // default Photographer_Context.
  const [admin, photographer, client, photoEditor, videoEditor, editingManager] = await Promise.all(
    [
      openSession('admin'),
      openSession('photographerA'),
      openSession('client'),
      openSession('photoEditor'),
      openSession('videoEditor'),
      openSession('editingManager'),
    ],
  );

  // The default photographer is Photographer A — cache it so asPhotographer('photographerA')
  // reuses the same authenticated context.
  photographerSessions.set('photographerA', photographer);

  const contexts: RoleContexts = {
    admin,
    photographer,
    client,
    photoEditor,
    videoEditor,
    editingManager,
    salesRep: undefined,

    async asPhotographer(key: PhotographerKey): Promise<RoleSession> {
      const existing = photographerSessions.get(key);
      if (existing) {
        return existing;
      }
      const session = await openSession(key);
      photographerSessions.set(key, session);
      return session;
    },

    async ensureSalesRep(): Promise<RoleSession> {
      if (salesRepSession) {
        return salesRepSession;
      }
      // The sales rep is an OPTIONAL persona (Req 3.7) — provision it lazily if it was not already
      // created by an earlier scenario. Provisioning is gated; if it declines, credentialsFor will
      // surface a clear error rather than authenticating a non-existent account.
      if (!data.get('salesRep')) {
        await data.provision('salesRep');
      }
      salesRepSession = await openSession('salesRep');
      contexts.salesRep = salesRepSession;
      return salesRepSession;
    },

    async dispose(): Promise<void> {
      await Promise.all(openContexts.map((context) => context.close()));
    },
  };

  return contexts;
}
