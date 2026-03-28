import { format } from 'date-fns'
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary'
import { getStateFullName } from '@/utils/stateUtils'
import { getImageUrl, isPlaceholderImageUrl, normalizeImageUrl } from '@/utils/imageUrl'
import {
  ShootAction,
  ShootData,
  ShootFileData,
} from '@/types/shoots'

export const LIGHT_SHOOT_PLACEHOLDER = '/no-image-placeholder.svg'
export const DARK_SHOOT_PLACEHOLDER = '/no-image-placeholder-dark.svg'

export type ShootThumbnailPreference = 'thumb' | 'default'

export type ActiveOperationalTab = 'scheduled' | 'completed' | 'delivered' | 'hold' | 'editing' | 'edited'
export type AvailableTab = ActiveOperationalTab | 'history' | 'linked'

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
    resolvePreviewUrl((shoot.media as any)?.photos?.[0])

  if (editedMediaPreview) {
    return editedMediaPreview
  }

  const files = (shoot.files ?? []).filter((file) => !(file.is_hidden ?? false))
  const preferredFile =
    files.find((file) => (file.is_cover || file.isCover) && getFilePreviewUrl(file, preference)) ||
    files.find((file) => /(raw|uploaded|capture)/.test(getFileWorkflowStage(file)) && getFilePreviewUrl(file, preference)) ||
    files.find((file) => /(verified|completed|edited|review|ready|delivered)/.test(getFileWorkflowStage(file)) && getFilePreviewUrl(file, preference)) ||
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

export const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
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
      servicesArray = Array.isArray((item.services as any).data) ? (item.services as any).data : []
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
      return (service as any).name ?? (service as any).label ?? (service as any).service_name ?? String(service)
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
  const normalizedNotes = {
    shootNotes:
      toOptionalString(item.shoot_notes) ??
      toOptionalString(notesValue) ??
      toOptionalString(noteObject?.['shootNotes']),
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
