import type { ShootEditorAssignment } from '@/types/shoots';
import type { ApiShoot } from './shootApiTypes';

export const normalizeServicePerson = (person: unknown) => {
  if (!person || typeof person !== 'object') return null;

  const source = person as Record<string, unknown>;
  const id = source.id != null ? String(source.id) : undefined;
  const name =
    (typeof source.name === 'string' && source.name.trim() ? source.name : undefined) ||
    (typeof source.full_name === 'string' && source.full_name.trim() ? source.full_name : undefined) ||
    (typeof source.display_name === 'string' && source.display_name.trim() ? source.display_name : undefined);

  if (!id && !name) {
    return null;
  }

  return {
    id,
    name: name ?? `User #${id}`,
    avatar:
      (typeof source.avatar === 'string' && source.avatar.trim() ? source.avatar : undefined) ||
      (typeof source.profile_image === 'string' && source.profile_image.trim() ? source.profile_image : undefined) ||
      (typeof source.profile_photo_url === 'string' && source.profile_photo_url.trim()
        ? source.profile_photo_url
        : undefined),
    email: typeof source.email === 'string' && source.email.trim() ? source.email : undefined,
    phone:
      (typeof source.phone === 'string' && source.phone.trim() ? source.phone : undefined) ||
      (typeof source.phonenumber === 'string' && source.phonenumber.trim() ? source.phonenumber : undefined),
  };
};

export const normalizeEditorAssignments = (shoot: ApiShoot): ShootEditorAssignment[] | undefined => {
  const rawAssignments = shoot.editor_assignments ?? shoot.editorAssignments;
  if (!Array.isArray(rawAssignments)) return undefined;

  const assignments = rawAssignments
    .filter((assignment): assignment is Record<string, unknown> => Boolean(assignment) && typeof assignment === 'object')
    .map((assignment) => {
      const editor = normalizeServicePerson(assignment.editor);
      const editorId =
        assignment.editor_id != null
          ? String(assignment.editor_id)
          : assignment.editorId != null
            ? String(assignment.editorId)
            : editor?.id ?? null;

      return {
        lane:
          (typeof assignment.lane === 'string' && assignment.lane.trim()) ||
          (typeof assignment.category_key === 'string' && assignment.category_key.trim()) ||
          'photo',
        label: typeof assignment.label === 'string' && assignment.label.trim() ? assignment.label : undefined,
        editorId,
        editor,
        serviceIds: Array.isArray(assignment.service_ids)
          ? assignment.service_ids.map((id) => String(id)).filter(Boolean)
          : Array.isArray(assignment.serviceIds)
            ? assignment.serviceIds.map((id) => String(id)).filter(Boolean)
            : undefined,
        serviceNames: Array.isArray(assignment.service_names)
          ? assignment.service_names.filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
          : Array.isArray(assignment.serviceNames)
            ? assignment.serviceNames.filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
            : undefined,
        shootServiceIds: Array.isArray(assignment.shoot_service_ids)
          ? assignment.shoot_service_ids.map((id) => String(id)).filter(Boolean)
          : Array.isArray(assignment.shootServiceIds)
            ? assignment.shootServiceIds.map((id) => String(id)).filter(Boolean)
            : undefined,
        ready: Boolean(assignment.ready),
        readyAt:
          (typeof assignment.ready_at === 'string' && assignment.ready_at.trim() ? assignment.ready_at : undefined) ||
          (typeof assignment.readyAt === 'string' && assignment.readyAt.trim() ? assignment.readyAt : undefined) ||
          null,
      };
    });

  return assignments.length > 0 ? assignments : undefined;
};
