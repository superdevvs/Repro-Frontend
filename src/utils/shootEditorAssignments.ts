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

const normalizeRole = (role: unknown): string =>
  String(role ?? '')
    .trim()
    .toLowerCase()

const serviceCollectionsOf = (
  shoot: Pick<ShootData, 'serviceObjects' | 'serviceItems' | 'service_items'>,
): ShootServiceObject[] => {
  const collections: Array<ShootServiceObject[] | undefined> = [
    shoot.serviceObjects,
    shoot.serviceItems,
    shoot.service_items,
  ]
  const services: ShootServiceObject[] = []
  collections.forEach((collection) => {
    if (!Array.isArray(collection)) return
    collection.forEach((service) => services.push(service))
  })
  return services
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

  serviceCollectionsOf(shoot).forEach((service) => collectServiceEditorIds(service, editorIds, editorNames))

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

export type EditingCapability = 'photo' | 'video'

/**
 * Editors store lane capabilities on metadata.editing_capabilities (photo / video).
 * Unknown or empty → no strong signal either way.
 */
export const readEditingCapabilities = (
  user:
    | {
        metadata?: { editing_capabilities?: unknown; editingCapabilities?: unknown } | null
        editing_capabilities?: unknown
        editingCapabilities?: unknown
      }
    | null
    | undefined,
): EditingCapability[] => {
  const raw =
    user?.metadata?.editing_capabilities
    ?? user?.metadata?.editingCapabilities
    ?? user?.editing_capabilities
    ?? user?.editingCapabilities

  if (!Array.isArray(raw)) return []

  const caps = new Set<EditingCapability>()
  raw.forEach((value) => {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase()
    if (normalized === 'photo' || normalized === 'video') {
      caps.add(normalized)
    }
  })
  return Array.from(caps)
}

const collectLaneAssignments = (
  shoot: Pick<ShootData, 'editorAssignments' | 'serviceObjects' | 'serviceItems' | 'service_items'>,
  userId: string,
  videoOnlyByCaps: boolean,
) => {
  let matchedPhoto = false
  let matchedVideo = false

  if (Array.isArray(shoot.editorAssignments)) {
    shoot.editorAssignments.forEach((assignment) => {
      const assignmentEditorId = normalizeId(assignment.editorId ?? assignment.editor?.id)
      if (assignmentEditorId !== userId) return
      const lane = String(assignment.lane ?? '')
        .trim()
        .toLowerCase()
      if (lane === 'video') {
        matchedVideo = true
      } else {
        // photo / unset / any non-video lane counts as photo-lane assignment
        matchedPhoto = true
      }
    })
  }

  serviceCollectionsOf(shoot).forEach((service) => {
    const photoEditorId = normalizeId(
      service.editor_id ?? service.resolved_editor_id ?? service.editor?.id,
    )
    const videoEditorId = normalizeId(service.video_editor_id ?? service.videoEditorId)

    if (videoEditorId === userId) {
      matchedVideo = true
    }

    if (photoEditorId !== userId) return

    if (videoEditorId && videoEditorId !== photoEditorId) {
      // Bundled service: editor_id is the photo slot, video_editor_id is video.
      matchedPhoto = true
      return
    }

    if (videoEditorId && videoEditorId === photoEditorId) {
      // Same person stamped on both slots — keep full tabs unless caps are video-only.
      if (!videoOnlyByCaps) matchedPhoto = true
      return
    }

    // Lone editor_id with no video_editor_id: lane is ambiguous (photo service or
    // video service using the shared editor field). Do not mark photo here; the
    // caps + shootHasEditorAssignment fallback decides.
  })

  return { matchedPhoto, matchedVideo }
}

/**
 * Video-only Media tab gate: hide Photos + Raw Uploads.
 *
 * True when role=editor and the user is on the video lane for this shoot without
 * also being the photo editor. Prefers shoot assignment (video_editor_id / lane=video);
 * also honors editing_capabilities: ["video"] when assigned and not photo-assigned.
 * Admins / editing_manager / photographers / sales never match (role !== editor).
 */
export const isVideoOnlyEditorOnShoot = (
  shoot: Pick<ShootData, 'editor' | 'editorAssignments' | 'serviceObjects' | 'serviceItems' | 'service_items'>,
  user:
    | {
        id?: string | number
        role?: string | null
        metadata?: { editing_capabilities?: unknown; editingCapabilities?: unknown } | null
        editing_capabilities?: unknown
        editingCapabilities?: unknown
      }
    | null
    | undefined,
) => {
  if (normalizeRole(user?.role) !== 'editor') return false

  const userId = normalizeId(user?.id)
  if (!userId) return false

  const caps = readEditingCapabilities(user)
  const videoOnlyByCaps = caps.includes('video') && !caps.includes('photo')
  const { matchedPhoto, matchedVideo } = collectLaneAssignments(shoot, userId, videoOnlyByCaps)

  // Dual / photo assignment keeps the full Media tab set.
  if (matchedPhoto) return false

  // Assigned only via video_editor_id / lane=video.
  if (matchedVideo) return true

  // Caps say video-only and the user is some editor on this shoot (fallback when
  // BE only stamped editor_id on a video service without video_editor_id).
  if (videoOnlyByCaps && shootHasEditorAssignment(shoot, user)) {
    return true
  }

  return false
}

/**
 * Photo-only Media / Overview gate: hide Video sub-tabs + Video Tour Embeds.
 *
 * True when role=editor and the user is on the photo lane for this shoot without
 * also being the video editor. Prefers shoot assignment (editor_id / lane=photo);
 * also honors editing_capabilities: ["photo"] when assigned and not video-assigned.
 * Admins / editing_manager / photographers / sales never match (role !== editor).
 * Dual-assigned (editor_id + video_editor_id) keeps the full UI.
 */
export const isPhotoOnlyEditorOnShoot = (
  shoot: Pick<ShootData, 'editor' | 'editorAssignments' | 'serviceObjects' | 'serviceItems' | 'service_items'>,
  user:
    | {
        id?: string | number
        role?: string | null
        metadata?: { editing_capabilities?: unknown; editingCapabilities?: unknown } | null
        editing_capabilities?: unknown
        editingCapabilities?: unknown
      }
    | null
    | undefined,
) => {
  if (normalizeRole(user?.role) !== 'editor') return false

  const userId = normalizeId(user?.id)
  if (!userId) return false

  const caps = readEditingCapabilities(user)
  const photoOnlyByCaps = caps.includes('photo') && !caps.includes('video')
  // Pass videoOnlyByCaps=false so a dual-stamped editor_id===video_editor_id still
  // marks matchedPhoto (and matchedVideo), which keeps full tabs below.
  const { matchedPhoto, matchedVideo } = collectLaneAssignments(shoot, userId, false)

  // Dual / video assignment keeps Video tabs + tour embeds.
  if (matchedVideo) return false

  // Assigned only via editor_id / lane=photo (not video_editor_id).
  if (matchedPhoto) return true

  // Caps say photo-only and the user is some editor on this shoot (fallback when
  // BE stamped a general editor match without an explicit photo lane).
  if (photoOnlyByCaps && shootHasEditorAssignment(shoot, user)) {
    return true
  }

  return false
}
