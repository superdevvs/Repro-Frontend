/**
 * Fixed personas for the photographer onboarding QA harness.
 *
 * Defines the EXACT persona set required by Requirement 3 as pure, declarative data. This module
 * intentionally contains NO provisioning logic — creating the accounts, suffixing them with the
 * run id, routing creation through the confirmation gate, and registering each as a `QA_Entity`
 * is the responsibility of `test-data.ts` (which consumes {@link PERSONAS}).
 *
 * The fixed set (Requirements 3.1–3.7):
 * - `admin`          — `admin.qa`, the Admin_Context account (Req 3.1)
 * - `client`         — `client.qa` → `client.qa.{RUN_ID}@example.test`, the Client_Context (Req 3.2)
 * - `photographerA`  — inside-radius: HDR, Floor Plan, Drone; radius 25mi; Mon–Fri 09:00–17:00 (Req 3.3)
 * - `photographerB`  — outside-radius: radius 5mi (Req 3.4)
 * - `photographerC`  — wrong-specialty: Video only (Req 3.5)
 * - `photoEditor`    — photo-lane editor (Req 3.6)
 * - `videoEditor`    — video-lane editor (Req 3.6)
 * - `editingManager` — editing manager (Req 3.6)
 * - `salesRep`       — optional, created only when a scenario requires it (Req 3.7)
 *
 * Role-string convention (matches the existing suite):
 * The Dashboard does NOT model distinct `photo_editor` / `video_editor` account *types*. As
 * documented in `helpers/auth.ts`, there is a single `editor` role (plus `editing_manager`) and
 * lane specialization is carried on `users.metadata.editing_capabilities` (an array containing
 * `photo` and/or `video`). The `photoEditor` and `videoEditor` personas therefore both use the
 * `editor` role; their distinct lanes are arranged by `test-data.ts` at provision time and are
 * not encoded on the (fixed) {@link PersonaSpec} shape below.
 *
 * See design.md "Components and Interfaces → 3. Fixed personas + test-data provisioning".
 */

/**
 * Declarative specification for a single fixed QA persona.
 *
 * `baseLabel` is the un-suffixed base value; the run-id data factory appends the `E2E_QA_RUN_ID`
 * suffix at provision time (e.g. `client.qa` → `client.qa.{RUN_ID}@example.test`). The optional
 * fields describe persona-specific attributes used by the distance, service-match, and
 * availability scenarios.
 */
export interface PersonaSpec {
  /** Stable persona key used by the harness to look up a provisioned account. */
  key:
    | 'admin'
    | 'client'
    | 'photographerA'
    | 'photographerB'
    | 'photographerC'
    | 'photoEditor'
    | 'videoEditor'
    | 'editingManager'
    | 'salesRep';
  /** Backend role assigned to the account (e.g. `photographer`, `editor`, `editing_manager`). */
  role: string;
  /** Un-suffixed base label; suffixed by the data factory at provision time. */
  baseLabel: string;
  /** Service_Specialties the photographer can perform (e.g. `['HDR','Floor Plan','Drone']`). */
  specialties?: string[];
  /** Configured Service_Radius in miles (Photographer A = 25, Photographer B = 5). */
  serviceRadiusMiles?: number;
  /** Recurring availability window (Photographer A: Mon–Fri 09:00–17:00). */
  availability?: { days: string[]; start: string; end: string };
  /** True when the persona is created only on demand (the sales rep, Req 3.7). */
  optional?: boolean;
}

/**
 * The fixed persona set required by Requirements 3.1–3.7.
 *
 * Order is meaningful only for readability; the harness selects personas by `key`.
 */
export const PERSONAS: PersonaSpec[] = [
  // Req 3.1 — admin account identified as `admin.qa` for the Admin_Context.
  {
    key: 'admin',
    role: 'admin',
    baseLabel: 'admin.qa',
  },

  // Req 3.2 — client account `client.qa.{RUN_ID}@example.test` for the Client_Context.
  {
    key: 'client',
    role: 'client',
    baseLabel: 'client.qa',
  },

  // Req 3.3 — Photographer A: inside-radius, HDR/Floor Plan/Drone, radius 25mi,
  // available Monday–Friday 09:00–17:00.
  {
    key: 'photographerA',
    role: 'photographer',
    baseLabel: 'photographer.a',
    specialties: ['HDR', 'Floor Plan', 'Drone'],
    serviceRadiusMiles: 25,
    availability: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:00', end: '17:00' },
  },

  // Req 3.4 — Photographer B: outside-radius, Service_Radius 5mi.
  {
    key: 'photographerB',
    role: 'photographer',
    baseLabel: 'photographer.b',
    serviceRadiusMiles: 5,
  },

  // Req 3.5 — Photographer C: wrong-specialty, Video Service_Specialty only.
  {
    key: 'photographerC',
    role: 'photographer',
    baseLabel: 'photographer.c',
    specialties: ['Video'],
  },

  // Req 3.6 — photo editor (photo lane on `editing_capabilities`).
  {
    key: 'photoEditor',
    role: 'editor',
    baseLabel: 'photo.editor',
  },

  // Req 3.6 — video editor (video lane on `editing_capabilities`).
  {
    key: 'videoEditor',
    role: 'editor',
    baseLabel: 'video.editor',
  },

  // Req 3.6 — editing manager.
  {
    key: 'editingManager',
    role: 'editing_manager',
    baseLabel: 'editing.manager',
  },

  // Req 3.7 — sales rep, created only when a scenario requires it.
  {
    key: 'salesRep',
    role: 'salesRep',
    baseLabel: 'sales.rep',
    optional: true,
  },
];
