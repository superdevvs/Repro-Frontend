import type { DashboardShootSummary } from '@/types/dashboard';

/** Read-only context authorized for the current editor's assignment. */
export function EditorShootContextNotes({ shoot }: { shoot: DashboardShootSummary }) {
  const companyNotes = shoot.canViewVideoEditorContext ? shoot.companyNotes?.trim() : '';
  if (!companyNotes && !shoot.editorNotes?.trim()) return null;

  return <div className="-mx-5 -mb-3.5 mt-3 space-y-2 border-t border-purple-500/20 bg-purple-500/15 px-5 py-2 text-[11px] leading-relaxed text-foreground sm:-mb-5 sm:mt-4">
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
