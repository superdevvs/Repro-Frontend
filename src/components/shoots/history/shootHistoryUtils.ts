import { format } from 'date-fns'
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary'
import { getStateFullName } from '@/utils/stateUtils'
import { getImageUrl, isPlaceholderImageUrl, normalizeImageUrl } from '@/utils/imageUrl'
import {
  ShootAction,
  ShootData,
  ShootFileData,
} from '@/types/shoots'

export const LIGHT_SHOOT_PLACEHOLDER = '/no-image-placeholder-light.svg'
export const DARK_SHOOT_PLACEHOLDER = '/no-image-placeholder.svg'

export type ShootThumbnailPreference = 'thumb' | 'default'

export type ActiveOperationalTab = 'scheduled' | 'completed' | 'delivered' | 'hold' | 'editing' | 'edited'
export type AvailableTab = ActiveOperationalTab | 'history'

export type OperationalFiltersState = {
  search: string
  clientId: string
  photographerId: string
  address: string
  services: string[]
  dateRange: 'all' | 'this_week' | 'this_month' | 'this_quarter' | 'custom'
  scheduledStart: string
  scheduledEnd: string
}

export type HistoryFiltersState = {
  search: string
  clientId: string
  photographerId: string
  services: string[]
  dateRange: 'all' | 'q1' | 'q2' | 'q3' | 'q4' | 'this_month' | 'this_quarter' | 'custom'
  scheduledStart: string
  scheduledEnd: string
  completedStart: string
  completedEnd: string
  groupBy: 'shoot' | 'services'
  viewAs: 'grid' | 'list' | 'map'
}

export type HistoryMeta = {
  current_page: number
  per_page: number
  total: number
}

export type FilterOption = {
  id?: string | number | null
  name?: string | null
}

export type FilterCollections = {
  clients: FilterOption[]
  photographers: FilterOption[]
  services: string[]
}

export type MapMarker = {
  id: string
  title: string
  subtitle?: string
  address: string
  coords: { lat: number; lng: number }
}

export const HISTORY_ALLOWED_ROLES = new Set([
  'admin',
  'superadmin',
  'editing_manager',
  'finance',
  'accounting',
  'editor',
  'client',
  'salesRep',
  'sales_rep',
])

export const DEFAULT_GEO_CENTER = { lat: 39.8283, lng: -98.5795 }

const STATUS_BADGE_CLASSES: Record<string, string> = {
  requested: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  booked: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  raw_upload_pending: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  uploaded: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  completed: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  raw_uploaded: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  photos_uploaded: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  in_progress: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  editing: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  start_editing: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  editing_complete: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  editing_uploaded: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  editing_issue: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  pending_review: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  ready_for_review: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  review: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  qc: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  ready: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  ready_for_client: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  admin_verified: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  workflow_completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  client_delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  finalized: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  finalised: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  on_hold: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  hold_on: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  cancelled: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
  canceled: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
  declined: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
  no_show: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
}

export const getShootStatusBadgeClass = (status?: string | null) =>
  STATUS_BADGE_CLASSES[String(status || '').toLowerCase()] ??
  'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/40 dark:text-slate-300 dark:border-slate-800'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export const STATUS_FILTERS_BY_TAB: Record<ActiveOperationalTab, string[]> = {
  scheduled: ['scheduled', 'requested', 'booked'],
  completed: ['uploaded', 'editing', 'review', 'qc', 'in_progress', 'raw_issue'],
  editing: [
    'uploaded',
    'editing',
    'review',
    'qc',
    'in_progress',
    'raw_issue',
    'completed',
    'editing_complete',
    'editing_uploaded',
    'editing_issue',
    'pending_review',
    'ready_for_review',
    'raw_uploaded',
    'photos_uploaded',
  ],
  delivered: ['delivered', 'ready_for_client', 'admin_verified', 'ready', 'workflow_completed', 'client_delivered'],
  edited: ['delivered', 'ready_for_client', 'admin_verified', 'ready', 'workflow_completed', 'client_delivered'],
  hold: ['on_hold', 'cancelled', 'canceled', 'declined', 'no_show'],
}

export const EDITOR_ACTIVE_STATUS_KEYS = [
  'uploaded',
  'editing',
  'review',
  'qc',
  'in_progress',
  'raw_issue',
  'completed',
  'editing_complete',
  'editing_uploaded',
  'editing_issue',
  'pending_review',
  'ready_for_review',
  'raw_uploaded',
  'photos_uploaded',
  'ready',
  'ready_for_client',
  'admin_verified',
] as const

export const EDITOR_DELIVERED_STATUS_KEYS = [
  'delivered',
  'ready',
  'ready_for_client',
  'admin_verified',
  'editing_complete',
  'editing_uploaded',
  'workflow_completed',
  'client_delivered',
] as const

const normalizeStatusValue = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

export const getOperationalStatusKey = (
  shoot: Pick<ShootData, 'workflowStatus' | 'status'>,
) => normalizeStatusValue(shoot.workflowStatus || shoot.status)

export const isEditorActiveOperationalShoot = (
  shoot: Pick<ShootData, 'workflowStatus' | 'status'>,
) => EDITOR_ACTIVE_STATUS_KEYS.includes(getOperationalStatusKey(shoot) as (typeof EDITOR_ACTIVE_STATUS_KEYS)[number])

export const isEditorDeliveredOperationalShoot = (
  shoot: Pick<ShootData, 'workflowStatus' | 'status'>,
) => EDITOR_DELIVERED_STATUS_KEYS.includes(getOperationalStatusKey(shoot) as (typeof EDITOR_DELIVERED_STATUS_KEYS)[number])

export const filterEditorActiveOperationalShoots = <T extends Pick<ShootData, 'workflowStatus' | 'status'>>(
  shoots: T[],
) => shoots.filter((shoot) => isEditorActiveOperationalShoot(shoot))

export const filterEditorDeliveredOperationalShoots = <T extends Pick<ShootData, 'workflowStatus' | 'status'>>(
  shoots: T[],
) => shoots.filter((shoot) => isEditorDeliveredOperationalShoot(shoot))

export const DEFAULT_OPERATIONAL_FILTERS: OperationalFiltersState = {
  search: '',
  clientId: '',
  photographerId: '',
  address: '',
  services: [],
  dateRange: 'all',
  scheduledStart: '',
  scheduledEnd: '',
}

export const DEFAULT_HISTORY_FILTERS: HistoryFiltersState = {
  search: '',
  clientId: '',
  photographerId: '',
  services: [],
  dateRange: 'this_quarter',
  scheduledStart: '',
  scheduledEnd: '',
  completedStart: '',
  completedEnd: '',
  groupBy: 'shoot',
  viewAs: 'list',
}

export const EMPTY_FILTER_COLLECTION: FilterCollections = {
  clients: [],
  photographers: [],
  services: [],
}

export const formatDisplayDate = (value?: string | null) => {
  if (!value) return '—'
  try {
    return format(new Date(value), 'MMM dd, yyyy')
  } catch (error) {
    return value
  }
}

export const formatCurrency = (value?: number) => currencyFormatter.format(value ?? 0)

export const resolvePreviewUrl = (value: string | null | undefined): string | null => {
  const resolved = normalizeImageUrl(value)
  return resolved || null
}

export const isPlaceholderLikeValue = (value: string | null | undefined): boolean => {
  return isPlaceholderImageUrl(value)
}

export const getFilePreviewUrl = (
  file?: ShootFileData | null,
  preference: ShootThumbnailPreference = 'default',
): string | null => {
  if (!file) return null
  const resolved = getImageUrl(file, preference === 'thumb' ? 'thumb' : 'medium')
  return resolved || null
}

export const getFileWorkflowStage = (file?: ShootFileData | null): string => {
  return String(file?.workflow_stage ?? file?.workflowStage ?? '').toLowerCase()
}

const hasEditedPreviewStage = (file?: ShootFileData | null): boolean =>
  /(verified|completed|edited|review|ready|delivered)/.test(getFileWorkflowStage(file))

const hasRawPreviewStage = (file?: ShootFileData | null): boolean =>
  /(raw|uploaded|capture)/.test(getFileWorkflowStage(file))

export const resolveShootThumbnail = (
  shoot: ShootData,
  preference: ShootThumbnailPreference = 'default',
): string | null => {
  const heroPreview =
    preference === 'thumb'
      ? null
      : !isPlaceholderLikeValue(shoot.heroImage)
        ? resolvePreviewUrl(shoot.heroImage)
        : null
  const editedMediaPreview =
    resolvePreviewUrl(shoot.media?.images?.[0]?.thumbnail) ||
    heroPreview ||
    resolvePreviewUrl(shoot.media?.images?.[0]?.url) ||
    resolvePreviewUrl(toOptionalString(toObjectValue<LegacyMediaShape>(shoot.media)?.photos?.[0]))

  if (editedMediaPreview) {
    return editedMediaPreview
  }

  const files = (shoot.files ?? []).filter((file) => !(file.is_hidden ?? false))
  const preferredFile =
    files.find((file) => (file.is_cover || file.isCover) && hasEditedPreviewStage(file) && getFilePreviewUrl(file, preference)) ||
    files.find((file) => hasEditedPreviewStage(file) && getFilePreviewUrl(file, preference)) ||
    files.find((file) => (file.is_cover || file.isCover) && getFilePreviewUrl(file, preference)) ||
    files.find((file) => hasRawPreviewStage(file) && getFilePreviewUrl(file, preference)) ||
    files.find((file) => getFilePreviewUrl(file, preference))

  return getFilePreviewUrl(preferredFile, preference) || heroPreview
}

export const getShootPlaceholderSrc = (theme: 'light' | 'dark') =>
  theme === 'dark' ? DARK_SHOOT_PLACEHOLDER : LIGHT_SHOOT_PLACEHOLDER

export const toStringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

export const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? fallback : parsed
  }
  return fallback
}

export const toBooleanValue = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true'
  }
  return fallback
}

export function toObjectValue<T extends Record<string, unknown>>(value: unknown): T | undefined {
  return value && typeof value === 'object' ? (value as T) : undefined
}

export function toArrayValue<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

type LegacyMediaShape = {
  photos?: unknown[]
}

type ServiceCollection = {
  data?: unknown[]
}

type ServiceLike = {
  name?: unknown
  label?: unknown
  service_name?: unknown
}

export const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export const getApprovalNotes = (notes: ShootData['notes']): string | undefined => {
  if (!notes || typeof notes === 'string') return undefined
  return toOptionalString((notes as { approvalNotes?: unknown }).approvalNotes)
}

export const getEditingNotes = (notes: ShootData['notes']): string | undefined => {
  if (!notes || typeof notes === 'string') return undefined
  return toOptionalString((notes as { editingNotes?: unknown }).editingNotes)
}

export const deriveFilterOptionsFromShoots = (shoots: ShootData[]): FilterCollections => {
  const clientMap = new Map<string, string>()
  const photographerMap = new Map<string, string>()
  const serviceSet = new Set<string>()

  shoots.forEach((shoot) => {
    if (shoot.client?.name) {
      clientMap.set(String(shoot.client.id ?? shoot.client.name), shoot.client.name)
    }

    if (shoot.photographer?.name) {
      photographerMap.set(String(shoot.photographer.id ?? shoot.photographer.name), shoot.photographer.name)
    }

    shoot.services?.forEach((service) => {
      if (service) {
        serviceSet.add(service)
      }
    })
  })

  return {
    clients: Array.from(clientMap.entries()).map(([id, name]) => ({ id, name })),
    photographers: Array.from(photographerMap.entries()).map(([id, name]) => ({ id, name })),
    services: Array.from(serviceSet.values()).sort(),
  }
}

export const mapShootApiToShootData = (item: Record<string, unknown>): ShootData => {
  let servicesArray: unknown[] = []

  if (item.services) {
    if (Array.isArray(item.services)) {
      servicesArray = item.services
    } else if (typeof item.services === 'object' && 'data' in item.services) {
      const serviceCollection = toObjectValue<ServiceCollection>(item.services)
      servicesArray = Array.isArray(serviceCollection?.data) ? serviceCollection.data : []
    } else if (typeof item.services === 'object') {
      servicesArray = Object.values(item.services)
    }
  }

  if (servicesArray.length === 0 && item.services_list && Array.isArray(item.services_list)) {
    servicesArray = item.services_list
  }

  if (servicesArray.length === 0) {
    const packageDetails = toObjectValue<{ servicesIncluded?: string[] }>(item.package) ??
      toObjectValue<{ servicesIncluded?: string[] }>(item.package_details) ??
      {}
    if (packageDetails.servicesIncluded && Array.isArray(packageDetails.servicesIncluded)) {
      servicesArray = packageDetails.servicesIncluded
    }
  }

  const serviceValues = servicesArray.map((service) => {
    if (typeof service === 'string') {
      return service
    }
    if (service && typeof service === 'object') {
      const serviceItem = service as ServiceLike
      return serviceItem.name ?? serviceItem.label ?? serviceItem.service_name ?? String(service)
    }
    return String(service)
  }).filter(Boolean) as string[]

  const address = toStringValue(item.address)
  const city = toStringValue(item.city)
  const state = toStringValue(item.state)
  const zip = toStringValue(item.zip)
  const fallbackFull = [address, city, getStateFullName(state)].filter(Boolean).join(', ')
  const locationDetails = toObjectValue<{ fullAddress?: string }>(item.location)
  const fullAddress = locationDetails?.fullAddress ?? `${fallbackFull}${zip ? ` ${zip}` : ''}`
  const packageDetails =
    toObjectValue<{ name?: string; expectedDeliveredCount?: number; bracketMode?: number; servicesIncluded?: string[] }>(item.package) ??
    toObjectValue<{ name?: string; expectedDeliveredCount?: number; bracketMode?: number; servicesIncluded?: string[] }>(
      item.package_details,
    ) ??
    {}
  const client = toObjectValue<{
    id?: number | string
    name?: string
    email?: string
    company_name?: string
    phonenumber?: string
    totalShoots?: number
    total_shoots?: number
  }>(item.client)
  const photographer = toObjectValue<{ id?: number | string; name?: string; avatar?: string }>(item.photographer)
  const editor = toObjectValue<{ id?: number | string; name?: string; avatar?: string }>(item.editor)
  const paymentDetails = toObjectValue<{
    taxRate?: number
    totalPaid?: number
    lastPaymentDate?: string
    lastPaymentType?: string
  }>(item.payment)
  const paymentSummary = normalizeShootPaymentSummary({
    payments: item.payments,
    base_quote: item.base_quote,
    tax_rate: paymentDetails?.taxRate,
    tax_percent: item.tax_percent,
    taxPercent: item.taxPercent,
    tax_amount: item.tax_amount,
    total_quote: item.total_quote,
    total_paid: item.total_paid,
    payment: paymentDetails,
    last_payment_date: item.last_payment_date,
    last_payment_type: item.last_payment_type,
    payment_type: item.payment_type,
  })
  const dropboxPaths =
    toObjectValue<Record<string, unknown>>(item.dropbox_paths) ??
    toObjectValue<Record<string, unknown>>(item.dropboxPaths)
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
    shootNotes:
      toOptionalString(item.shoot_notes) ??
      toOptionalString(notesValue) ??
      toOptionalString(noteObject?.['shootNotes']),
    approvalNotes: fallbackApprovalNotes,
    photographerNotes:
      toOptionalString(item.photographer_notes) ?? toOptionalString(noteObject?.['photographerNotes']),
    companyNotes: toOptionalString(item.company_notes) ?? toOptionalString(noteObject?.['companyNotes']),
    editingNotes:
      toOptionalString((item as { editor_notes?: unknown }).editor_notes) ??
      toOptionalString(noteObject?.['editingNotes']),
  }
  const hasNotes = Object.values(normalizedNotes).some(Boolean)
  const resolvedNotes = hasNotes ? normalizedNotes : notesValue

  const shootId = item.id ?? item.shoot_id ?? Math.random().toString(36).slice(2)

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
    location: {
      address,
      city,
      state,
      zip,
      fullAddress,
    },
    photographer: {
      id: photographer?.id ? String(photographer.id) : undefined,
      name: photographer?.name ?? 'Unassigned',
      avatar: photographer?.avatar,
    },
    editor: editor?.id || editor?.name
      ? {
          id: editor?.id ? String(editor.id) : undefined,
          name: editor?.name ?? 'Editor',
          avatar: editor?.avatar,
        }
      : undefined,
    services: serviceValues,
    status: toStringValue(item.status ?? item.workflow_status),
    workflowStatus: toStringValue(item.workflow_status ?? item.workflowStatus ?? item.status),
    notes: resolvedNotes as ShootData['notes'],
    payment: {
      totalQuote: paymentSummary.totalQuote,
      totalPaid: paymentSummary.totalPaid,
      baseQuote: paymentSummary.baseQuote,
      taxRate: paymentSummary.taxRate,
      taxAmount: paymentSummary.taxAmount,
      taxPercent: paymentSummary.taxPercent,
      lastPaymentDate: paymentDetails?.lastPaymentDate ?? toStringValue(item.last_payment_date),
      lastPaymentType: paymentDetails?.lastPaymentType ?? toStringValue(item.last_payment_type),
    },
    totalQuote: paymentSummary.totalQuote,
    totalPaid: paymentSummary.totalPaid,
    baseQuote: paymentSummary.baseQuote,
    taxAmount: paymentSummary.taxAmount,
    taxPercent: paymentSummary.taxPercent,
    completedDate: toStringValue(item.completed_date ?? item.completedDate),
    createdAt: toStringValue(item.created_at ?? item.createdAt),
    updatedAt: toStringValue(item.updated_at ?? item.updatedAt),
    rawPhotoCount: toNumberValue(item.raw_photo_count ?? item.rawPhotoCount, 0),
    editedPhotoCount: toNumberValue(item.edited_photo_count ?? item.editedPhotoCount, 0),
    media: item.media as ShootData['media'],
    heroImage: toStringValue(item.hero_image ?? item.heroImage),
    tourPurchased: toBooleanValue(item.tourPurchased ?? item.tour_purchased),
    tourLinks: (item.tour_links ?? item.tourLinks) as ShootData['tourLinks'],
    files: toArrayValue(item.files),
    primaryAction: primaryAction ?? undefined,
    package: packageDetails as ShootData['package'],
    package_details: packageDetails as ShootData['package_details'],
    extraData: item.extraData as ShootData['extraData'],
    rawMissingCount: item.raw_missing_count as number | undefined,
    editedMissingCount: item.edited_missing_count as number | undefined,
    missingRaw: toBooleanValue(item.missing_raw),
    missingFinal: toBooleanValue(item.missing_final),
    mediaSummary: item.media_summary as ShootData['mediaSummary'],
    weather: item.weather as ShootData['weather'],
  }
}
