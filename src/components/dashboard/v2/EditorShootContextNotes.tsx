import type { DashboardShootSummary } from '@/types/dashboard';

/** Read-only context authorized for the current editor's assignment. */
export function EditorShootContextNotes({ shoot }: { shoot: DashboardShootSummary }) {
  const companyNotes = shoot.canViewVideoEditorContext ? shoot.companyNotes?.trim() : '';
  const standingNotes = shoot.standingEditorNotes && !shoot.standingEditorNotes.hidden
    ? shoot.standingEditorNotes.notes.filter((note) => note.content.trim())
    : [];
  if (!companyNotes && !shoot.editorNotes?.trim() && standingNotes.length === 0) return null;

  return <div className="-mx-5 -mb-3.5 mt-3 space-y-2 border-t border-purple-500/20 bg-purple-500/15 px-5 py-2 text-[11px] leading-relaxed text-foreground sm:-mb-5 sm:mt-4">
    {standingNotes.map((note) => <p key={note.id} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]" data-testid="editor-standing-note">
      <span className="font-semibold text-purple-700 dark:text-purple-300">
        📌 Standing client note{note.scope === 'brokerage' && note.company_match ? ` (${note.company_match})` : ''}:
      </span>
      <span className="ml-1.5">{note.content}</span>
    </p>)}
    {companyNotes && <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      <span className="font-semibold">Company Notes:</span>
      <span className="ml-1.5">{shoot.companyNotes}</span>
    </p>}
    {shoot.editorNotes?.trim() && <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      <span className="font-semibold">Editing notes :</span>
      <span className="ml-1.5">{shoot.editorNotes}</span>
    </p>}
  </div>;
}
