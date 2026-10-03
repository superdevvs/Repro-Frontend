import type { ShootData } from '@/types/shoots'
import type { UserData } from '@/types/auth'
import { shootHasEditorAssignment } from '@/utils/shootEditorAssignments'
import { doesShootBelongToClient } from '@/utils/dashboardDerivedUtils'

export const filterShootByRole = (
  shoot: ShootData,
  role: string | null | undefined,
  user: UserData | null | undefined,
) => {
  if (role === 'client') {
    if (!user?.id && !user?.email && !user?.name) return true
    if (doesShootBelongToClient(shoot, user)) return true

    const userId = user?.id ? String(user.id) : ''
    const userMetadata = (user?.metadata as Record<string, unknown> | undefined) ?? {}
    const scopedClientIds = new Set(
      [
        userMetadata.clientId,
        userMetadata.client_id,
        ...(Array.isArray(userMetadata.clientIds) ? userMetadata.clientIds : []),
        ...(Array.isArray(userMetadata.managedClientIds) ? userMetadata.managedClientIds : []),
      ]
        .map((value) => (value == null ? '' : String(value).trim()))
        .filter(Boolean),
    )

    if (shoot.client?.id && scopedClientIds.has(String(shoot.client.id))) {
      return true
    }

    if (shoot.isGhostVisibleForUser) return true
    return Boolean(userId && (shoot.ghostUserIds ?? []).includes(userId))
  }

  if (role === 'photographer') {
    const userId = user?.id ? String(user.id) : ''
    const photographerId = shoot.photographer?.id ? String(shoot.photographer.id) : ''
    const isParentPhotographer = Boolean(userId && photographerId && userId === photographerId)

    const serviceItems = [
      ...(shoot.serviceItems ?? []),
      ...(shoot.service_items ?? []),
      ...(shoot.serviceObjects ?? []),
    ]
    const hasAssignedServiceItem = serviceItems.some((serviceItem) => {
      const assignedPhotographerId =
        serviceItem.resolved_photographer_id ??
        serviceItem.photographer_id ??
        serviceItem.photographer?.id

      return userId && assignedPhotographerId !== undefined && String(assignedPhotographerId) === userId
    })
    if (isParentPhotographer || hasAssignedServiceItem) return true

    const userName = user?.name?.toLowerCase() || ''
    const photographerName = shoot.photographer?.name?.toLowerCase() || ''
    if (!userId && !userName) return true
    const hasAssignedServiceItemByName = serviceItems.some((serviceItem) => {
      const assignedPhotographerName = serviceItem.photographer?.name?.toLowerCase()
      return Boolean(userName && assignedPhotographerName && assignedPhotographerName === userName)
    })
    return photographerName === userName || hasAssignedServiceItemByName
  }

  if (role === 'editor') {
    return shootHasEditorAssignment(shoot, user)
  }

  return true
}

