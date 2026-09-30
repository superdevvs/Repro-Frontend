import { readEditingCapabilities } from '@/utils/shootEditorAssignments'

export type RoleLabelUser = {
  role?: string | null
  metadata?: { editing_capabilities?: unknown; editingCapabilities?: unknown } | null
  editing_capabilities?: unknown
  editingCapabilities?: unknown
} | null | undefined

const BASE_ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  editing_manager: 'Editing Manager',
  salesrep: 'Sales Rep',
  sales_rep: 'Sales Rep',
  photographer: 'Photographer',
  editor: 'Editor',
  client: 'Client',
}

/**
 * Map editing_capabilities to a subtype label.
 * Empty / unknown → null (caller falls back to "Editor").
 */
export const formatEditorCapabilityLabel = (
  caps: ReadonlyArray<string>,
): string | null => {
  const normalized = new Set(
    caps
      .map((value) => String(value ?? '').trim().toLowerCase())
      .filter(Boolean),
  )
  const hasPhoto = normalized.has('photo')
  const hasVideo = normalized.has('video')
  if (hasPhoto && hasVideo) return 'Photo & Video editor'
  if (hasPhoto) return 'Photo editor'
  if (hasVideo) return 'Video editor'
  return null
}

/**
 * Human role label for badges / lists / settings / view-as.
 * Editors resolve Photo editor / Video editor / Photo & Video editor from
 * metadata.editing_capabilities (or editingCapabilities). Missing caps → "Editor".
 */
export const formatUserRoleLabel = (
  role?: string | null,
  user?: RoleLabelUser,
): string => {
  const raw = String(role ?? '').trim()
  if (!raw) return 'Unknown'

  const key = raw.toLowerCase()
  if (key === 'editor' || key === 'salesrep') {
    if (key === 'editor') {
      const caps = readEditingCapabilities(user ?? undefined)
      return formatEditorCapabilityLabel(caps) ?? 'Editor'
    }
    return 'Sales Rep'
  }

  if (BASE_ROLE_LABELS[key]) return BASE_ROLE_LABELS[key]
  if (BASE_ROLE_LABELS[raw]) return BASE_ROLE_LABELS[raw]

  return raw
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase())
}

/** Convenience when the user object carries its own role. */
export const formatRoleLabelForUser = (user: RoleLabelUser): string =>
  formatUserRoleLabel(user?.role, user)
