// Property-based + unit tests for context identity isolation across Role_Contexts.
//
// Feature: photographer-onboarding-qa, Property 11: Context identity isolation.
//
// For any two of the simultaneously authenticated Role_Contexts, each context resolves its own
// authenticated identity independently of the others while all are active. The harness holds up to
// SEVEN independent `BrowserContext` sessions open at once (admin, photographer, client, photo
// editor, video editor, editing manager, sales rep — Req 15.1) and each maintains its own session
// (Req 15.2). The session-distinguishing artifact is the bearer token read from `localStorage`
// after login (see `contexts.ts`): each session carries a DISTINCT token, and resolving a token
// must return exactly the identity it was issued for — never another session's identity (no
// cross-token leakage / no shared-session bleed).
//
// This is a pure/in-memory model of that invariant (no live target). We model a set of role
// sessions each binding a distinct bearer token to an identity, build a resolver
// `resolveIdentity(token)` that returns the bound identity, and assert:
//   - each session resolves its OWN identity (round-trip);
//   - no two DISTINCT sessions resolve the same identity (identities are unique per context);
//   - resolving one session's token NEVER returns another session's identity (isolation).
//
// Validates: Requirements 15.1, 15.2

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

// ── Identity-isolation domain ─────────────────────────────────────────────────────────────────────

/** The fixed Role_Context set held open simultaneously (Req 15.1). */
type RoleKey =
  | 'admin'
  | 'photographer'
  | 'client'
  | 'photoEditor'
  | 'videoEditor'
  | 'editingManager'
  | 'salesRep';

/** The seven Role_Contexts the harness can authenticate concurrently. */
const ROLE_KEYS: readonly RoleKey[] = [
  'admin',
  'photographer',
  'client',
  'photoEditor',
  'videoEditor',
  'editingManager',
  'salesRep',
] as const;

/** The authenticated identity a context resolves to (the account behind its session). */
interface Identity {
  /** Stable account id behind the session. */
  userId: number;
  /** The Role_Context this identity belongs to. */
  role: RoleKey;
}

/**
 * A single authenticated role session. Mirrors `RoleSession` in `contexts.ts`: an isolated context
 * keyed by `role`, carrying the bearer `token` read from its own `localStorage`, bound to `identity`.
 */
interface RoleSession {
  role: RoleKey;
  token: string;
  identity: Identity;
}

/**
 * Build a resolver over a set of concurrently held sessions. `resolveIdentity(token)` returns the
 * identity bound to that token (the account the token was issued for) — exactly how an API request
 * authenticated with a session's bearer token resolves the caller. Returns `undefined` for a token
 * that belongs to no held session.
 *
 * Construction requires every token to be DISTINCT (the precondition the live harness guarantees by
 * reading each context's own `localStorage` token): a duplicate token would make one session's
 * bearer indistinguishable from another's, so we reject it rather than silently let one win.
 */
function buildResolver(sessions: readonly RoleSession[]): (token: string) => Identity | undefined {
  const byToken = new Map<string, Identity>();
  for (const session of sessions) {
    if (byToken.has(session.token)) {
      throw new Error(`Duplicate bearer token across sessions: ${session.token}`);
    }
    byToken.set(session.token, session.identity);
  }
  return (token: string) => byToken.get(token);
}

// ── Generators ──────────────────────────────────────────────────────────────────────────────────

/**
 * Generate a set of `(role, id, token)` sessions with DISTINCT tokens — one per selected
 * Role_Context, covering a non-empty subset of the seven roles (often all seven). Identities are
 * unique per session: a distinct `userId` per role guarantees identities never collide, while
 * distinct tokens are produced by tagging each token with its (unique) role to avoid discards.
 */
const sessionsArb: fc.Arbitrary<RoleSession[]> = fc
  .subarray([...ROLE_KEYS], { minLength: 1 })
  .chain((roles) =>
    fc
      // A distinct base id per selected role (record over the role set → no collisions).
      .record(
        Object.fromEntries(
          roles.map((role) => [role, fc.integer({ min: 1, max: 1_000_000 })]),
        ) as Record<RoleKey, fc.Arbitrary<number>>,
      )
      // A random opaque token body per role; uniqueness is then enforced by the role suffix below.
      .chain((idByRole) =>
        fc
          .record(
            Object.fromEntries(
              roles.map((role) => [role, fc.string({ minLength: 1, maxLength: 24 })]),
            ) as Record<RoleKey, fc.Arbitrary<string>>,
          )
          .map((tokenBodyByRole) =>
            roles.map((role, index) => ({
              role,
              // Suffix with the unique role key so generated tokens are always distinct, while the
              // random body keeps them opaque/realistic. Index keeps ids unique even if the
              // generator picks equal base ids across roles.
              token: `tok_${tokenBodyByRole[role]}_${role}`,
              identity: { userId: idByRole[role] * 7 + index, role },
            })),
          ),
      ),
  );

const TAG = 'Feature: photographer-onboarding-qa, Property 11: Context identity isolation';

// ── Properties ──────────────────────────────────────────────────────────────────────────────────

describe(TAG, () => {
  it('each concurrently-held session resolves its OWN identity (round-trip)', () => {
    fc.assert(
      fc.property(sessionsArb, (sessions) => {
        const resolve = buildResolver(sessions);
        for (const session of sessions) {
          // Resolving a session's own token returns exactly the identity it was issued for.
          expect(resolve(session.token)).toEqual(session.identity);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('no two DISTINCT sessions resolve the same identity (identities are unique per context)', () => {
    fc.assert(
      fc.property(sessionsArb, (sessions) => {
        const resolve = buildResolver(sessions);
        for (let i = 0; i < sessions.length; i += 1) {
          for (let j = i + 1; j < sessions.length; j += 1) {
            const a = resolve(sessions[i].token);
            const b = resolve(sessions[j].token);
            // Two different contexts never collapse onto the same authenticated identity.
            expect(a).not.toEqual(b);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('resolving one session\'s token NEVER returns another session\'s identity (isolation)', () => {
    fc.assert(
      fc.property(sessionsArb, (sessions) => {
        const resolve = buildResolver(sessions);
        for (let i = 0; i < sessions.length; i += 1) {
          const resolved = resolve(sessions[i].token);
          for (let j = 0; j < sessions.length; j += 1) {
            if (i === j) continue;
            // No cross-token leakage: session i's token never surfaces session j's identity.
            expect(resolved).not.toEqual(sessions[j].identity);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('resolution is independent of how many other contexts are active (a subset resolves identically)', () => {
    fc.assert(
      fc.property(sessionsArb, (sessions) => {
        const full = buildResolver(sessions);
        // Drop one session; every remaining session still resolves to its own identity, unchanged
        // by the absence of the dropped context (each context is maintained independently, Req 15.2).
        for (let dropped = 0; dropped < sessions.length; dropped += 1) {
          const subset = sessions.filter((_, index) => index !== dropped);
          const partial = buildResolver(subset);
          for (const session of subset) {
            expect(partial(session.token)).toEqual(full(session.token));
            expect(partial(session.token)).toEqual(session.identity);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ── Concrete examples (the named Req-15 isolation scenarios) ──────────────────────────────────────

describe(`${TAG} — concrete scenarios`, () => {
  /** All seven Role_Contexts authenticated simultaneously, each with a distinct token (Req 15.1). */
  const allSeven: RoleSession[] = ROLE_KEYS.map((role, index) => ({
    role,
    token: `tok_${role}`,
    identity: { userId: 100 + index, role },
  }));

  it('all seven contexts each resolve their own identity', () => {
    const resolve = buildResolver(allSeven);
    for (const session of allSeven) {
      expect(resolve(session.token)).toEqual(session.identity);
    }
  });

  it('the admin token does not resolve to the photographer identity (no cross-context bleed)', () => {
    const resolve = buildResolver(allSeven);
    const admin = allSeven.find((s) => s.role === 'admin')!;
    const photographer = allSeven.find((s) => s.role === 'photographer')!;
    expect(resolve(admin.token)).toEqual(admin.identity);
    expect(resolve(admin.token)).not.toEqual(photographer.identity);
  });

  it('an unknown token resolves to no identity (not silently to a held session)', () => {
    const resolve = buildResolver(allSeven);
    expect(resolve('tok_not_a_real_session')).toBeUndefined();
  });

  it('rejects a duplicate bearer token across two contexts (would make sessions indistinguishable)', () => {
    const collided: RoleSession[] = [
      { role: 'admin', token: 'tok_shared', identity: { userId: 1, role: 'admin' } },
      { role: 'client', token: 'tok_shared', identity: { userId: 2, role: 'client' } },
    ];
    expect(() => buildResolver(collided)).toThrow(/Duplicate bearer token/);
  });
});
