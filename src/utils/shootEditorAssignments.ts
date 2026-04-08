import type { ShootData } from '@/types/shoots'

const normalizeId = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined
  const normalized = String(value).trim()
  return normalized || undefined
}

const normalizeName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  return normalized || undefined
}

export const shootHasEditorAssignment = (
  shoot: Pick<ShootData, 'editor' | 'editorAssignments' | 'serviceObjects'>,
  user: { id?: string | number; name?: string | null } | null | undefined,
) => {
  const userId = normalizeId(user?.id)
  const userName = normalizeName(user?.name)
  const editorIds = new Set<string>()
  const editorNames = new Set<string>()

  if (Array.isArray(shoot.editorAssignments)) {
    shoot.editorAssignments.forEach((assignment) => {
      const assignmentEditorId = normalizeId(assignment.editorId ?? assignment.editor?.id)
      const assignmentEditorName = normalizeName(assignment.editor?.name)
      if (assignmentEditorId) editorIds.add(assignmentEditorId)
      if (assignmentEditorName) editorNames.add(assignmentEditorName)
    })
  }

  if (Array.isArray(shoot.serviceObjects)) {
    shoot.serviceObjects.forEach((service) => {
      const serviceEditorId = normalizeId(service.editor_id ?? service.resolved_editor_id ?? service.editor?.id)
      const serviceEditorName = normalizeName(service.editor?.name)
      if (serviceEditorId) editorIds.add(serviceEditorId)
      if (serviceEditorName) editorNames.add(serviceEditorName)
    })
  }

  const topLevelEditorId = normalizeId(shoot.editor?.id)
  const topLevelEditorName = normalizeName(shoot.editor?.name)
  if (topLevelEditorId) editorIds.add(topLevelEditorId)
  if (topLevelEditorName) editorNames.add(topLevelEditorName)

  if (userId) {
    return editorIds.has(userId)
  }

  if (userName) {
    return editorNames.has(userName)
  }

  return false
}
