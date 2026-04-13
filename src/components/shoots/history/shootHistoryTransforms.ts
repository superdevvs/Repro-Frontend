import { getStateFullName } from '@/utils/stateUtils'
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary'
import {
  BracketMode,
  ShootAction,
  ShootData,
  ShootEditorAssignment,
  ShootFileData,
  ShootServiceEditor,
  ShootServiceObject,
} from '@/types/shoots'
import { FilterCollections } from './shootHistoryUtils'

const toStringValue = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)
const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? fallback : parsed
  }
  return fallback
}
const toBooleanValue = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return fallback
}
const toObjectValue = <T extends Record<string, unknown>>(value: unknown): T | undefined => (value && typeof value === 'object' ? (value as T) : undefined)
const toArrayValue = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])
const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}
const toOptionalIdString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined
  const normalized = String(value).trim()
  return normalized ? normalized : undefined
}
const toOptionalIsoString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value
  return undefined
}
const toServiceObjectValue = (value: unknown) =>
  toObjectValue<{ name?: string; label?: string; service_name?: string }>(value)
const getServiceLabel = (value: unknown): string => {
  if (typeof value === 'string') return value

  const service = toServiceObjectValue(value)
  return service?.name ?? service?.label ?? service?.service_name ?? String(value)
}
const normalizeBracketMode = (value: unknown): BracketMode => {
  if (value === 3 || value === 5) return value
  return null
}

const normalizeServicePerson = (value: unknown): ShootServiceEditor | null => {
  const person = toObjectValue<Record<string, unknown>>(value)
  if (!person) return null

  const id = toOptionalIdString(person.id)
  const name =
    toOptionalString(person.name) ??
    toOptionalString(person.full_name) ??
    toOptionalString(person.display_name)

  if (!id && !name) return null

  return {
    id,
    name: name ?? `User #${id}`,
    avatar: toOptionalString(person.avatar) ?? toOptionalString(person.profile_image),
    email: toOptionalString(person.email),
  }
}

const normalizeEditorAssignments = (value: unknown): ShootEditorAssignment[] =>
  toArrayValue<Record<string, unknown>>(value).map((assignment) => ({
    lane: toOptionalString(assignment.lane) ?? 'photo',
    label: toOptionalString(assignment.label),
    editorId:
      toOptionalIdString(assignment.editor_id) ??
      toOptionalIdString(toObjectValue<Record<string, unknown>>(assignment.editor)?.id),
    editor: normalizeServicePerson(assignment.editor),
    serviceIds: toArrayValue<unknown>(assignment.service_ids)
      .map((id) => toOptionalIdString(id))
      .filter((id): id is string => Boolean(id)),
    serviceNames: toArrayValue<unknown>(assignment.service_names)
      .map((name) => toOptionalString(name))
      .filter((name): name is string => Boolean(name)),
    ready: toBooleanValue(assignment.ready),
    readyAt: toOptionalIsoString(assignment.ready_at),
  }))

const resolveHoldStatusValue = (item: Record<string, unknown>): string | undefined => {
  const extraData = toObjectValue<Record<string, unknown>>(item.extraData)
    ?? toObjectValue<Record<string, unknown>>(item.extra_data)
    ?? {}

  return toOptionalString(
    item.hold_status
    ?? item.holdStatus
    ?? item.status_at_hold
    ?? item.statusAtHold
    ?? item.status_before_hold
    ?? item.statusBeforeHold
    ?? item.previous_status
    ?? item.previousStatus
    ?? item.previous_workflow_status
    ?? item.previousWorkflowStatus
    ?? item.workflow_status_at_hold
    ?? item.workflowStatusAtHold
    ?? extraData.hold_status
    ?? extraData.holdStatus
    ?? extraData.status_at_hold
    ?? extraData.statusAtHold
    ?? extraData.status_before_hold
    ?? extraData.statusBeforeHold
    ?? extraData.previous_status
    ?? extraData.previousStatus
    ?? extraData.previous_workflow_status
    ?? extraData.previousWorkflowStatus
    ?? extraData.workflow_status_at_hold
    ?? extraData.workflowStatusAtHold,
  )
}

const getEditingNotes = (notes: ShootData['notes']): string | undefined => {
  if (!notes || typeof notes === 'string') return undefined
  return toOptionalString((notes as { editingNotes?: unknown }).editingNotes)
}

export const deriveFilterOptionsFromShoots = (shoots: ShootData[]): FilterCollections => {
  const clientMap = new Map<string, string>()
  const photographerMap = new Map<string, string>()
  const serviceSet = new Set<string>()

  shoots.forEach((shoot) => {
    if (shoot.client?.name) clientMap.set(String(shoot.client.id ?? shoot.client.name), shoot.client.name)
    if (shoot.photographer?.name) photographerMap.set(String(shoot.photographer.id ?? shoot.photographer.name), shoot.photographer.name)
    const services = Array.isArray(shoot.services) ? shoot.services : []
    services.forEach((service) => {
      const normalized = getServiceLabel(service)
      if (normalized) serviceSet.add(normalized)
    })
  })

  return {
    clients: Array.from(clientMap.entries()).map(([id, name]) => ({ id, name })),
    photographers: Array.from(photographerMap.entries()).map(([id, name]) => ({ id, name })),
    services: Array.from(serviceSet).sort(),
  }
}

export const mapShootApiToShootData = (item: Record<string, unknown>): ShootData => {
  let servicesArray: unknown[] = []
  if (item.services) {
    if (Array.isArray(item.services)) {
      servicesArray = item.services
    } else {
      const nestedServices = toObjectValue<{ data?: unknown }>(item.services)
      if (nestedServices && Array.isArray(nestedServices.data)) {
        servicesArray = nestedServices.data
      }
    }
  }
  if (servicesArray.length === 0) {
    const packageDetails = toObjectValue<{ servicesIncluded?: string[] }>(item.package) ?? toObjectValue<{ servicesIncluded?: string[] }>(item.package_details) ?? {}
    if (Array.isArray(packageDetails.servicesIncluded)) {
      servicesArray = packageDetails.servicesIncluded
    }
  }

  const serviceValues = servicesArray.map((service) => {
    return getServiceLabel(service)
  }).filter(Boolean) as string[]

  const address = toStringValue(item.address)
  const city = toStringValue(item.city)
  const state = toStringValue(item.state)
  const zip = toStringValue(item.zip)
  const fallbackFull = [address, city, getStateFullName(state)].filter(Boolean).join(', ')
  const locationDetails = toObjectValue<{ fullAddress?: string }>(item.location)
  const fullAddress = locationDetails?.fullAddress ?? `${fallbackFull}${zip ? ` ${zip}` : ''}`

  const packageDetails = toObjectValue<{ name?: string; expectedDeliveredCount?: number; bracketMode?: number; servicesIncluded?: string[] }>(item.package) ?? toObjectValue<{ name?: string; expectedDeliveredCount?: number; bracketMode?: number; servicesIncluded?: string[] }>(item.package_details) ?? {}
  const client = toObjectValue<{ id?: number | string; name?: string; email?: string; company_name?: string; phonenumber?: string; totalShoots?: number; total_shoots?: number }>(item.client)
  const photographer = toObjectValue<{ id?: number | string; name?: string; avatar?: string }>(item.photographer)
  const editor = toObjectValue<{ id?: number | string; name?: string; avatar?: string }>(item.editor)
  const ghostUsers = toArrayValue<Record<string, unknown>>(item.ghost_users ?? item.ghostUsers)
    .map((ghostUser) => ({
      id: toOptionalIdString(ghostUser.id) ?? '',
      name: toOptionalString(ghostUser.name) ?? 'Client',
      email: toOptionalString(ghostUser.email),
      company: toOptionalString(ghostUser.company) ?? toOptionalString(ghostUser.company_name),
    }))
    .filter((ghostUser) => Boolean(ghostUser.id))
  const ghostUserIds = (() => {
    const rawIds = toArrayValue<unknown>(item.ghost_user_ids ?? item.ghostUserIds)
      .map((value) => toOptionalIdString(value))
      .filter((value): value is string => Boolean(value))

    if (rawIds.length > 0) return rawIds
    return ghostUsers.map((ghostUser) => ghostUser.id)
  })()
  const editorAssignments = normalizeEditorAssignments(item.editor_assignments ?? item.editorAssignments)
  const serviceObjects = servicesArray
    .filter((service): service is Record<string, unknown> => Boolean(service) && typeof service === 'object')
    .map((service): ShootServiceObject => {
      const category = toObjectValue<{ id?: string | number; name?: string }>(service.category)
      const categoryName =
        category?.name ??
        toOptionalString(service.category_name) ??
        toOptionalString(service.categoryKey) ??
        'Other'

      return {
        id: toOptionalIdString(service.id) ?? Math.random().toString(36).slice(2),
        name:
          toOptionalString(service.name) ??
          toOptionalString(service.label) ??
          toOptionalString(service.service_name) ??
          'Unnamed service',
        price: toNumberValue(service.price),
        quantity: toNumberValue(service.quantity, 1),
        pricing_type:
          (toOptionalString(service.pricing_type) as ShootServiceObject['pricing_type']) ??
          undefined,
        photo_count:
          service.photo_count === null || service.photo_count === undefined
            ? undefined
            : toNumberValue(service.photo_count),
        sqft_ranges: toArrayValue<Record<string, unknown>>(service.sqft_ranges).map((range) => ({
          id: typeof range.id === 'number' ? range.id : undefined,
          sqft_from: toNumberValue(range.sqft_from),
          sqft_to: toNumberValue(range.sqft_to),
          duration:
            range.duration === null || range.duration === undefined
              ? null
              : toNumberValue(range.duration),
          price: toNumberValue(range.price),
          photographer_pay:
            range.photographer_pay === null || range.photographer_pay === undefined
              ? null
              : toNumberValue(range.photographer_pay),
          photo_count:
            range.photo_count === null || range.photo_count === undefined
              ? null
              : toNumberValue(range.photo_count),
        })),
        category: category
          ? {
              id: toOptionalIdString(category.id) ?? '',
              name: category.name ?? categoryName,
            }
          : null,
        photographer_pay:
          service.photographer_pay === null || service.photographer_pay === undefined
            ? null
            : toNumberValue(service.photographer_pay),
        photographer_id: toOptionalIdString(service.photographer_id) ?? null,
        resolved_photographer_id: toOptionalIdString(service.resolved_photographer_id) ?? null,
        photographer: normalizeServicePerson(service.photographer),
        editor_id: toOptionalIdString(service.editor_id) ?? null,
        resolved_editor_id: toOptionalIdString(service.resolved_editor_id) ?? null,
        editor: normalizeServicePerson(service.editor),
        editing_completed_at: toOptionalIsoString(service.editing_completed_at) ?? null,
        lane: toOptionalString(service.lane) ?? null,
        category_key: toOptionalString(service.category_key) ?? toOptionalString(service.lane) ?? null,
      }
    })
  const paymentDetails = toObjectValue<{ taxRate?: number; totalPaid?: number; lastPaymentDate?: string; lastPaymentType?: string }>(item.payment)
  const paymentSummary = normalizeShootPaymentSummary({
    payments: item.payments,
    base_quote: item.base_quote,
    tax_rate: item.tax_rate,
    tax_amount: item.tax_amount,
    total_quote: item.total_quote,
    total_paid: item.total_paid,
    payment: paymentDetails,
    payment_type: item.payment_type,
  })
  const dropboxPaths = toObjectValue<Record<string, unknown>>(item.dropbox_paths) ?? toObjectValue<Record<string, unknown>>(item.dropboxPaths)
  const primaryAction = toObjectValue<Record<string, unknown> & ShootAction>(item.primary_action)
  const notesValue = item.notes
  const noteObject = toObjectValue<Record<string, unknown>>(notesValue)
  const fallbackApprovalNotes = (() => {
    const directApproval =
      toOptionalString((item as { approval_notes?: unknown }).approval_notes) ??
      toOptionalString((item as { approvalNotes?: unknown }).approvalNotes) ??
      toOptionalString(noteObject?.['approvalNotes']) ??
      toOptionalString(noteObject?.['approval_notes'])

    if (directApproval) return directApproval
    if (typeof notesValue !== 'string') return undefined

    const hasDedicatedNotes = [
      item.shoot_notes,
      item.photographer_notes,
      item.company_notes,
      (item as { editor_notes?: unknown }).editor_notes,
    ].some((value) => Boolean(toOptionalString(value)))

    return hasDedicatedNotes ? toOptionalString(notesValue) : undefined
  })()
  const normalizedNotes = {
    shootNotes: toOptionalString(item.shoot_notes) ?? toOptionalString(notesValue) ?? toOptionalString(noteObject?.['shootNotes']),
    approvalNotes: fallbackApprovalNotes,
    photographerNotes: toOptionalString(item.photographer_notes) ?? toOptionalString(noteObject?.['photographerNotes']),
    companyNotes: toOptionalString(item.company_notes) ?? toOptionalString(noteObject?.['companyNotes']),
    editingNotes: toOptionalString((item as { editor_notes?: unknown }).editor_notes) ?? toOptionalString(noteObject?.['editingNotes']),
  }
  const hasNotes = Object.values(normalizedNotes).some(Boolean)
  const resolvedNotes = hasNotes ? normalizedNotes : notesValue
  const shootId = item.id ?? item.shoot_id ?? Math.random().toString(36).slice(2)
  const resolvedEditor =
    (editor
      ? { id: editor.id ? String(editor.id) : undefined, name: editor.name ?? 'Unassigned', avatar: editor.avatar }
      : undefined) ??
    (editorAssignments[0]?.editor
      ? {
          id: editorAssignments[0].editor?.id ? String(editorAssignments[0].editor?.id) : undefined,
          name: editorAssignments[0].editor?.name ?? 'Unassigned',
          avatar: editorAssignments[0].editor?.avatar,
          email: editorAssignments[0].editor?.email,
        }
      : undefined)

  return {
    id: String(shootId),
    scheduledDate: toStringValue(item.scheduled_date ?? item.scheduledDate),
    time: toStringValue(item.time, 'TBD'),
    propertySlug: toStringValue(item.property_slug ?? item.propertySlug),
    dropboxPaths,
    client: {
      name: client?.name ?? 'Unknown Client',
      email: client?.email ?? '',
      company: client?.company_name ?? '',
      phone: client?.phonenumber ?? '',
      totalShoots: toNumberValue(client?.totalShoots ?? client?.total_shoots, 0),
      id: client?.id ? String(client.id) : undefined,
    },
    location: { address, city, state, zip, fullAddress },
    photographer: photographer ? { id: photographer.id ? String(photographer.id) : undefined, name: photographer.name ?? 'Unassigned', avatar: photographer.avatar } : undefined,
    editor: resolvedEditor,
    editorId: resolvedEditor?.id ? String(resolvedEditor.id) : undefined,
    services: serviceValues,
    serviceObjects: serviceObjects.length ? serviceObjects : undefined,
    editorAssignments: editorAssignments.length ? editorAssignments : undefined,
    status: (() => {
      const status = toStringValue(item.status)
      return status === 'hold_on' ? 'on_hold' : status
    })(),
    workflowStatus: (() => {
      const wfStatus = toStringValue(item.workflow_status ?? item.workflowStatus)
      return wfStatus === 'hold_on' ? 'on_hold' : wfStatus
    })(),
    payment: {
      baseQuote: paymentSummary.baseQuote,
      taxRate: paymentSummary.taxRate,
      taxAmount: paymentSummary.taxAmount,
      totalQuote: paymentSummary.totalQuote,
      totalPaid: paymentSummary.totalPaid,
      lastPaymentDate: paymentSummary.lastPaymentDate,
      lastPaymentType: paymentSummary.lastPaymentType,
    },
    isPrivateListing: toBooleanValue(item.is_private_listing ?? item.isPrivateListing),
    notes: resolvedNotes,
    adminIssueNotes: item.admin_issue_notes as string | undefined,
    isFlagged: toBooleanValue(item.is_flagged),
    issuesResolvedAt: item.issues_resolved_at as string | undefined,
    issuesResolvedBy: item.issues_resolved_by as string | undefined,
    submittedForReviewAt: item.submitted_for_review_at as string | undefined,
    createdBy: toStringValue(item.created_by, 'System'),
    completedDate: item.completed_date?.toString() ?? (item.completedDate as string | undefined),
    package: {
      name: packageDetails.name ?? toStringValue(item.package_name) ?? serviceValues?.[0],
      expectedDeliveredCount: packageDetails.expectedDeliveredCount ?? (item.expected_final_count as number | undefined),
      bracketMode: normalizeBracketMode(packageDetails.bracketMode ?? item.bracket_mode),
      servicesIncluded: packageDetails.servicesIncluded ?? serviceValues,
    },
    expectedRawCount: item.expected_raw_count as number | undefined,
    rawPhotoCount: item.raw_photo_count as number | undefined,
    editedPhotoCount: item.edited_photo_count as number | undefined,
    rawMissingCount: item.raw_missing_count as number | undefined,
    editedMissingCount: item.edited_missing_count as number | undefined,
    missingRaw: toBooleanValue(item.missing_raw),
    missingFinal: toBooleanValue(item.missing_final),
    mediaSummary: item.media_summary as ShootData['mediaSummary'],
    heroImage: item.hero_image as string | undefined,
    weather: item.weather as ShootData['weather'],
    ghostUsers: ghostUsers.length ? ghostUsers : undefined,
    ghostUserIds: ghostUserIds.length ? ghostUserIds : undefined,
    isGhostVisibleForUser: toBooleanValue(item.is_ghost_visible_for_user ?? item.isGhostVisibleForUser),
    holdStatus: resolveHoldStatusValue(item),
    primaryAction: primaryAction ?? undefined,
    files: toArrayValue<ShootFileData>(item.files),
    tourPurchased: toBooleanValue(item.tourPurchased ?? item.tour_purchased),
    tourLinks: (item.tour_links ?? item.tourLinks) as ShootData['tourLinks'],
  }
}
