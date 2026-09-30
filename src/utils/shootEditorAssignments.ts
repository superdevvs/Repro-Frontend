import type { ShootData, ShootServiceObject } from '@/types/shoots'

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

const collectServiceEditorIds = (service: ShootServiceObject, editorIds: Set<string>, editorNames: Set<string>) => {
  const serviceEditorId = normalizeId(
    service.editor_id
      ?? service.resolved_editor_id
      ?? service.video_editor_id
      ?? service.videoEditorId
      ?? service.editor?.id,
  )
  const serviceEditorName = normalizeName(service.editor?.name)
  if (serviceEditorId) editorIds.add(serviceEditorId)
  if (serviceEditorName) editorNames.add(serviceEditorName)

  // Bundled photo+video services keep the video assignee on video_editor_id even
  // when editor_id points at the photo editor. Always collect both.
  const videoEditorId = normalizeId(service.video_editor_id ?? service.videoEditorId)
  if (videoEditorId) editorIds.add(videoEditorId)
}

export const shootHasEditorAssignment = (
  shoot: Pick<ShootData, 'editor' | 'editorAssignments' | 'serviceObjects' | 'serviceItems' | 'service_items'>,
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

  const serviceCollections: Array<ShootServiceObject[] | undefined> = [
    shoot.serviceObjects,
    shoot.serviceItems,
    shoot.service_items,
  ]
  serviceCollections.forEach((collection) => {
    if (!Array.isArray(collection)) return
    collection.forEach((service) => collectServiceEditorIds(service, editorIds, editorNames))
  })

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
