import { useCallback, useEffect, useMemo, useState } from 'react';
import { assigneesForRole, loadShootAssignees, type ShootAssignee } from '@/services/shootAssignees';

type Source = { id?: string | number; serviceItems?: unknown[]; service_items?: unknown[]; serviceObjects?: unknown[] };

/** Service editor changes are explicit; adding digital work never copies a shoot assignee. */
export function useServiceEditorAssignments(shoot: Source | null, active: boolean, canAssign: boolean) {
  const [editors, setEditors] = useState<ShootAssignee[]>([]);
  const [isLoadingEditors, setIsLoadingEditors] = useState(false);
  const [editorLoadError, setEditorLoadError] = useState('');
  const [serviceEditorChanges, setServiceEditorChanges] = useState<Record<string, string>>({});
  useEffect(() => { setServiceEditorChanges({}); }, [shoot?.id, active]);
  useEffect(() => {
    if (!active || !canAssign) return;
    const controller = new AbortController();
    setIsLoadingEditors(true);
    setEditorLoadError('');
    loadShootAssignees(controller.signal).then(users => {
      if (!controller.signal.aborted) setEditors(assigneesForRole(users, 'editor'));
    }).catch(error => {
      if (!controller.signal.aborted) setEditorLoadError(error instanceof Error ? error.message : 'Unable to load editors.');
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoadingEditors(false);
    });
    return () => controller.abort();
  }, [active, canAssign]);
  const saved = useMemo(() => {
    const ids: Record<string, string> = {};
    const people = new Map<string, ShootAssignee>();
    const items = [...(shoot?.serviceItems ?? []), ...(shoot?.service_items ?? []), ...(shoot?.serviceObjects ?? [])];
    for (const value of items) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Record<string, unknown>;
      const serviceId = item.service_id ?? item.serviceId ?? item.id;
      if (serviceId == null || Object.prototype.hasOwnProperty.call(ids, String(serviceId))) continue;
      const editor = item.editor && typeof item.editor === 'object' ? item.editor as Record<string, unknown> : null;
      const editorId = item.editor_id ?? item.resolved_editor_id ?? editor?.id;
      ids[String(serviceId)] = editorId == null ? '' : String(editorId);
      if (editorId != null && editor?.name) people.set(String(editorId), {
        id: String(editorId), name: String(editor.name), email: String(editor.email ?? ''), role: 'editor',
      });
    }
    return { ids, people };
  }, [shoot]);
  const editorOptions = useMemo(() => {
    const choices = new Map(saved.people);
    editors.forEach(editor => choices.set(editor.id, editor));
    return Array.from(choices.values());
  }, [editors, saved.people]);
  const updateServiceEditor = useCallback((serviceId: string, editorId: string) => {
    if (canAssign) setServiceEditorChanges(current => ({ ...current, [serviceId]: editorId }));
  }, [canAssign]);
  return { editorOptions, isLoadingEditors, editorLoadError, serviceEditorChanges,
    serviceEditorIds: { ...saved.ids, ...serviceEditorChanges }, updateServiceEditor };
}
