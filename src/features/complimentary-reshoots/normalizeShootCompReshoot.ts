import type {
  ShootData,
  ShootReshootLineageSummary,
  ShootReshootServiceLink,
} from '@/types/shoots';

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : [];

const normalizeLineageSummary = (value: unknown): ShootReshootLineageSummary | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number') return { id: value };
  const record = asRecord(value);
  const id = record.id ?? record.shoot_id ?? record.shootId;
  if (id === null || id === undefined || id === '') return null;
  const scheduledAt = record.scheduled_at ?? record.scheduledAt;
  const scheduledDate = record.scheduled_date ?? record.scheduledDate;
  const fullAddress = record.full_address ?? record.fullAddress;
  const reasonCode = record.reason_code ?? record.reasonCode;
  const affectedServiceNames = stringArray(
    record.affected_service_names ?? record.affectedServiceNames,
  );

  return {
    id: String(id),
    address: typeof record.address === 'string' ? record.address : null,
    fullAddress: typeof fullAddress === 'string' ? fullAddress : null,
    full_address: typeof fullAddress === 'string' ? fullAddress : null,
    scheduledAt: typeof scheduledAt === 'string' ? scheduledAt : null,
    scheduled_at: typeof scheduledAt === 'string' ? scheduledAt : null,
    scheduledDate: typeof scheduledDate === 'string' ? scheduledDate : null,
    scheduled_date: typeof scheduledDate === 'string' ? scheduledDate : null,
    shootType: typeof (record.shoot_type ?? record.shootType) === 'string'
      ? String(record.shoot_type ?? record.shootType)
      : null,
    classification: typeof record.classification === 'string' ? record.classification : null,
    status: typeof record.status === 'string' ? record.status : null,
    reasonCode: typeof reasonCode === 'string' ? reasonCode : null,
    reason_code: typeof reasonCode === 'string' ? reasonCode : null,
    reasonCodes: stringArray(record.reason_codes ?? record.reasonCodes),
    reason_codes: stringArray(record.reason_codes ?? record.reasonCodes),
    affectedServiceNames,
    affected_service_names: affectedServiceNames,
  };
};

const normalizeServiceLink = (value: unknown): ShootReshootServiceLink | null => {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return null;
  const sourceService = asRecord(record.source_service ?? record.sourceService);
  const childId = record.shoot_service_id
    ?? record.shootServiceId
    ?? record.reshoot_shoot_service_id
    ?? record.reshootShootServiceId;
  const sourceId = record.source_shoot_service_id ?? record.sourceShootServiceId;
  const sourceName = record.source_service_name
    ?? record.sourceServiceName
    ?? sourceService.name;
  return {
    ...(record as ShootReshootServiceLink),
    reshoot_shoot_service_id: childId as string | number | null | undefined,
    reshootShootServiceId: childId as string | number | null | undefined,
    source_shoot_service_id: sourceId as string | number | null | undefined,
    sourceShootServiceId: sourceId as string | number | null | undefined,
    source_service_name: typeof sourceName === 'string' ? sourceName : null,
    sourceServiceName: typeof sourceName === 'string' ? sourceName : null,
    source_service: Object.keys(sourceService).length
      ? {
          id: sourceService.id as string | number | null | undefined,
          name: typeof sourceService.name === 'string' ? sourceService.name : null,
        }
      : null,
  };
};

export type NormalizedShootCompReshootFields = {
  reshootParent: ShootData['reshootParent'];
  reshootRoot: ShootData['reshootRoot'];
  reshootChildren: NonNullable<ShootData['reshootChildren']>;
  reshootReasonCode: string | null;
  reshootReasonNote: string | null;
  reshootServiceLinks: NonNullable<ShootData['reshootServiceLinks']>;
  compensationSummary: Record<string, unknown> | null;
};

export function normalizeShootCompReshootFields(
  shoot: Record<string, unknown>,
): NormalizedShootCompReshootFields {
  const reshootSummary = asRecord(shoot.reshoot_summary ?? shoot.reshootSummary);
  const complimentaryOverview = asRecord(
    shoot.complimentary_reshoot_overview ?? shoot.complimentaryReshootOverview,
  );
  const reshootParent = normalizeLineageSummary(
    shoot.reshoot_parent ?? shoot.reshootParent ?? shoot.reshoot_of_shoot_id ?? shoot.reshootOfShootId,
  );
  const reshootRoot = normalizeLineageSummary(
    shoot.reshoot_root ?? shoot.reshootRoot ?? shoot.root_shoot_id ?? shoot.rootShootId,
  );
  const lineageCandidates = [
    shoot.reshoot_children ?? shoot.reshootChildren,
    shoot.complimentary_reshoots ?? shoot.complimentaryReshoots,
    reshootSummary.related_reshoots,
  ];
  const rawChildren = lineageCandidates.find(
    (candidate): candidate is unknown[] => Array.isArray(candidate) && candidate.length > 0,
  ) ?? [];
  const reshootChildren = (rawChildren as unknown[])
    .map(normalizeLineageSummary)
    .filter((value): value is ShootReshootLineageSummary => Boolean(value));
  const rawLinks = Array.isArray(shoot.reshoot_service_links ?? shoot.reshootServiceLinks)
    ? shoot.reshoot_service_links ?? shoot.reshootServiceLinks
    : Array.isArray(shoot.affected_source_items)
      ? shoot.affected_source_items
      : [];
  const reshootServiceLinks = (rawLinks as unknown[])
    .map(normalizeServiceLink)
    .filter((value): value is ShootReshootServiceLink => Boolean(value));

  return {
    reshootParent,
    reshootRoot,
    reshootChildren,
    reshootReasonCode: String(
      shoot.reshoot_reason_code ?? shoot.reshootReasonCode ?? complimentaryOverview.reason_code ?? '',
    ) || null,
    reshootReasonNote: String(shoot.reshoot_reason_note ?? shoot.reshootReasonNote ?? '') || null,
    reshootServiceLinks,
    compensationSummary: (shoot.compensation_summary
      ?? shoot.compensationSummary
      ?? (Object.keys(complimentaryOverview).length ? complimentaryOverview : null)) as Record<string, unknown> | null,
  };
}
