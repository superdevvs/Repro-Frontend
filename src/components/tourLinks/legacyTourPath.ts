export type LegacyTourIdentity = { companyId: string; sourceId: string; audience: 'branded' | 'mls' };

/** Address slugs changed between ViewShoot versions; the final IDs are stable. */
export function parseLegacyTourPath(pathname: string): LegacyTourIdentity | null {
  const match = /^\/tour\/(MLS\/)?[^/]+_([0-9]{1,20})_([0-9]{1,20})\.html$/.exec(pathname);
  if (!match) return null;
  return { audience: match[1] ? 'mls' : 'branded', companyId: match[2], sourceId: match[3] };
}

export function legacyTourQuery(identity: LegacyTourIdentity): string {
  return new URLSearchParams({ legacyCompanyId: identity.companyId, legacyShootId: identity.sourceId }).toString();
}
