import type { ShootAssignee } from '@/services/shootAssignees';

export function editorsForServiceLane(editors: ShootAssignee[], lane: 'photo' | 'video'): ShootAssignee[] {
  return editors.filter(editor => {
    if (editor.role !== 'editor') return false;
    const raw = editor.metadata?.editing_capabilities ?? editor.metadata?.editingCapabilities ?? editor.editing_capabilities ?? editor.editingCapabilities;
    const capabilities = Array.isArray(raw) ? raw.map(value => {
      const normalized = String(value).trim().toLowerCase();
      return ['photo', 'photos', 'p'].includes(normalized) ? 'photo' : ['video', 'videos'].includes(normalized) ? 'video' : null;
    }).filter(Boolean) : [];
    return !capabilities.length || capabilities.includes(lane);
  });
}

export function serviceEditorLane(service: { editing_lanes?: string[]; upload_intake_type?: string | null; category?: unknown }): 'photo' | 'video' {
  if (service.editing_lanes?.[0] === 'photo' || service.editing_lanes?.[0] === 'video') return service.editing_lanes[0];
  const category = typeof service.category === 'string' ? service.category
    : service.category && typeof service.category === 'object' && 'name' in service.category ? String(service.category.name) : '';
  return service.upload_intake_type === 'video' || category.trim().toLowerCase().includes('video') ? 'video' : 'photo';
}
