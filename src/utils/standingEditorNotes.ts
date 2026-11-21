/** Pure types and parsers for standing editor notes (no API client, safe for normalizers). */

export type StandingEditorNoteScope = 'client' | 'brokerage';

/** A standing note as it applies to a shoot or client. */
export interface StandingEditorNote {
  id: number;
  scope: StandingEditorNoteScope;
  client_id: number | null;
  company_match: string | null;
  /** "Weichert brokerage" or "This client". */
  label: string;
  content: string;
  updated_at: string | null;
}

/** A row in the Settings list / account form, with management details. */
export interface StandingEditorNoteRow extends StandingEditorNote {
  is_active: boolean;
  client_name: string | null;
  updated_by_name: string | null;
  matched_count?: number;
}

/** What a shoot payload carries under `standing_editor_notes`. */
export interface ShootStandingEditorNotes {
  hidden: boolean;
  frozen: boolean;
  notes: StandingEditorNote[];
}

export interface ClientStandingEditorNotes {
  client: { id: number; name: string; company_name: string | null };
  client_note: StandingEditorNoteRow | null;
  applicable: StandingEditorNote[];
}

export interface CompanyMatchResult {
  count: number;
  clients: Array<{ id: number; name: string; company_name: string | null }>;
}

export interface SaveStandingEditorNoteInput {
  scope: StandingEditorNoteScope;
  client_id?: number;
  company_match?: string;
  content: string;
  is_active?: boolean;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseNote = (value: unknown): StandingEditorNote | null => {
  if (!isRecord(value) || typeof value.id !== 'number' || typeof value.content !== 'string') return null;
  const scope = value.scope === 'brokerage' ? 'brokerage' : 'client';
  return {
    id: value.id,
    scope,
    client_id: typeof value.client_id === 'number' ? value.client_id : null,
    company_match: typeof value.company_match === 'string' ? value.company_match : null,
    label: typeof value.label === 'string' ? value.label : scope === 'brokerage' ? 'Brokerage' : 'This client',
    content: value.content,
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : null,
  };
};

export const parseStandingEditorNoteRow = (value: unknown): StandingEditorNoteRow | null => {
  const note = parseNote(value);
  if (!note || !isRecord(value)) return null;
  return {
    ...note,
    is_active: value.is_active !== false,
    client_name: typeof value.client_name === 'string' ? value.client_name : null,
    updated_by_name: typeof value.updated_by_name === 'string' ? value.updated_by_name : null,
    matched_count: typeof value.matched_count === 'number' ? value.matched_count : undefined,
  };
};

export const parseStandingEditorNotes = (value: unknown): StandingEditorNote[] =>
  Array.isArray(value) ? value.map(parseNote).filter((note): note is StandingEditorNote => note !== null) : [];

/** Reads `standing_editor_notes` from any shoot-shaped payload; null when absent. */
export function parseShootStandingEditorNotes(value: unknown): ShootStandingEditorNotes | null {
  if (!isRecord(value)) return null;
  return {
    hidden: value.hidden === true,
    frozen: value.frozen === true,
    notes: parseStandingEditorNotes(value.notes),
  };
}

/** Admins, superadmins and sales reps write standing notes; editing managers read them. */
export const canManageStandingEditorNotes = (role?: string | null): boolean =>
  ['admin', 'superadmin', 'salesRep', 'sales_rep', 'rep', 'representative'].includes(String(role ?? ''));

export const canReadStandingEditorNotes = (role?: string | null): boolean =>
  canManageStandingEditorNotes(role) || role === 'editing_manager';

/** "Weichert, Realtors – Cherry Hill" -> "Weichert": a sensible first keyword. */
export function suggestCompanyKeyword(companyName?: string | null): string {
  const first = String(companyName ?? '').trim().split(/[\s,–-]+/)[0] ?? '';
  return first.replace(/[^\p{L}\p{N}&'.]/gu, '');
}
