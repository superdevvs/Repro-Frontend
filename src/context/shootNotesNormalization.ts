import type { ApiNotePayload, ApiShoot } from './shootApiTypes';

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const resolveApprovalNotes = (
  shoot: ApiShoot,
  structuredNotes: ApiNotePayload,
): string | undefined => {
  const directApprovalNote =
    toOptionalString(shoot.approval_notes) ||
    toOptionalString(shoot.approvalNotes) ||
    toOptionalString(structuredNotes.approvalNotes) ||
    toOptionalString(structuredNotes.approval_notes);
  if (directApprovalNote) return directApprovalNote;

  const noteValue = shoot.notes;
  if (typeof noteValue !== 'string') return undefined;
  const hasDedicatedNotes = [
    shoot.shoot_notes,
    shoot.photographer_notes,
    shoot.company_notes,
    shoot.editor_notes,
  ].some((value) => Boolean(toOptionalString(value)));
  return hasDedicatedNotes ? toOptionalString(noteValue) : undefined;
};

export const normalizeShootNotes = (shoot: ApiShoot) => {
  const noteValue = shoot.notes;
  const structuredNotes: ApiNotePayload =
    typeof noteValue === 'object' && noteValue !== null ? noteValue as ApiNotePayload : {};
  const approvalNotes = resolveApprovalNotes(shoot, structuredNotes);

  return typeof noteValue === 'string'
    ? {
        shootNotes: shoot.shoot_notes ?? noteValue,
        approvalNotes,
        photographerNotes: shoot.photographer_notes ?? undefined,
        companyNotes: shoot.company_notes ?? undefined,
        editingNotes: shoot.editor_notes ?? undefined,
      }
    : {
        shootNotes: shoot.shoot_notes ?? structuredNotes.shootNotes ?? undefined,
        approvalNotes,
        photographerNotes: shoot.photographer_notes ?? structuredNotes.photographerNotes ?? undefined,
        companyNotes: shoot.company_notes ?? structuredNotes.companyNotes ?? undefined,
        editingNotes: shoot.editor_notes ?? structuredNotes.editingNotes ?? undefined,
      };
};
