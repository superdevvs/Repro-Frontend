// Property-based + unit tests for role-access denial across Role_Contexts.
//
// Feature: photographer-onboarding-qa, Property 5: Role-access denial across Role_Contexts.
//
// For any Role_Context (admin, photographer, client, photo editor, video editor, editing manager,
// sales rep) and any page/action/resource restricted to roles that context does NOT hold,
// navigating to or invoking it yields an access-denied result rather than the protected content or
// effect. Equivalently: access is granted ONLY when the role is authorized — it owns the resource
// (assigned photographer / owning client), holds the matching editor lane, or is a broad role
// (admin / editing manager) — and is DENIED for every unauthorized combination.
//
// This is a pure/in-memory property test (no live target). It encodes the access matrix derived
// from the codebase rules verified by `negative-permissions.e2e.ts`:
//   - 16.1  A photographer can reach a shoot's protected content only when assigned to it
//           (shoot.photographerId === actor.id); a foreign photographer is denied.
//   - 16.3  A client can reach a shoot only when it owns it (shoot.clientId === actor.id); a
//           foreign client is denied.
//   - 16.4  An editor can never view a hidden extra (drone / floor-plan / 3D / staging).
//   - 16.5  A photo-lane editor is denied a video-only job (lane mismatch).
//   - 16.6  A video-lane editor is denied a photo-only job (lane mismatch).
// Broad roles (admin, editing manager) are authorized; a sales rep holds no authorization over
// shoot content or hidden extras.
//
// Validates: Requirements 16.1, 16.3, 16.4, 16.5, 16.6, 23.5

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

// ── Authorization domain ────────────────────────────────────────────────────────────────────────

/** The fixed Role_Context set (Req 3 / 15). `editor` carries a lane (photo|video). */
type Role = 'admin' | 'photographer' | 'client' | 'editor' | 'editing_manager' | 'salesRep';

/** Editor lane carried on `users.metadata.editing_capabilities` (photo and/or video). */
type Lane = 'photo' | 'video';

/** A logged-in Role_Context attempting access. `id` is the identity used for ownership checks;
 *  `lane` is only meaningful for an `editor`. */
interface Actor {
  role: Role;
  id: number;
  lane: Lane;
}

/** A protected resource. `shootFiles` is a shoot's protected content; `hiddenExtra` is a
 *  non-editing extra attached to the shoot. The shoot is assigned to `photographerId`, owned by
 *  `clientId`, and is a single-lane job (`lane`). */
interface Resource {
  kind: 'shootFiles' | 'hiddenExtra';
  photographerId: number;
  clientId: number;
  lane: Lane;
}

/**
 * The authorization model under test (`canAccess`). Structured by RESOURCE KIND, mirroring the
 * backend's per-endpoint gating contract:
 *   - shoot files  → `canAccessShootMedia` (assigned photographer / owning client / matching-lane
 *                     editor / broad roles).
 *   - hidden extra → excluded from the editor payload entirely; only the owner roles + broad roles.
 */
function canAccess(actor: Actor, resource: Resource): boolean {
  switch (resource.kind) {
    case 'shootFiles':
      switch (actor.role) {
        case 'admin':
        case 'editing_manager':
          return true; // broad roles
        case 'photographer':
          return actor.id === resource.photographerId; // 16.1: only the assigned photographer
        case 'client':
          return actor.id === resource.clientId; // 16.3: only the owning client
        case 'editor':
          return actor.lane === resource.lane; // 16.5 / 16.6: only the matching lane
        case 'salesRep':
          return false; // no authorization over shoot content
        default:
          return false;
      }
    case 'hiddenExtra':
      switch (actor.role) {
        case 'admin':
        case 'editing_manager':
          return true; // broad roles
        case 'photographer':
          return actor.id === resource.photographerId;
        case 'client':
          return actor.id === resource.clientId;
        case 'editor':
          return false; // 16.4: an editor can NEVER view a hidden extra
        case 'salesRep':
          return false;
        default:
          return false;
      }
    default:
      return false;
  }
}

/**
 * Independent declarative reference for the SAME access matrix, structured by ROLE (not by resource
 * kind). Kept deliberately separate from `canAccess` so the equivalence property catches any drift
 * between the two encodings rather than restating one of them.
 */
function expectedAccess(actor: Actor, resource: Resource): boolean {
  // Broad roles are always authorized.
  if (actor.role === 'admin' || actor.role === 'editing_manager') {
    return true;
  }
  // A sales rep holds no authorization over shoot content or hidden extras.
  if (actor.role === 'salesRep') {
    return false;
  }
  // A photographer is authorized only for a shoot assigned to them.
  if (actor.role === 'photographer') {
    return actor.id === resource.photographerId;
  }
  // A client is authorized only for a shoot it owns.
  if (actor.role === 'client') {
    return actor.id === resource.clientId;
  }
  // An editor is never authorized for a hidden extra, and for shoot files only on a matching lane.
  if (actor.role === 'editor') {
    return resource.kind === 'hiddenExtra' ? false : actor.lane === resource.lane;
  }
  return false;
}

// ── Generators ──────────────────────────────────────────────────────────────────────────────────

const roleArb: fc.Arbitrary<Role> = fc.constantFrom(
  'admin',
  'photographer',
  'client',
  'editor',
  'editing_manager',
  'salesRep',
);
const laneArb: fc.Arbitrary<Lane> = fc.constantFrom('photo', 'video');

/**
 * A SMALL identity pool (1..4) so generated (actor, resource) pairs frequently produce BOTH
 * matching-owner and foreign-owner combinations — the foreign-owner / wrong-lane space the
 * property must cover is exercised densely rather than vanishingly.
 */
const idArb = fc.integer({ min: 1, max: 4 });

const actorArb: fc.Arbitrary<Actor> = fc.record({ role: roleArb, id: idArb, lane: laneArb });
const resourceArb: fc.Arbitrary<Resource> = fc.record({
  kind: fc.constantFrom('shootFiles', 'hiddenExtra'),
  photographerId: idArb,
  clientId: idArb,
  lane: laneArb,
});

/** A distinct ordered id pair `[owner, foreign]` with `foreign !== owner` (no discards). */
const distinctIdPairArb = fc
  .tuple(idArb, fc.integer({ min: 1, max: 3 }))
  .map(([owner, offset]) => {
    const foreign = ((owner - 1 + offset) % 4) + 1; // wraps within 1..4, always differs
    return { owner, foreign };
  });

const TAG =
  'Feature: photographer-onboarding-qa, Property 5: Role-access denial across Role_Contexts';

// ── Properties ──────────────────────────────────────────────────────────────────────────────────

describe(TAG, () => {
  it('grants access if and only if the role is authorized (owns / matching lane / broad) — denied otherwise', () => {
    fc.assert(
      fc.property(actorArb, resourceArb, (actor, resource) => {
        // The model agrees with the independently-encoded access matrix across the whole space:
        // TRUE exactly when authorized, FALSE (denied) for every unauthorized combination.
        expect(canAccess(actor, resource)).toBe(expectedAccess(actor, resource));
      }),
      { numRuns: 200 },
    );
  });

  it('16.1 — a photographer is denied another photographer\'s shoot (foreign owner)', () => {
    fc.assert(
      fc.property(distinctIdPairArb, fc.constantFrom<Resource['kind']>('shootFiles', 'hiddenExtra'), laneArb, idArb, (pair, kind, lane, clientId) => {
        const resource: Resource = { kind, photographerId: pair.owner, clientId, lane };
        const foreignPhotographer: Actor = { role: 'photographer', id: pair.foreign, lane };
        const assignedPhotographer: Actor = { role: 'photographer', id: pair.owner, lane };

        // A photographer NOT assigned to the shoot is denied its protected content.
        expect(canAccess(foreignPhotographer, resource)).toBe(false);
        // The assigned photographer is granted (authorization is owner-scoped, not blanket-denied).
        expect(canAccess(assignedPhotographer, resource)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('16.3 — a client is denied another client\'s shoot (foreign owner)', () => {
    fc.assert(
      fc.property(distinctIdPairArb, fc.constantFrom<Resource['kind']>('shootFiles', 'hiddenExtra'), laneArb, idArb, (pair, kind, lane, photographerId) => {
        const resource: Resource = { kind, photographerId, clientId: pair.owner, lane };
        const foreignClient: Actor = { role: 'client', id: pair.foreign, lane };
        const owningClient: Actor = { role: 'client', id: pair.owner, lane };

        // A client that does not own the shoot is denied.
        expect(canAccess(foreignClient, resource)).toBe(false);
        // The owning client is granted.
        expect(canAccess(owningClient, resource)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('16.4 — an editor is denied a hidden extra regardless of lane or shoot', () => {
    fc.assert(
      fc.property(laneArb, laneArb, idArb, idArb, (editorLane, shootLane, photographerId, clientId) => {
        const hiddenExtra: Resource = { kind: 'hiddenExtra', photographerId, clientId, lane: shootLane };
        const editor: Actor = { role: 'editor', id: 1, lane: editorLane };

        // An editor can never view a hidden (non-editing) extra, even on the matching lane.
        expect(canAccess(editor, hiddenExtra)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it('16.5 / 16.6 — an editor is denied a job outside its lane (photo↔video mismatch)', () => {
    fc.assert(
      fc.property(laneArb, idArb, idArb, (jobLane, photographerId, clientId) => {
        const job: Resource = { kind: 'shootFiles', photographerId, clientId, lane: jobLane };
        const otherLane: Lane = jobLane === 'photo' ? 'video' : 'photo';

        const matchingEditor: Actor = { role: 'editor', id: 1, lane: jobLane };
        const wrongLaneEditor: Actor = { role: 'editor', id: 1, lane: otherLane };

        // 16.5: a photo editor denied a video-only job; 16.6: a video editor denied a photo-only job.
        expect(canAccess(wrongLaneEditor, job)).toBe(false);
        // The matching-lane editor is granted (lane authorization, not blanket denial).
        expect(canAccess(matchingEditor, job)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('a sales rep is denied every shoot resource (holds no shoot-content authorization)', () => {
    fc.assert(
      fc.property(resourceArb, laneArb, idArb, (resource, lane, id) => {
        const salesRep: Actor = { role: 'salesRep', id, lane };
        expect(canAccess(salesRep, resource)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it('broad roles (admin, editing manager) are granted every shoot resource', () => {
    fc.assert(
      fc.property(fc.constantFrom<Role>('admin', 'editing_manager'), resourceArb, laneArb, idArb, (role, resource, lane, id) => {
        expect(canAccess({ role, id, lane }, resource)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});

// ── Concrete examples (the named Req-16 denial scenarios) ─────────────────────────────────────────

describe(`${TAG} — concrete scenarios`, () => {
  it('cross-photographer: photographer #2 denied photographer #1\'s shoot files (16.1)', () => {
    const shoot: Resource = { kind: 'shootFiles', photographerId: 1, clientId: 1, lane: 'photo' };
    expect(canAccess({ role: 'photographer', id: 2, lane: 'photo' }, shoot)).toBe(false);
    expect(canAccess({ role: 'photographer', id: 1, lane: 'photo' }, shoot)).toBe(true);
  });

  it('cross-client: client #2 denied client #1\'s shoot (16.3)', () => {
    const shoot: Resource = { kind: 'shootFiles', photographerId: 1, clientId: 1, lane: 'photo' };
    expect(canAccess({ role: 'client', id: 2, lane: 'photo' }, shoot)).toBe(false);
    expect(canAccess({ role: 'client', id: 1, lane: 'photo' }, shoot)).toBe(true);
  });

  it('hidden extra: a photo editor is denied a hidden extra (16.4)', () => {
    const extra: Resource = { kind: 'hiddenExtra', photographerId: 1, clientId: 1, lane: 'photo' };
    expect(canAccess({ role: 'editor', id: 9, lane: 'photo' }, extra)).toBe(false);
  });

  it('photo-editor ↔ video-only job: photo editor denied a video job (16.5)', () => {
    const videoJob: Resource = { kind: 'shootFiles', photographerId: 1, clientId: 1, lane: 'video' };
    expect(canAccess({ role: 'editor', id: 9, lane: 'photo' }, videoJob)).toBe(false);
  });

  it('video-editor ↔ photo-only job: video editor denied a photo job (16.6)', () => {
    const photoJob: Resource = { kind: 'shootFiles', photographerId: 1, clientId: 1, lane: 'photo' };
    expect(canAccess({ role: 'editor', id: 9, lane: 'video' }, photoJob)).toBe(false);
  });

  it('matching-lane editor is granted its own lane job (authorization is lane-scoped)', () => {
    const photoJob: Resource = { kind: 'shootFiles', photographerId: 1, clientId: 1, lane: 'photo' };
    expect(canAccess({ role: 'editor', id: 9, lane: 'photo' }, photoJob)).toBe(true);
  });
});
