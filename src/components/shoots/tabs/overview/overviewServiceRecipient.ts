type RecipientSource = Record<string, unknown> | { photographer_id?: unknown; resolved_photographer_id?: unknown; photographer?: unknown };

/** Keep a booked fee's recipient, including an intentionally unassigned fee. */
export function overviewServiceRecipient(
  categoryKey: string, assignments: Record<string, string>, primaryId: string,
  financialOnly: boolean, booked?: RecipientSource,
): string {
  if (Object.hasOwn(assignments, categoryKey)) return assignments[categoryKey];
  if (!financialOnly || !booked) return primaryId;
  const person = booked.photographer && typeof booked.photographer === 'object'
    ? booked.photographer as { id?: unknown } : null;
  const id = Object.hasOwn(booked, 'photographer_id') ? booked.photographer_id : person?.id ?? booked.resolved_photographer_id;
  return id == null ? '' : String(id);
}
