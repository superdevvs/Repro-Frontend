import React, { useCallback, useEffect, useMemo, useRef, useState, memo, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AutoExpandingTabsList, type AutoExpandingTab } from '@/components/ui/auto-expanding-tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { withErrorBoundary } from '@/components/ui/ErrorBoundary'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SharedShootCard } from '@/components/shoots/SharedShootCard'
import { ShootDetailsModal } from '@/components/shoots/ShootDetailsModal'
import { ShootApprovalModal } from '@/components/shoots/ShootApprovalModal'
import { ShootDeclineModal } from '@/components/shoots/ShootDeclineModal'
import { ShootEditModal } from '@/components/shoots/ShootEditModal'
import { BulkActionsDialog } from '@/components/shoots/BulkActionsDialog'
import { InvoiceViewDialog } from '@/components/invoices/InvoiceViewDialog'
import { useAuth } from '@/components/auth/AuthProvider'
import { cn } from '@/lib/utils'
import { API_BASE_URL } from '@/config/env'
import { to12Hour } from '@/utils/availabilityUtils'
import { useUserPreferences } from '@/contexts/UserPreferencesContext'
import { getStateFullName } from '@/utils/stateUtils'
import { formatWorkflowStatus } from '@/utils/status'
import axios from 'axios'
import {
  Calendar as CalendarIcon,
  MapPin,
  Filter,
  Layers,
  RefreshCw,
  Download,
  Copy,
  ChevronDown,
  ChevronRight,
  Plus,
  Clock,
  User,
  Camera,
  Image,
  Upload,
  Send,
  FileDown,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  Loader2,
  Mail,
  Phone,
  Building2,
  FileText,
  DollarSign,
  CreditCard,
  Grid3X3,
  List,
  Map as MapIcon,
  Pin,
  Eye,
  XCircle,
  Link2,
  Trash2,
  Check,
  Edit,
  X,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import {
  ShootAction,
  ShootData,
  ShootFileData,
  ShootHistoryRecord,
  ShootHistoryServiceAggregate,
} from '@/types/shoots'
import { apiClient } from '@/services/api'
import API_ROUTES from '@/lib/api'
import { registerShootHistoryRefresh } from '@/realtime/realtimeRefreshBus'

const resolvePreviewUrl = (value: string | null | undefined): string | null => {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null

  const base = String(API_BASE_URL || '').replace(/\/+$/, '')

  const isAbsolute = /^https?:\/\//i.test(trimmed)
  
  // Add /storage/ prefix for paths that look like storage paths (e.g., shoots/64/thumbnails/...)
  let path = trimmed
  if (!isAbsolute && !path.startsWith('/storage') && (path.startsWith('shoots/') || path.startsWith('avatars/') || path.startsWith('branding/'))) {
    path = `/storage/${path}`
  }
  
  const withBase = isAbsolute ? trimmed : `${base}${path.startsWith('/') ? '' : '/'}${path}`

  try {
    return encodeURI(withBase)
  } catch {
    return withBase
  }
}

const HISTORY_ALLOWED_ROLES = new Set([
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

const DEFAULT_GEO_CENTER = { lat: 39.8283, lng: -98.5795 }
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})


type ActiveOperationalTab = 'scheduled' | 'completed' | 'delivered' | 'hold' | 'editing' | 'edited'
type AvailableTab = ActiveOperationalTab | 'history' | 'linked'

const STATUS_FILTERS_BY_TAB: Record<ActiveOperationalTab, string[]> = {
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

type OperationalFiltersState = {
  search: string
  clientId: string
  photographerId: string
  address: string
  services: string[]
  dateRange: 'all' | 'this_week' | 'this_month' | 'this_quarter' | 'custom'
  scheduledStart: string
  scheduledEnd: string
}

type HistoryFiltersState = {
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

type HistoryMeta = {
  current_page: number
  per_page: number
  total: number
}

type FilterOption = {
  id?: string | number | null
  name?: string | null
}

type FilterCollections = {
  clients: FilterOption[]
  photographers: FilterOption[]
  services: string[]
}

type MapMarker = {
  id: string
  title: string
  subtitle?: string
  address: string
  coords: { lat: number; lng: number }
}

const DEFAULT_OPERATIONAL_FILTERS: OperationalFiltersState = {
  search: '',
  clientId: '',
  photographerId: '',
  address: '',
  services: [],
  dateRange: 'all',
  scheduledStart: '',
  scheduledEnd: '',
}

const DEFAULT_HISTORY_FILTERS: HistoryFiltersState = {
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

const EMPTY_FILTER_COLLECTION: FilterCollections = {
  clients: [],
  photographers: [],
  services: [],
}

const formatDisplayDate = (value?: string | null) => {
  if (!value) return '—'
  try {
    return format(new Date(value), 'MMM dd, yyyy')
  } catch (error) {
    return value
  }
}

const formatCurrency = (value?: number) => currencyFormatter.format(value ?? 0)

// Lazy-loaded Map View component
const LazyMapView = lazy(() => 
  import('@/components/ui/map')
    .then(module => {
      const Map = module.Map
      const MapControls = module.MapControls
      const Marker = module.Marker
      
      return {
        default: ({ markers, theme }: { markers: MapMarker[]; theme: 'light' | 'dark' }) => {
          const center = markers[0]?.coords ?? DEFAULT_GEO_CENTER
          const centerCoords: [number, number] = [center.lng, center.lat]
          const zoom = markers.length > 1 ? 6 : 12

          return (
            <div className="h-[520px] overflow-hidden rounded-xl border relative">
              <Map 
                center={centerCoords}
                zoom={zoom}
                theme={theme}
                className="h-full w-full"
              >
                <MapControls position="top-right" showZoom />
                {markers.map((marker) => (
                  <Marker 
                    key={marker.id} 
                    position={[marker.coords.lng, marker.coords.lat]}
                  >
                    <div className="space-y-1 p-2">
                      <p className="font-semibold text-sm">{marker.title}</p>
                      {marker.subtitle && (
                        <p className="text-xs text-muted-foreground">{marker.subtitle}</p>
                      )}
                      <p className="text-xs">{marker.address}</p>
                    </div>
                  </Marker>
                ))}
              </Map>
              {!markers.length && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-background/80 backdrop-blur-sm border rounded-lg p-4 text-center text-muted-foreground">
                    <p className="font-medium">No geocoded addresses yet</p>
                    <p className="text-sm mt-1">Open shoots in the list view to ensure addresses are valid.</p>
                  </div>
                </div>
              )}
            </div>
          )
        }
      }
    })
    .catch((error) => {
      console.error('Failed to load map component:', error)
      // Return a fallback component
      return {
        default: ({ markers }: { markers: MapMarker[]; theme: 'light' | 'dark' }) => (
          <div className="h-[520px] rounded-xl border flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="font-medium">Failed to load map</p>
              <p className="text-sm mt-1">Please refresh the page to try again.</p>
            </div>
          </div>
        )
      }
    })
)

// Payment Button Component for Super Admin
const PaymentButton = ({ shoot }: { shoot: ShootData }) => {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleInvoice = () => {
    // Navigate to invoice or open invoice dialog
    navigate(`/invoices?shoot_id=${shoot.id}`)
  }

  const handlePayment = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token')
      const response = await axios.post(
        `${API_BASE_URL}/api/shoots/${shoot.id}/create-checkout-link`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.data?.checkoutUrl) {
        window.open(response.data.checkoutUrl, '_blank')
        toast({
          title: 'Payment window opened',
          description: 'Complete payment in the new window.',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create payment link',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={(e) => e.stopPropagation()}
          disabled={loading}
        >
          <DollarSign className="h-3.5 w-3.5" />
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Payment'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={handleInvoice}>
          <FileText className="h-4 w-4 mr-2" />
          Invoice
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePayment}>
          <CreditCard className="h-4 w-4 mr-2" />
          Pay
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const toStringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? fallback : parsed
  }
  return fallback
}

const toBooleanValue = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true'
  }
  return fallback
}

function toObjectValue<T extends Record<string, unknown>>(value: unknown): T | undefined {
  return value && typeof value === 'object' ? (value as T) : undefined
}

function toArrayValue<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

const getEditingNotes = (notes: ShootData['notes']): string | undefined => {
  if (!notes || typeof notes === 'string') return undefined
  return toOptionalString((notes as { editingNotes?: unknown }).editingNotes)
}

const deriveFilterOptionsFromShoots = (shoots: ShootData[]): FilterCollections => {
  const clientMap: Map<string, string> = {} as Map<string, string>
  const photographerMap: Map<string, string> = {} as Map<string, string>
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

const mapShootApiToShootData = (item: Record<string, unknown>): ShootData => {
  // Handle services - can be array of strings, array of objects with name, or mixed
  // Also check if services is a Laravel collection that needs to be converted
  // Fallback to package.servicesIncluded if services is not available
  let servicesArray: unknown[] = []
  
  // First try to get services from item.services
  if (item.services) {
    if (Array.isArray(item.services)) {
      servicesArray = item.services
    } else if (typeof item.services === 'object' && 'data' in item.services) {
      // Laravel resource collection format
      servicesArray = Array.isArray((item.services as any).data) ? (item.services as any).data : []
    } else if (typeof item.services === 'object') {
      // Try to convert object to array
      servicesArray = Object.values(item.services)
    }
  }
  
  // If no services found, try services_list (explicitly added by backend)
  if (servicesArray.length === 0 && item.services_list && Array.isArray(item.services_list)) {
    servicesArray = item.services_list
  }
  
  // If still no services found, try package.servicesIncluded (from transformShoot)
  if (servicesArray.length === 0) {
    const packageDetails = toObjectValue<{ servicesIncluded?: string[] }>(item.package) ?? 
                          toObjectValue<{ servicesIncluded?: string[] }>(item.package_details) ?? {}
    if (packageDetails.servicesIncluded && Array.isArray(packageDetails.servicesIncluded)) {
      servicesArray = packageDetails.servicesIncluded
    }
  }
  
  const serviceValues = servicesArray.map((service) => {
    if (typeof service === 'string') {
      return service
    }
    if (service && typeof service === 'object') {
      // Handle Laravel model format: {id: 1, name: "Service Name", ...}
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
    status: (() => {
      const status = toStringValue(item.status);
      // Normalize hold_on to on_hold for consistency
      return status === 'hold_on' ? 'on_hold' : status;
    })(),
    workflowStatus: (() => {
      const wfStatus = toStringValue(item.workflow_status ?? item.workflowStatus);
      // Normalize hold_on to on_hold for consistency
      return wfStatus === 'hold_on' ? 'on_hold' : wfStatus;
    })(),
    payment: {
      baseQuote: toNumberValue(item.base_quote),
      taxRate: paymentDetails?.taxRate ?? 0,
      taxAmount: toNumberValue(item.tax_amount),
      totalQuote: toNumberValue(item.total_quote),
      totalPaid: toNumberValue(item.total_paid ?? paymentDetails?.totalPaid),
      lastPaymentDate: paymentDetails?.lastPaymentDate,
      lastPaymentType: paymentDetails?.lastPaymentType ?? toStringValue(item.payment_type),
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
      expectedDeliveredCount:
        packageDetails.expectedDeliveredCount ?? (item.expected_final_count as number | undefined),
      bracketMode: (packageDetails.bracketMode ?? item.bracket_mode) as any,
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
    primaryAction: primaryAction ?? undefined,
    files: toArrayValue<ShootFileData>(item.files),
    tourPurchased: toBooleanValue(item.tourPurchased ?? item.tour_purchased),
  }
}

const MultiSelectFilter = ({
  label,
  options,
  values,
  onChange,
}: {
  label: string
  options: string[]
  values: string[]
  onChange: (next: string[]) => void
}) => {
  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((entry) => entry !== value))
    } else {
      onChange([...values, value])
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="justify-between w-full">
            {values.length ? `${values.length} selected` : 'All'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 space-y-1" align="start">
          {options.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-1">No options available</p>
          )}
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted cursor-pointer"
            >
              <Checkbox
                checked={values.includes(option)}
                onCheckedChange={() => toggleValue(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}

// Status configuration for visual consistency
const statusConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  scheduled: { icon: CalendarIcon, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  booked: { icon: CalendarIcon, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  in_progress: { icon: Camera, color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200' },
  in_field: { icon: Camera, color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200' },
  editing: { icon: Image, color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200' },
  ready_for_review: { icon: CheckCircle2, color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-200' },
  pending_review: { icon: AlertCircle, color: 'text-yellow-600', bgColor: 'bg-yellow-50 border-yellow-200' },
  rescheduled: { icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
  completed: { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200' },
  on_hold: { icon: PauseCircle, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
  hold_on: { icon: PauseCircle, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
  cancelled: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50 border-red-200' },
  canceled: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50 border-red-200' },
  awaiting_date: { icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
  payment_pending: { icon: DollarSign, color: 'text-red-600', bgColor: 'bg-red-50 border-red-200' },
}

// Enhanced Scheduled Shoot List Row - matches spec 2.1.1
const ScheduledShootListRow = ({
  shoot,
  onSelect,
  isSuperAdmin = false,
  isAdmin = false,
  isEditingManager = false,
  isEditor = false,
  onDelete,
  onViewInvoice,
  onApprove,
  onDecline,
  onModify,
  onSendToEditing,
  shouldHideClientDetails = false,
}: {
  shoot: ShootData
  onSelect: (shoot: ShootData) => void
  isSuperAdmin?: boolean
  isAdmin?: boolean
  isEditingManager?: boolean
  isEditor?: boolean
  onDelete?: (shoot: ShootData) => void
  onViewInvoice?: (shoot: ShootData) => void
  onApprove?: (shoot: ShootData) => void
  onDecline?: (shoot: ShootData) => void
  onModify?: (shoot: ShootData) => void
  onSendToEditing?: (shoot: ShootData) => void
  shouldHideClientDetails?: boolean
}) => {
  const { formatTime, formatDate: formatDatePref } = useUserPreferences()
  const formatDisplayDateLocal = (value?: string | null) => {
    if (!value) return '—'
    try { return formatDatePref(new Date(value)) } catch { return value ?? '—' }
  }
  // Prioritize status over workflowStatus for display, but check both
  const displayStatus = shoot.status ?? shoot.workflowStatus ?? 'scheduled'
  // Normalize hold_on to on_hold for config lookup
  const statusKey = displayStatus === 'hold_on' ? 'on_hold' : displayStatus
  const statusLabel = formatWorkflowStatus(displayStatus)
  const config = statusConfig[statusKey] ?? statusConfig[displayStatus] ?? statusConfig.scheduled
  const StatusIcon = config.icon
  const paymentStatus = isSuperAdmin && shoot.payment?.totalPaid && shoot.payment?.totalQuote
    ? shoot.payment.totalPaid >= shoot.payment.totalQuote
      ? 'Paid'
      : 'Unpaid'
    : null
  const editingNotes = getEditingNotes(shoot.notes)
  const canShowEditingNotes = Boolean(editingNotes) && (isSuperAdmin || isAdmin || isEditingManager || isEditor)
  const shootStatus = String(shoot.status ?? shoot.workflowStatus ?? '').toLowerCase()
  const canSendToEditing = Boolean(onSendToEditing) && shootStatus === 'uploaded'

  return (
    <Card
      className="cursor-pointer border border-border/70 bg-card/50 hover:border-primary/50 hover:shadow-lg transition-all group backdrop-blur-sm flex flex-col"
      onClick={() => onSelect(shoot)}
    >
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        {/* Row 1: Date/Time | Address | Client/Photographer | Status */}
        {/* Mobile: Stack vertically, Desktop: Horizontal layout */}
        <div className="space-y-3 md:space-y-0 md:flex md:items-start md:gap-4 mb-2">
          {/* Top row on mobile: Date/Time and Status */}
          <div className="flex items-start justify-between gap-3 md:hidden">
            {/* Date and Time - Left Side */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>{formatDisplayDateLocal(shoot.scheduledDate)}</span>
              </div>
              {shoot.time && shoot.time !== 'TBD' && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{formatTime(shoot.time)}</span>
                </div>
              )}
            </div>
            {/* Status - Right Side (mobile only) */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={cn('capitalize font-medium', config.bgColor, config.color)}>
                <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
                {statusLabel}
              </Badge>
              {paymentStatus && (
                <Badge variant={paymentStatus === 'Paid' ? 'secondary' : 'destructive'} className="text-xs">
                  {paymentStatus}
                </Badge>
              )}
              {canShowEditingNotes && (
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                  Editing Notes
                </Badge>
              )}
            </div>
          </div>

          {/* Desktop: Date and Time - Left Side */}
          <div className="hidden md:flex flex-col gap-0.5 min-w-[140px] flex-shrink-0">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>{formatDisplayDateLocal(shoot.scheduledDate)}</span>
            </div>
            {shoot.time && shoot.time !== 'TBD' && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{formatTime(shoot.time)}</span>
              </div>
            )}
          </div>

          {/* Address - Main Content (can wrap) */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold leading-tight break-words">{shoot.location.address}</h3>
            <p className="text-xs text-muted-foreground break-words">
              {shoot.location.city}, {getStateFullName(shoot.location.state)} {shoot.location.zip}
            </p>
          </div>

          {/* Client & Photographer - Compact Inline */}
          <div className="flex flex-wrap items-center gap-3 md:gap-4 min-w-0 text-sm">
            {!shouldHideClientDetails && (
              <div className="flex items-center gap-1.5 min-w-0">
                <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium break-words" title={shoot.client.name}>
                  {shoot.client.name}
                </span>
              </div>
            )}
            {shoot.photographer?.name && shoot.photographer.name !== 'Unassigned' && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Camera className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium break-words" title={shoot.photographer.name}>
                  {shoot.photographer.name}
                </span>
              </div>
            )}
          </div>

          {/* Desktop: Status & Actions - Right Side */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <Badge className={cn('capitalize font-medium', config.bgColor, config.color)}>
              <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
              {statusLabel}
            </Badge>
            {paymentStatus && (
              <Badge variant={paymentStatus === 'Paid' ? 'secondary' : 'destructive'} className="text-xs">
                {paymentStatus}
              </Badge>
            )}
            {canShowEditingNotes && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                Editing Notes
              </Badge>
            )}
            {isSuperAdmin && paymentStatus === 'Unpaid' && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <PaymentButton shoot={shoot} />
              </div>
            )}
            {canSendToEditing && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={(e) => {
                  e.stopPropagation()
                  onSendToEditing?.(shoot)
                }}
                title="Send to Editing"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
            {/* Invoice button - Available for all roles */}
            {onViewInvoice && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  onViewInvoice(shoot)
                }}
                title="View Invoice"
              >
                <FileText className="h-3.5 w-3.5" />
              </Button>
            )}
            {/* Delete button - Only for admin/superadmin */}
            {(isSuperAdmin || isAdmin) && onDelete && (
              <Button
                size="sm"
                variant="destructive"
                className="h-8 gap-1.5 bg-red-500 hover:bg-red-600 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(shoot)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Services - Full width below (handles many services) - Always show */}
        {(() => {
          // Normalize services - try multiple sources
          let services: any[] = [];
          
          // Try services_list first (explicitly added by backend)
          const servicesList = (shoot as any).services_list;
          if (servicesList && Array.isArray(servicesList)) {
            services = servicesList;
          }
          // Try services array (could be array of strings or objects)
          else if (Array.isArray(shoot.services)) {
            services = shoot.services;
          }
          // Try services as object with data property
          else if (shoot.services && typeof shoot.services === 'object' && (shoot.services as any).data) {
            services = Array.isArray((shoot.services as any).data) ? (shoot.services as any).data : [];
          }
          // Try package.servicesIncluded
          else if (shoot.package?.servicesIncluded && Array.isArray(shoot.package.servicesIncluded)) {
            services = shoot.package.servicesIncluded;
          }
          
          // Normalize service names - handle both strings and objects
          const normalizedServices = services.map((service) => {
            if (typeof service === 'string') return service;
            if (service && typeof service === 'object') {
              // Handle service object with name property
              return (service as any).name || (service as any).label || (service as any).service_name || String(service);
            }
            return String(service);
          }).filter(Boolean);
          
          // Debug: Log if services are found but not displaying (only in dev)
          if (process.env.NODE_ENV === 'development' && services.length > 0 && normalizedServices.length === 0) {
            console.log('Services found but not normalized:', { services, shootId: shoot.id });
          }
          
          // Always show services section, even if empty
          return (
            <div className="flex items-start gap-4 mt-2 pt-2 border-t border-border/30">
              <div className="hidden md:block min-w-[140px] flex-shrink-0"></div> {/* Spacer for date column on desktop */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Services</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-1.5 sm:justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {normalizedServices.length > 0 ? (
                      normalizedServices.map((serviceName, idx) => (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="bg-primary/10 text-primary hover:bg-primary/20 font-medium px-2.5 py-1 text-xs rounded-md border border-primary/20"
                        >
                          {serviceName}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground/70 italic">No services assigned</p>
                    )}
                  </div>
                  {/* Action buttons for requested shoots - bottom right */}
                  {displayStatus === 'requested' && (isAdmin || isSuperAdmin) && (onApprove || onDecline || onModify) && (
                    <div className="flex flex-wrap gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {onApprove && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onApprove(shoot);
                          }}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </Button>
                      )}
                      {onModify && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onModify(shoot);
                          }}
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />
                          Modify
                        </Button>
                      )}
                      {onDecline && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDecline(shoot);
                          }}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Decline
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </Card>
  )
}

// Completed Shoot Album Card - matches spec 2.2
const CompletedAlbumCard = ({
  shoot,
  onSelect,
  onDownload,
  isSuperAdmin = false,
  isAdmin = false,
  isEditingManager = false,
  isEditor = false,
  onDelete,
  onViewInvoice,
  onSendToEditing,
  shouldHideClientDetails = false,
}: {
  shoot: ShootData
  onSelect: (shoot: ShootData) => void
  onDownload?: (shoot: ShootData, type: 'full' | 'web') => void
  isSuperAdmin?: boolean
  isAdmin?: boolean
  isEditingManager?: boolean
  isEditor?: boolean
  onDelete?: (shoot: ShootData) => void
  onViewInvoice?: (shoot: ShootData) => void
  onSendToEditing?: (shoot: ShootData) => void
  shouldHideClientDetails?: boolean
}) => {
  const { formatTime, formatDate: formatDatePref } = useUserPreferences()
  const formatDisplayDateLocal = (value?: string | null) => {
    if (!value) return '—'
    try { return formatDatePref(new Date(value)) } catch { return value ?? '—' }
  }
  // Get first file from files array for cover image (raw uploads)
  const firstFile = shoot.files?.[0]
  const firstFileUrl = firstFile?.thumbnail_path || firstFile?.web_path || firstFile?.url || firstFile?.path
  const heroImage =
    resolvePreviewUrl(shoot.heroImage) ||
    resolvePreviewUrl(shoot.media?.images?.[0]?.url) ||
    resolvePreviewUrl((shoot.media as any)?.photos?.[0]) ||
    resolvePreviewUrl(firstFileUrl) ||
    '/placeholder.svg'
  const photoCount = shoot.media?.images?.length ?? shoot.editedPhotoCount ?? shoot.rawPhotoCount ?? shoot.files?.length ?? 0
  const hasNoImages = !heroImage || heroImage === '/placeholder.svg' || photoCount === 0
  const hasTour = shoot.tourPurchased || Boolean(shoot.tourLinks?.branded || shoot.tourLinks?.mls)
  const isPaid = isSuperAdmin ? ((shoot.payment?.totalPaid ?? 0) >= (shoot.payment?.totalQuote ?? 0)) : false
  const statusValue = shoot.workflowStatus ?? shoot.status ?? ''
  const statusLabel = formatWorkflowStatus(statusValue)
  const editingNotes = getEditingNotes(shoot.notes)
  const canShowEditingNotes = Boolean(editingNotes) && (isSuperAdmin || isAdmin || isEditingManager || isEditor)
  const shootStatus = String(shoot.status ?? shoot.workflowStatus ?? '').toLowerCase()
  const canSendToEditing = Boolean(onSendToEditing) && shootStatus === 'uploaded'

  return (
    <Card
      className="overflow-hidden cursor-pointer border border-border/70 hover:border-primary/50 hover:shadow-xl transition-all group bg-card/50 backdrop-blur-sm"
      onClick={() => onSelect(shoot)}
    >
      {/* Cover Image or Placeholder */}
      <div className="relative h-64 overflow-hidden bg-muted">
        {hasNoImages ? (
          <img 
            src="/no-image-placeholder.svg" 
            alt="No images yet" 
            className="w-full h-full object-cover"
          />
        ) : (
          <img 
            src={heroImage} 
            alt={shoot.location.address} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => { e.currentTarget.src = '/no-image-placeholder.svg' }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* Overlay badges */}
        <div className="absolute top-3 left-3">
          {(() => {
            // Get status color based on status value
            const statusKey = statusValue.toLowerCase();
            const getStatusColor = () => {
              if (statusKey.includes('requested')) return 'bg-blue-500 text-white';
              if (statusKey.includes('scheduled') || statusKey.includes('booked')) return 'bg-blue-500 text-white';
              if (statusKey.includes('uploaded') || statusKey.includes('completed') || statusKey.includes('photos_uploaded') || statusKey.includes('raw_uploaded')) return 'bg-indigo-500 text-white';
              if (statusKey.includes('editing')) return 'bg-purple-500 text-white';
              // Review status removed - no longer needed
              if (statusKey.includes('delivered') || statusKey.includes('admin_verified') || statusKey.includes('ready_for_client') || statusKey.includes('ready')) return 'bg-emerald-500 text-white';
              if (statusKey.includes('declined')) return 'bg-red-500 text-white';
              if (statusKey.includes('cancel')) return 'bg-gray-500 text-white';
              if (statusKey.includes('hold')) return 'bg-amber-500 text-white';
              return 'bg-emerald-500 text-white'; // Default
            };
            return (
              <Badge className={getStatusColor()}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                {statusLabel}
              </Badge>
            );
          })()}
          {canShowEditingNotes && (
            <Badge variant="outline" className="ml-2 text-xs bg-purple-500/90 text-white border-purple-400">
              Editing Notes
            </Badge>
          )}
        </div>
        
        {/* Send to Editing button - Top right */}
        {canSendToEditing && (
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 bg-purple-500/90 hover:bg-purple-600 text-white shadow-md"
              onClick={(e) => {
                e.stopPropagation()
                onSendToEditing?.(shoot)
              }}
              title="Send to Editing"
            >
              <Send className="h-4 w-4" />
              Send to Editing
            </Button>
          </div>
        )}
        
        {/* Invoice button - Top right */}
        {!canSendToEditing && onViewInvoice && (
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-md"
              onClick={(e) => {
                e.stopPropagation()
                onViewInvoice(shoot)
              }}
              title="View Invoice"
            >
              <FileText className="h-4 w-4" />
              Invoice
            </Button>
          </div>
        )}
        
        {/* Photo count */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/70 text-white px-2.5 py-1 rounded-full text-sm">
            <Image className="h-3.5 w-3.5" />
            <span>{photoCount} photos</span>
          </div>
          {hasTour && (
            <div className="bg-black/70 text-white px-2.5 py-1 rounded-full text-sm">
              Tour: Yes
            </div>
          )}
        </div>

        {/* Download and Delete buttons */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onDownload && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation()
                onDownload(shoot, 'full')
              }}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {/* Delete button - Only for admin/superadmin */}
          {(isAdmin || isSuperAdmin) && onDelete && (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 w-8 p-0 bg-red-500 hover:bg-red-600"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(shoot)
              }}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-5 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wide font-semibold">
            {formatDisplayDateLocal(shoot.completedDate || shoot.scheduledDate)}
            {shoot.time && shoot.time !== 'TBD' && ` · ${formatTime(shoot.time)}`}
          </p>
          <h3 className="font-bold text-lg leading-tight truncate mb-3">{shoot.location.fullAddress}</h3>
        </div>

        {/* Services - Prominent */}
        {shoot.services && shoot.services.length > 0 && (
          <div className="space-y-2 pb-3 border-b border-border/50">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Layers className="h-3.5 w-3.5" />
              <span>Services</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {shoot.services.map((service, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary" 
                  className="bg-primary/10 text-primary hover:bg-primary/20 font-medium px-3 py-1 text-sm rounded-md border border-primary/20"
                >
                  {typeof service === 'string' ? service : (service as any).name || String(service)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
          {!shouldHideClientDetails && (
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium truncate max-w-[120px]">{shoot.client.name}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium truncate max-w-[120px]">{shoot.photographer?.name ?? 'Unassigned'}</span>
          </div>
        </div>
          {isSuperAdmin && (
            <Badge variant={isPaid ? 'secondary' : 'destructive'} className="text-xs font-medium">
              {isPaid ? 'Paid' : 'Unpaid'}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  )
}

// Completed Shoot List Row
const CompletedShootListRow = ({
  shoot,
  onSelect,
  onDownload,
  isSuperAdmin = false,
  isAdmin = false,
  isEditingManager = false,
  isEditor = false,
  onDelete,
  onViewInvoice,
  onSendToEditing,
  shouldHideClientDetails = false,
}: {
  shoot: ShootData
  onSelect: (shoot: ShootData) => void
  onDownload?: (shoot: ShootData, type: 'full' | 'web') => void
  isSuperAdmin?: boolean
  isAdmin?: boolean
  isEditingManager?: boolean
  isEditor?: boolean
  onDelete?: (shoot: ShootData) => void
  onViewInvoice?: (shoot: ShootData) => void
  onSendToEditing?: (shoot: ShootData) => void
  shouldHideClientDetails?: boolean
}) => {
  const { formatDate: formatDatePref } = useUserPreferences()
  const formatDisplayDateLocal = (value?: string | null) => {
    if (!value) return '—'
    try { return formatDatePref(new Date(value)) } catch { return value ?? '—' }
  }
  // Get first file from files array for cover image (raw uploads)
  const firstFile = shoot.files?.[0]
  const firstFileUrl = firstFile?.thumbnail_path || firstFile?.web_path || firstFile?.url || firstFile?.path
  const heroImage =
    resolvePreviewUrl(shoot.heroImage) ||
    resolvePreviewUrl(shoot.media?.images?.[0]?.url) ||
    resolvePreviewUrl((shoot.media as any)?.photos?.[0]) ||
    resolvePreviewUrl(firstFileUrl) ||
    '/placeholder.svg'
  const photoCount = shoot.media?.images?.length ?? shoot.editedPhotoCount ?? shoot.rawPhotoCount ?? shoot.files?.length ?? 0
  const hasTour = shoot.tourPurchased || Boolean(shoot.tourLinks?.branded || shoot.tourLinks?.mls)
  const isPaid = isSuperAdmin ? ((shoot.payment?.totalPaid ?? 0) >= (shoot.payment?.totalQuote ?? 0)) : false
  const statusValue = shoot.workflowStatus ?? shoot.status ?? ''
  const statusLabel = formatWorkflowStatus(statusValue)
  const editingNotes = getEditingNotes(shoot.notes)
  const canShowEditingNotes = Boolean(editingNotes) && (isSuperAdmin || isAdmin || isEditingManager || isEditor)
  const shootStatus = String(shoot.status ?? shoot.workflowStatus ?? '').toLowerCase()
  const canSendToEditing = Boolean(onSendToEditing) && shootStatus === 'uploaded'

  const hasNoImages = !heroImage || heroImage === '/placeholder.svg' || photoCount === 0
  const displayImage = hasNoImages ? '/no-image-placeholder.svg' : heroImage

  return (
    <Card
      className="cursor-pointer hover:border-primary/60 hover:shadow-md transition-all group"
      onClick={() => onSelect(shoot)}
    >
      <div className="flex gap-3 sm:gap-4 p-3 sm:p-4">
        {/* Thumbnail - Small square on mobile, rectangular landscape on desktop */}
        <div className="w-24 h-24 sm:w-40 sm:h-28 rounded-lg overflow-hidden bg-muted flex-shrink-0 shadow-sm">
          <img 
            src={displayImage} 
            alt={shoot.location.address} 
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.currentTarget.src = '/no-image-placeholder.svg' }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top row: Date, Address and Status badges */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-0.5">
                {formatDisplayDateLocal(shoot.completedDate || shoot.scheduledDate)}
              </p>
              <h3 className="font-semibold text-base leading-tight truncate">{shoot.location.fullAddress}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {statusLabel}
              </Badge>
              {isSuperAdmin && (
                <Badge variant={isPaid ? 'secondary' : 'destructive'} className="text-xs">
                  {isPaid ? 'Paid' : 'Unpaid'}
                </Badge>
              )}
              {isSuperAdmin && !isPaid && (
                <div onClick={(e) => e.stopPropagation()}>
                  <PaymentButton shoot={shoot} />
                </div>
              )}
              {canShowEditingNotes && (
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                  Editing Notes
                </Badge>
              )}
            </div>
          </div>

          {/* Middle row: Client, Photographer, Photo count */}
          <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-2">
            {!shouldHideClientDetails && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                <span>{shoot.client.name}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Camera className="h-3.5 w-3.5" />
              <span>{shoot.photographer?.name ?? 'Unassigned'}</span>
            </span>
            <span className="flex items-center gap-1">
              <Image className="h-3.5 w-3.5" />
              <span>{photoCount} photos</span>
            </span>
            {hasTour && (
              <Badge variant="secondary" className="text-[10px] font-medium py-0 px-1.5">
                Tour
              </Badge>
            )}
          </div>

          {/* Bottom row: Services + Actions */}
          {(() => {
            const services = Array.isArray(shoot.services) ? shoot.services : [];
            return (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
                <div className="flex flex-wrap gap-1.5">
                  {services.length > 0 ? (
                    services.map((service, idx) => {
                      const serviceName = typeof service === 'string' 
                        ? service 
                        : (service as any)?.name || (service as any)?.label || String(service);
                      if (!serviceName) return null;
                      return (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className="bg-primary/5 text-primary font-medium text-xs py-0.5 px-2 rounded-full border-primary/20"
                        >
                          {serviceName}
                        </Badge>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground/70 italic">No services assigned</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  {canSendToEditing && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity border-purple-300 text-purple-700 hover:bg-purple-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSendToEditing?.(shoot)
                      }}
                      title="Send to Editing"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Send to Editing</span>
                    </Button>
                  )}
                  {onViewInvoice && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewInvoice(shoot)
                      }}
                      title="View Invoice"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Invoice</span>
                    </Button>
                  )}
                  {onDownload && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDownload(shoot, 'full')
                      }}
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  )}
                  {(isSuperAdmin || isAdmin) && onDelete && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 w-7 sm:w-auto sm:px-2 p-0 bg-red-500 hover:bg-red-600 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(shoot)
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </Card>
  )
}

// Hold-On Shoot Card - matches spec 2.3
const HoldOnShootCard = ({
  shoot,
  onSelect,
  isSuperAdmin = false,
  isAdmin = false,
  isEditingManager = false,
  isEditor = false,
  onDelete,
  onViewInvoice,
  onSendToEditing,
  shouldHideClientDetails = false,
}: {
  shoot: ShootData
  onSelect: (shoot: ShootData) => void
  isSuperAdmin?: boolean
  isAdmin?: boolean
  isEditingManager?: boolean
  isEditor?: boolean
  onDelete?: (shoot: ShootData) => void
  onViewInvoice?: (shoot: ShootData) => void
  onSendToEditing?: (shoot: ShootData) => void
  shouldHideClientDetails?: boolean
}) => {
  const { formatTime, formatDate: formatDatePref } = useUserPreferences()
  const formatDisplayDateLocal = (value?: string | null) => {
    if (!value) return '—'
    try { return formatDatePref(new Date(value)) } catch { return value ?? '—' }
  }
  // Determine hold reason
  const getHoldReason = () => {
    if (!shoot.scheduledDate || shoot.scheduledDate === '') return { label: 'Awaiting Date', color: 'bg-orange-50 text-orange-700 border-orange-200' }
    if ((shoot.payment?.totalPaid ?? 0) < (shoot.payment?.totalQuote ?? 0)) return { label: 'Payment Pending', color: 'bg-red-50 text-red-700 border-red-200' }
    return { label: 'On Hold', color: 'bg-amber-50 text-amber-700 border-amber-200' }
  }

  const holdReason = getHoldReason()
  const displayDate = shoot.scheduledDate ? formatDisplayDateLocal(shoot.scheduledDate) : 'Date not assigned'
  const displayTime = shoot.time && shoot.time !== 'TBD' ? formatTime(shoot.time) : 'Awaiting confirmation'
  const editingNotes = getEditingNotes(shoot.notes)
  const canShowEditingNotes = Boolean(editingNotes) && (isSuperAdmin || isAdmin || isEditingManager || isEditor)
  const shootStatus = String(shoot.status ?? shoot.workflowStatus ?? '').toLowerCase()
  const canSendToEditing = Boolean(onSendToEditing) && shootStatus === 'uploaded'

  return (
    <Card
      className="cursor-pointer border border-border/70 hover:border-primary/50 hover:shadow-lg transition-all bg-card/50 backdrop-blur-sm group"
      onClick={() => onSelect(shoot)}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={holdReason.color}>
                <PauseCircle className="h-3.5 w-3.5 mr-1" />
                {holdReason.label}
              </Badge>
              {canShowEditingNotes && (
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                  Editing Notes
                </Badge>
              )}
            </div>
            <h3 className="font-semibold leading-tight">{shoot.location.fullAddress}</h3>
          </div>
          {canSendToEditing && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity border-purple-300 text-purple-700 hover:bg-purple-50"
              onClick={(e) => {
                e.stopPropagation()
                onSendToEditing?.(shoot)
              }}
              title="Send to Editing"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Invoice button - Available for all roles */}
          {onViewInvoice && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                onViewInvoice(shoot)
              }}
              title="View Invoice"
            >
              <FileText className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Delete button - Only for admin/superadmin */}
          {(isAdmin || isSuperAdmin) && onDelete && (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 gap-1.5 bg-red-500 hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(shoot)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className={!shoot.scheduledDate ? 'text-orange-600 font-medium' : ''}>{displayDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className={shoot.time === 'TBD' ? 'text-orange-600 font-medium' : ''}>{displayTime}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {!shouldHideClientDetails && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{shoot.client.name}</span>
              </div>
            )}
            {shoot.photographer?.name && shoot.photographer.name !== 'Unassigned' && (
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-muted-foreground" />
                <span>{shoot.photographer.name}</span>
              </div>
            )}
          </div>

          {/* Services - Prominent - Always show */}
          {(() => {
            const services = Array.isArray(shoot.services) ? shoot.services : [];
            return (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Services</span>
                </div>
                {services.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {services.map((service, idx) => {
                      const serviceName = typeof service === 'string' 
                        ? service 
                        : (service as any)?.name || (service as any)?.label || String(service);
                      if (!serviceName) return null;
                      return (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="bg-primary/10 text-primary hover:bg-primary/20 font-medium px-3 py-1 text-sm rounded-md border border-primary/20"
                        >
                          {serviceName}
                        </Badge>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/70 italic">No services assigned</p>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </Card>
  )
}

// Legacy list row for backward compatibility
const ShootListRow = ({
  shoot,
  onSelect,
  isSuperAdmin = false,
  shouldHideClientDetails = false,
}: {
  shoot: ShootData
  onSelect: (shoot: ShootData) => void
  isSuperAdmin?: boolean
  shouldHideClientDetails?: boolean
}) => {
  const { formatTime, formatDate: formatDatePref } = useUserPreferences()
  const formatDisplayDateLocal = (value?: string | null) => {
    if (!value) return '—'
    try { return formatDatePref(new Date(value)) } catch { return value ?? '—' }
  }
  const statusLabel = formatWorkflowStatus(shoot.workflowStatus ?? shoot.status ?? '')
  const paymentStatus = isSuperAdmin && shoot.payment?.totalPaid && shoot.payment?.totalQuote
    ? shoot.payment.totalPaid >= shoot.payment.totalQuote
      ? 'Paid'
      : 'Unpaid'
    : null

  return (
    <Card
      className="cursor-pointer border bg-card hover:border-primary/60 transition"
      onClick={() => onSelect(shoot)}
    >
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatDisplayDateLocal(shoot.scheduledDate)}
            {shoot.time ? ` · ${formatTime(shoot.time)}` : ''}
          </p>
          <h3 className="text-lg font-semibold leading-tight">
            {shoot.location.fullAddress}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="uppercase tracking-wide">
            {statusLabel || 'status'}
          </Badge>
          {paymentStatus && (
            <Badge variant={paymentStatus === 'Paid' ? 'secondary' : 'destructive'}>
              {paymentStatus}
            </Badge>
          )}
          {shoot.missingRaw && <Badge variant="destructive">Missing RAW</Badge>}
          {shoot.missingFinal && <Badge variant="secondary">Missing Finals</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Services - Prominent Section */}
        {shoot.services && shoot.services.length > 0 && (
          <div className="space-y-2 pb-4 border-b border-border/50">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Layers className="h-3.5 w-3.5" />
              <span>Services</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {shoot.services.map((service, idx) => {
                const serviceName = typeof service === 'string' 
                  ? service 
                  : (service as any)?.name || (service as any)?.label || String(service);
                return (
                  <Badge 
                    key={idx} 
                    variant="secondary" 
                    className="bg-primary/10 text-primary hover:bg-primary/20 font-medium px-3 py-1 text-sm rounded-md border border-primary/20"
                  >
                    {serviceName}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
        
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          {!shouldHideClientDetails && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <User className="h-3.5 w-3.5" />
                <span>Client</span>
              </div>
              <p className="font-semibold">{shoot.client.name}</p>
              {shoot.client.email && (
                <p className="text-xs text-muted-foreground truncate">{shoot.client.email}</p>
              )}
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Camera className="h-3.5 w-3.5" />
              <span>Photographer</span>
            </div>
            <p className="font-semibold">{shoot.photographer?.name ?? 'Unassigned'}</p>
          </div>
          {isSuperAdmin && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <DollarSign className="h-3.5 w-3.5" />
                <span>Financials</span>
              </div>
              <p className="font-semibold">
                {formatCurrency(shoot.payment?.totalPaid ?? 0)}
                <span className="text-muted-foreground text-xs font-normal"> / {formatCurrency(shoot.payment?.totalQuote ?? 0)}</span>
              </p>
              <p className="text-muted-foreground text-xs">
                Base: {formatCurrency(shoot.payment?.baseQuote ?? 0)} · Tax {formatCurrency(shoot.payment?.taxAmount ?? 0)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Enhanced History Row with expandable details - matches spec 3.3
const HistoryRow = memo(({
  record,
  onViewRecord,
  isBusy,
  onPublishMls,
  isSuperAdmin = false,
  isAdmin = false,
  isEditingManager = false,
  isEditor = false,
  onDelete,
  onViewInvoice,
  onSendToEditing,
  shouldHideClientDetails = false,
}: {
  record: ShootHistoryRecord
  onViewRecord?: (record: ShootHistoryRecord) => void
  isBusy?: boolean
  onPublishMls?: (record: ShootHistoryRecord) => void
  isSuperAdmin?: boolean
  isAdmin?: boolean
  isEditingManager?: boolean
  isEditor?: boolean
  onDelete?: (record: ShootHistoryRecord) => void
  onViewInvoice?: (shoot: ShootData | { id: string | number }) => void
  onSendToEditing?: (shoot: ShootData | { id: string | number }) => void
  shouldHideClientDetails?: boolean
}) => {
  const { formatDate: formatDatePref } = useUserPreferences()
  const formatDisplayDatePref = (value?: string | null) => {
    if (!value) return '—'
    try { return formatDatePref(new Date(value)) } catch { return value ?? '—' }
  }
  const [open, setOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const services = record.services ?? []
  const financials = record.financials ?? {
    baseQuote: 0,
    taxPercent: 0,
    taxAmount: 0,
    totalQuote: 0,
    totalPaid: 0,
  }
  const isPaid = isSuperAdmin ? (financials.totalPaid >= financials.totalQuote) : false
  const statusLabel = (record.status ?? 'scheduled').replace(/_/g, ' ')
  const editingNotesValue = (record.notes as any)?.editingNotes || (record.notes as any)?.editing
  const canShowEditingNotes = Boolean(editingNotesValue) && (isSuperAdmin || isAdmin || isEditingManager || isEditor)
  const recordStatus = String(record.status ?? '').toLowerCase()
  const canSendToEditing = Boolean(onSendToEditing) && recordStatus === 'uploaded'
  
  const handlePublishMls = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onPublishMls || !record?.id) return
    setPublishing(true)
    try {
      await onPublishMls(record)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Card className="overflow-hidden border hover:border-primary/40 transition-colors">
      {/* Collapsed Row - Line 1 & 2 as per spec 3.3.1 */}
      <div
        className="cursor-pointer p-3 sm:p-4 hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((prev) => !prev)}
      >
        {/* Line 1: High-level info */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{formatDisplayDatePref(record.scheduledDate)}</span>
            </div>
            <Badge 
              variant="outline" 
              className={cn(
                'capitalize',
                record.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''
              )}
            >
              {statusLabel}
            </Badge>
            {record.id && (
              <Badge variant="secondary" className="text-[11px] font-semibold">
                ID #{record.id}
              </Badge>
            )}
            {canShowEditingNotes && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                Editing Notes
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {!shouldHideClientDetails && (
              <div className="flex items-center gap-2">
                <span className="font-medium">{record.client?.name ?? 'Unknown'}</span>
                {record.client?.company && (
                  <span className="text-muted-foreground text-sm">({record.client.company})</span>
                )}
              </div>
            )}
            {isSuperAdmin && (
              <div className="flex items-center gap-2 font-medium">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>{formatCurrency(financials.totalQuote)}</span>
                <span className="text-muted-foreground">·</span>
                <Badge variant={isPaid ? 'secondary' : 'destructive'} className="text-xs">
                  {isPaid ? 'Paid' : 'Unpaid'}
                </Badge>
              </div>
            )}
            <div className="flex items-center gap-2">
              {(record as any).mls_id && onPublishMls && !isEditor && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handlePublishMls}
                  disabled={isBusy || publishing}
                  className="gap-1"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3 w-3" />
                      Publish MLS
                    </>
                  )}
                </Button>
              )}
              {onViewRecord && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation()
                    onViewRecord(record)
                  }}
                  disabled={isBusy}
                >
                  {isBusy ? 'Loading…' : 'View shoot'}
                </Button>
              )}
              {canSendToEditing && record.id && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 border-purple-300 text-purple-700 hover:bg-purple-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSendToEditing?.({ id: record.id })
                  }}
                  title="Send to Editing"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
              {/* Invoice button - Available for all roles */}
              {onViewInvoice && record.id && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewInvoice({ id: record.id })
                  }}
                  title="View Invoice"
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              )}
              {/* Delete button - Only for admin/superadmin */}
              {(isAdmin || isSuperAdmin) && onDelete && record.id && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1.5 bg-red-500 hover:bg-red-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(record)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Line 2: Summary */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span className="truncate max-w-[300px]">{record.address?.full ?? '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <span>{record.photographer?.name ?? 'Unassigned'}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {services.slice(0, 3).map((service, idx) => (
              <Badge key={idx} variant="outline" className="text-xs font-normal">
                {typeof service === 'string' ? service : (service as any).name || String(service)}
              </Badge>
            ))}
            {services.length > 3 && (
              <Badge variant="outline" className="text-xs">+{services.length - 3}</Badge>
            )}
          </div>
          <span className="text-muted-foreground">
            Tour: {record.tourPurchased ? 'Yes' : 'No'}
          </span>
          {(record as any).mls_id && !isEditor && (
            <span className="text-muted-foreground">
              MLS: {(record as any).mls_id} · {(record as any).bright_mls_publish_status ? (
                <Badge variant={(record as any).bright_mls_publish_status === 'published' ? 'default' : (record as any).bright_mls_publish_status === 'error' ? 'destructive' : 'secondary'} className="ml-1">
                  {(record as any).bright_mls_publish_status === 'published' ? 'Published' : (record as any).bright_mls_publish_status === 'error' ? 'Error' : 'Pending'}
                </Badge>
              ) : 'Not Published'}
            </span>
          )}
          {record.id && (
            <span className="text-muted-foreground font-medium">ID #{record.id}</span>
          )}
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground ml-auto transition-transform', open && 'rotate-180')} />
        </div>
      </div>

      {/* Expanded Details - spec 3.3.2 */}
      {open && (
        <div className="border-t bg-muted/20 p-3 sm:p-5">
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {/* Column 1: Client & Shoot Meta */}
            <div className="space-y-4">
              {!shouldHideClientDetails && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Client Details
                  </h4>
                  <div className="grid gap-2 text-sm pl-6">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{record.client?.email ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{record.client?.phone ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{record.client?.company ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Layers className="h-4 w-4" />
                      <span>Total shoots: {record.client?.totalShoots ?? 0}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </h4>
                <div className="space-y-2 text-sm pl-6">
                  <div>
                    <span className="text-muted-foreground">Shoot Notes:</span>
                    <p className="mt-0.5">{record.notes?.shoot || 'No notes'}</p>
                  </div>
                  {record.notes?.photographer && (
                    <div>
                      <span className="text-muted-foreground">Photographer Notes:</span>
                      <p className="mt-0.5">{record.notes.photographer}</p>
                    </div>
                  )}
                  {record.notes?.company && (
                    <div>
                      <span className="text-muted-foreground">Company Notes:</span>
                      <p className="mt-0.5">{record.notes.company}</p>
                    </div>
                  )}
                </div>
              </div>

              {record.userCreatedBy && (
                <div className="text-sm pl-6 text-muted-foreground">
                  Created by: {record.userCreatedBy}
                </div>
              )}
            </div>

            {/* Column 2: Financial Summary (Super Admin only) and Services/Completed Date */}
            <div className="space-y-4">
              {/* Financial Summary - Only visible to Super Admin */}
              {isSuperAdmin && (
                <>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Financial Summary
                    </h4>
                    <div className="grid gap-2 text-sm pl-6">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Quote</span>
                        <span className="font-medium">{formatCurrency(financials.baseQuote)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tax ({financials.taxPercent ?? 0}%)</span>
                        <span className="font-medium">{formatCurrency(financials.taxAmount)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 mt-1">
                        <span className="text-muted-foreground">Total Quote</span>
                        <span className="font-semibold">{formatCurrency(financials.totalQuote)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Paid</span>
                        <span className={cn('font-semibold', isPaid ? 'text-emerald-600' : 'text-red-600')}>
                          {formatCurrency(financials.totalPaid)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Payment Details
                    </h4>
                    <div className="grid gap-2 text-sm pl-6">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Payment Date</span>
                        <span>{financials.lastPaymentDate ? formatDisplayDatePref(financials.lastPaymentDate) : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Payment Type</span>
                        <span>{financials.lastPaymentType ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Services
                </h4>
                <div className="flex flex-wrap gap-2 pl-6">
                  {services.length > 0 ? (
                    services.map((service, idx) => (
                      <Badge key={idx} variant="outline">
                        {typeof service === 'string' ? service : (service as any).name || String(service)}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">No services recorded</span>
                  )}
                </div>
              </div>

              <div className="text-sm pl-6">
                <div className="flex justify-between text-muted-foreground">
                  <span>Completed Date</span>
                  <span>{record.completedDate ? formatDisplayDatePref(record.completedDate) : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
})

HistoryRow.displayName = 'HistoryRow'

const HistoryAggregateCard = memo(({ aggregate, isSuperAdmin = false }: { aggregate: ShootHistoryServiceAggregate; isSuperAdmin?: boolean }) => (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Service</p>
          <h3 className="text-lg font-semibold">{aggregate.serviceName}</h3>
        </div>
        <Badge variant="secondary">{aggregate.shootCount} shoots</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-2 text-sm">
      {/* Financial information - Only visible to Super Admin */}
      {isSuperAdmin && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Base Quote</span>
            <span className="font-medium">{formatCurrency(aggregate.baseQuoteTotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-medium">{formatCurrency(aggregate.taxTotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Quote</span>
            <span className="font-medium">{formatCurrency(aggregate.totalQuote)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Paid</span>
            <span className="font-medium">{formatCurrency(aggregate.totalPaid)}</span>
          </div>
        </>
      )}
    </CardContent>
  </Card>
))

HistoryAggregateCard.displayName = 'HistoryAggregateCard'

const ShootMapView = memo(({ markers }: { markers: MapMarker[] }) => {
  const { theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (typeof window === 'undefined' || !mounted) {
    return (
      <div className="h-[520px] rounded-xl border flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p>Loading map...</p>
        </div>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="h-[520px] rounded-xl border flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p>Loading map...</p>
          </div>
        </div>
      }
    >
      <LazyMapView markers={markers} theme={theme} />
    </Suspense>
  )
})

ShootMapView.displayName = 'ShootMapView'

// MLS Queue View Component (embedded in history tab)
const MlsQueueView: React.FC = () => {
  const { toast } = useToast()
  const [queueItems, setQueueItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [manifestDialogOpen, setManifestDialogOpen] = useState(false)
  const [retryingId, setRetryingId] = useState<number | null>(null)

  useEffect(() => {
    loadQueue()
  }, [])

  const loadQueue = async () => {
    setLoading(true)
    try {
      const response = await apiClient.get(API_ROUTES.integrations.brightMls.queue)
      if (response.data.success && Array.isArray(response.data.data)) {
        setQueueItems(response.data.data)
      } else {
        setQueueItems([])
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to load MLS queue.",
        variant: "destructive",
      })
      setQueueItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async (shootId: number) => {
    setRetryingId(shootId)
    try {
      const shootResponse = await apiClient.get(`/shoots/${shootId}`)
      const shoot = shootResponse.data.data

      const photos = shoot.files
        ?.filter((f: any) => f.path || f.url)
        .slice(0, 20)
        .map((f: any) => ({
          url: f.path || f.url || '',
          filename: f.filename || `photo-${f.id}`,
          selected: true,
        })) || []

      const publishResponse = await apiClient.post(
        API_ROUTES.integrations.brightMls.publish(shootId),
        {
          photos,
          iguide_tour_url: shoot.iguide_tour_url,
          documents: shoot.iguide_floorplans?.map((fp: any) => ({
            url: fp.url || fp,
            filename: fp.filename || 'floorplan.pdf',
            visibility: 'private',
          })) || [],
        }
      )

      if (publishResponse.data.success) {
        toast({
          title: "Republished",
          description: "Media manifest has been republished successfully.",
        })
        loadQueue()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to republish.",
        variant: "destructive",
      })
    } finally {
      setRetryingId(null)
    }
  }

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) return <Badge variant="outline">Not Published</Badge>
    switch (status) {
      case 'published':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Published
          </Badge>
        )
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Error
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : queueItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No shoots with MLS IDs found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="p-3 text-left text-sm font-medium">Shoot ID</th>
                    <th className="p-3 text-left text-sm font-medium">Address</th>
                    <th className="p-3 text-left text-sm font-medium">MLS ID</th>
                    <th className="p-3 text-left text-sm font-medium">Client</th>
                    <th className="p-3 text-left text-sm font-medium">Photographer</th>
                    <th className="p-3 text-left text-sm font-medium">Status</th>
                    <th className="p-3 text-left text-sm font-medium">Last Published</th>
                    <th className="p-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queueItems.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-medium">#{item.id}</td>
                      <td className="p-3">{item.address}</td>
                      <td className="p-3">{item.mls_id || '—'}</td>
                      <td className="p-3">{item.client}</td>
                      <td className="p-3">{item.photographer}</td>
                      <td className="p-3">{getStatusBadge(item.status)}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {formatDate(item.last_published)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {item.response && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedItem(item)
                                  setManifestDialogOpen(true)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {item.status === 'error' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetry(item.id)}
                              disabled={retryingId === item.id}
                            >
                              {retryingId === item.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <RefreshCw className="mr-1 h-4 w-4" />
                                  Retry
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={loadQueue} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {manifestDialogOpen && selectedItem && (
        <Dialog open={manifestDialogOpen} onOpenChange={setManifestDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Publish Details</DialogTitle>
              <DialogDescription>
                View manifest response and error details
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[500px] overflow-auto">
              <div className="space-y-4">
                {selectedItem.manifest_id && (
                  <div>
                    <p className="text-sm font-medium">Manifest ID</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedItem.manifest_id}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-2">Response</p>
                  <pre className="text-xs bg-muted p-4 rounded-md overflow-auto">
                    {JSON.stringify(
                      typeof selectedItem.response === 'string'
                        ? JSON.parse(selectedItem.response)
                        : selectedItem.response,
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

const ShootHistory: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { role, user } = useAuth()
  const { formatTime, formatDate: formatDatePref } = useUserPreferences()
  
  // Local formatDisplayDate that uses user preference
  const formatDisplayDatePref = (value?: string | null) => {
    if (!value) return '—'
    try {
      return formatDatePref(new Date(value))
    } catch (error) {
      return value
    }
  }
  
  const isSuperAdmin = role === 'superadmin'
  const isEditingManager = role === 'editing_manager'
  const isAdmin = role === 'admin'
  const isPhotographer = role === 'photographer'
  const isEditor = role === 'editor'
  const shouldHideClientDetails = isEditor
  const canViewAllShoots = isSuperAdmin || isAdmin || isEditingManager // Super Admin, Admin, and Editing Manager can see all shoots
  const canViewHistory = HISTORY_ALLOWED_ROLES.has((role as string) ?? '')
  const canViewInvoice = !isPhotographer && !isEditor && !isEditingManager // Hide invoice for photographers, editors, and editing managers
  
  // Linked accounts should only be available for non-super admin users
  const canViewLinkedAccounts = !isSuperAdmin && !isAdmin && !isEditingManager // Only clients can have linked accounts
  
  // Linked accounts state
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([])
  const [sharedData, setSharedData] = useState<any>(null)
  const [linkedLoading, setLinkedLoading] = useState(false)
  const [linkedAccountsLoaded, setLinkedAccountsLoaded] = useState(false)
  
  // Check if user has linked accounts
  const hasLinkedAccounts = linkedAccounts.length > 0
  
  const tabList: AvailableTab[] = useMemo(
    () => {
      if (isEditor) {
        return canViewHistory ? ['editing', 'edited', 'history'] : ['editing', 'edited']
      }
      const tabs: AvailableTab[] = canViewHistory
        ? ['scheduled', 'completed', 'delivered', 'hold', 'history']
        : ['scheduled', 'completed', 'delivered', 'hold']
      // Add linked tab for eligible users; load data lazily when the tab is opened.
      if (canViewLinkedAccounts) {
        return [...tabs, 'linked']
      }
      return tabs
    },
    [canViewHistory, canViewLinkedAccounts, isEditor]
  )

  const [activeTab, setActiveTab] = useState<AvailableTab>(tabList[0])
  const [inProgressSubTab, setInProgressSubTab] = useState<'all' | 'uploaded' | 'editing'>('all')
  // For client, editor, photographer - default to 'delivered' and hide subtabs
  const hideDeliveredSubTabs = ['client', 'editor', 'photographer'].includes(role || '')
  const [deliveredSubTab, setDeliveredSubTab] = useState<'all' | 'delivered' | 'ready'>(hideDeliveredSubTabs ? 'delivered' : 'all')
  const [holdSubTab, setHoldSubTab] = useState<'all' | 'on_hold' | 'cancelled'>('all')
  const [historySubTab, setHistorySubTab] = useState<'all' | 'mls-queue'>('all')
  const [scheduledSubTab, setScheduledSubTab] = useState<'all' | 'requested' | 'scheduled'>('all')
  // Load viewMode from localStorage or default to 'list'
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shootHistory_viewMode')
      if (saved && ['grid', 'list', 'map'].includes(saved)) {
        return saved as 'grid' | 'list' | 'map'
      }
    }
    return 'list'
  })
  // Load pinned tabs from localStorage
  const [pinnedTabs, setPinnedTabs] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shootHistory_pinnedTabs')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return new Set(Array.isArray(parsed) ? parsed : [])
        } catch {
          return new Set<string>()
        }
      }
    }
    return new Set<string>()
  })
  const [operationalFilters, setOperationalFilters] = useState<OperationalFiltersState>(DEFAULT_OPERATIONAL_FILTERS)
  const defaultHistoryDateRange = isEditor ? 'all' : DEFAULT_HISTORY_FILTERS.dateRange
  const defaultHistoryFilters = useMemo(
    () => ({ ...DEFAULT_HISTORY_FILTERS, dateRange: defaultHistoryDateRange }),
    [defaultHistoryDateRange],
  )
  const [historyFilters, setHistoryFilters] = useState<HistoryFiltersState>(defaultHistoryFilters)
  const [deleteShootId, setDeleteShootId] = useState<string | number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [operationalData, setOperationalData] = useState<ShootData[]>([])
  const [historyRecords, setHistoryRecords] = useState<ShootHistoryRecord[]>([])
  const [historyAggregates, setHistoryAggregates] = useState<ShootHistoryServiceAggregate[]>([])
  const [historyMeta, setHistoryMeta] = useState<HistoryMeta | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [operationalPage, setOperationalPage] = useState(1)
  const [operationalMeta, setOperationalMeta] = useState<{ current_page: number; per_page: number; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [operationalFiltersOpen, setOperationalFiltersOpen] = useState(false)
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false)
  const [operationalOptions, setOperationalOptions] = useState<FilterCollections>(EMPTY_FILTER_COLLECTION)
  const [historyOptions, setHistoryOptions] = useState<FilterCollections>(EMPTY_FILTER_COLLECTION)
  const [geoCache, setGeoCache] = useState<Record<string, { lat: number; lng: number }>>({})
  const [selectedShoot, setSelectedShoot] = useState<ShootData | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false)
  const [bulkShoots, setBulkShoots] = useState<ShootData[]>([])
  const [bulkShootsLoading, setBulkShootsLoading] = useState(false)
  const [approvalModalShoot, setApprovalModalShoot] = useState<ShootData | null>(null)
  const [declineModalShoot, setDeclineModalShoot] = useState<ShootData | null>(null)
  const [editModalShoot, setEditModalShoot] = useState<ShootData | null>(null)
  const [photographers, setPhotographers] = useState<Array<{ id: string | number; name: string; avatar?: string }>>([]);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  useEffect(() => {
    if (!shouldHideClientDetails) return
    if (operationalFilters.clientId) {
      setOperationalFilters((prev) => ({ ...prev, clientId: '' }))
    }
    if (historyFilters.clientId) {
      setHistoryFilters((prev) => ({ ...prev, clientId: '' }))
    }
  }, [shouldHideClientDetails, operationalFilters.clientId, historyFilters.clientId])

  const operationalFetchAbortRef = useRef<AbortController | null>(null)
  const historyFetchAbortRef = useRef<AbortController | null>(null)

  // Track if we've applied pinned tab on initial mount
  const hasAppliedPinnedTab = useRef(false)

  // Ensure activeTab is valid when tabList changes, and prioritize pinned tabs on mount
  useEffect(() => {
    // On initial mount or when tabList changes, check for pinned tab
    const pinnedArray = Array.from(pinnedTabs)
    if (pinnedArray.length > 0 && !hasAppliedPinnedTab.current) {
      const pinnedTab = pinnedArray.find((tab) => tabList.includes(tab as AvailableTab))
      if (pinnedTab) {
        // Switch to pinned tab if it's available (only on initial mount)
        setActiveTab(pinnedTab as AvailableTab)
        hasAppliedPinnedTab.current = true
        return
      }
    }
    
    // If no pinned tab or pinned tab is not available, ensure activeTab is valid
    if (!tabList.includes(activeTab)) {
      setActiveTab(tabList[0])
    }
    
    // Mark as applied after first check
    if (!hasAppliedPinnedTab.current) {
      hasAppliedPinnedTab.current = true
    }
  }, [tabList, activeTab, pinnedTabs])

  // Save viewMode to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('shootHistory_viewMode', viewMode)
    }
  }, [viewMode])

  // Save pinned tabs to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('shootHistory_pinnedTabs', JSON.stringify(Array.from(pinnedTabs)))
    }
  }, [pinnedTabs])

  // Set default viewMode to 'list' when scheduled tab is active (but respect saved preference)
  useEffect(() => {
    if (activeTab === 'scheduled' && viewMode !== 'list') {
      // Only override if user hasn't explicitly set a preference for scheduled tab
      const saved = localStorage.getItem('shootHistory_viewMode')
      if (!saved || saved === 'list') {
        setViewMode('list')
      }
    }
  }, [activeTab, viewMode]) // Only depend on activeTab to avoid infinite loop

  // Toggle pin for a tab
  const togglePinTab = useCallback((tabValue: string) => {
    setPinnedTabs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(tabValue)) {
        // Unpin the tab
        newSet.delete(tabValue)
      } else {
        // Pin the tab (only one tab can be pinned at a time)
        newSet.clear()
        newSet.add(tabValue)
        // Automatically switch to the pinned tab
        setActiveTab(tabValue as AvailableTab)
      }
      return newSet
    })
  }, [])

  // Reset sub-tabs when switching tabs
  useEffect(() => {
    if (activeTab !== 'scheduled') {
      setScheduledSubTab('all')
    }
    if (activeTab !== 'completed') {
      setInProgressSubTab('all')
    }
    if (activeTab !== 'delivered') {
      // For client/editor/photographer, always use 'delivered'; others use 'all'
      setDeliveredSubTab(hideDeliveredSubTabs ? 'delivered' : 'all')
    }
    if (activeTab !== 'hold') {
      setHoldSubTab('all')
    }
  }, [activeTab, hideDeliveredSubTabs])

  // Fetch photographers only when approval modal is used
  useEffect(() => {
    if (!(isAdmin || isSuperAdmin)) return
    if (!approvalModalShoot) return
    if (photographers.length) return

    const fetchPhotographers = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token')
        const response = await axios.get(`${API_BASE_URL}/api/admin/photographers`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = response.data?.data || response.data || []
        setPhotographers(data.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })))
      } catch (error) {
        console.error('Error fetching photographers:', error)
      }
    }

    fetchPhotographers()
  }, [approvalModalShoot, isAdmin, isSuperAdmin, photographers.length])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem('shootGeoCache')
      if (stored) {
        setGeoCache(JSON.parse(stored))
      }
    } catch (error) {
      // Ignore malformed cache
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('shootGeoCache', JSON.stringify(geoCache))
    } catch (error) {
      // ignore
    }
  }, [geoCache])

  useEffect(() => {
    setLinkedAccountsLoaded(false)
    setLinkedAccounts([])
    setSharedData(null)
  }, [user?.id])

  // Fetch linked accounts data when the linked tab is opened
  useEffect(() => {
    if (!canViewLinkedAccounts) return
    if (activeTab !== 'linked') return
    if (linkedAccountsLoaded) return

    const fetchLinkedAccounts = async () => {
      try {
        const token = localStorage.getItem('authToken')
        if (!token) return

        setLinkedLoading(true)

        // Fetch linked accounts
        const linksResponse = await fetch(`${API_BASE_URL}/api/admin/account-links`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (linksResponse.ok) {
          const linksData = await linksResponse.json()
          setLinkedAccounts(linksData.links || [])

          // Fetch shared data for the user
          if (user?.id) {
            const sharedResponse = await fetch(`${API_BASE_URL}/api/admin/account-links/shared-data/${user.id}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            })

            if (sharedResponse.ok) {
              const sharedDataResponse = await sharedResponse.json()
              setSharedData(sharedDataResponse)
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch linked accounts:', error)
      } finally {
        setLinkedLoading(false)
        setLinkedAccountsLoaded(true)
      }
    }

    fetchLinkedAccounts()
  }, [activeTab, canViewLinkedAccounts, linkedAccountsLoaded, user?.id])

  const handleDetailDialogToggle = useCallback(
    (open: boolean) => {
      setIsDetailOpen(open)
      if (!open && !isUploadDialogOpen) {
        setSelectedShoot(null)
      }
    },
    [isUploadDialogOpen],
  )

  const handleUploadDialogToggle = useCallback(
    (open: boolean) => {
      setIsUploadDialogOpen(open)
      if (!open && !isDetailOpen) {
        setSelectedShoot(null)
      }
    },
    [isDetailOpen],
  )

  const handleShootSelect = useCallback((shoot: ShootData) => {
    setSelectedShoot(shoot)
    setIsDetailOpen(true)
  }, [])

  const handleUploadMedia = useCallback((shoot: ShootData) => {
    setSelectedShoot(shoot)
    setIsUploadDialogOpen(true)
  }, [])

  const loadShootById = useCallback(
    async (shootId: string | number, options: { openDetail?: boolean; quiet?: boolean } = {}) => {
      setDetailLoading(true)
      try {
        const response = await apiClient.get(`/shoots/${shootId}`)
        const payload = response.data?.data ?? response.data
        if (!payload) {
          throw new Error('Shoot not found')
        }
        const mapped = mapShootApiToShootData(payload as Record<string, unknown>)
        setSelectedShoot(mapped)
        if (options.openDetail) {
          setIsDetailOpen(true)
        }
        return mapped
      } catch (error) {
        if (!options.quiet) {
          toast({
            title: 'Unable to load shoot',
            description: 'Please try again.',
            variant: 'destructive',
          })
        }
        return null
      } finally {
        setDetailLoading(false)
      }
    },
    [toast],
  )

  const handleHistoryRecordSelect = useCallback(
    (record: ShootHistoryRecord) => {
      if (!record?.id) {
        toast({
          title: 'Shoot unavailable',
          description: 'This history record is missing a shoot id.',
          variant: 'destructive',
        })
        return
      }
      loadShootById(record.id, { openDetail: true })
    },
    [loadShootById, toast],
  )

  const handleDeleteShoot = useCallback((shoot: ShootData) => {
    setDeleteShootId(shoot.id)
  }, [])

  const handleDeleteHistoryRecord = useCallback((record: ShootHistoryRecord) => {
    if (record.id) {
      setDeleteShootId(record.id)
    }
  }, [])

  const handleViewInvoice = useCallback(async (shoot: ShootData | { id: string | number }) => {
    setInvoiceLoading(true)
    try {
      const shootId = 'id' in shoot ? shoot.id : (shoot as ShootData).id
      const response = await apiClient.get(`/shoots/${shootId}/invoice`)
      const invoiceData = response.data?.data || response.data
      if (invoiceData) {
        setSelectedInvoice(invoiceData)
        setInvoiceDialogOpen(true)
      } else {
        toast({
          title: 'Invoice not found',
          description: 'Unable to load invoice for this shoot.',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      console.error('Error fetching invoice:', error)
      toast({
        title: 'Error loading invoice',
        description: error.response?.data?.message || 'Unable to load invoice. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setInvoiceLoading(false)
    }
  }, [toast])

  const handlePrimaryAction = useCallback(
    (action: ShootAction | undefined, shoot: ShootData) => {
      if (!action) {
        handleShootSelect(shoot)
        return
      }

      switch (action.action) {
        case 'pay':
          navigate(`/shoots/${shoot.id}?action=pay`)
          return
        case 'upload_raw':
        case 'upload_final':
          handleUploadMedia(shoot)
          return
        case 'view_media':
          handleShootSelect(shoot)
          return
        case 'open_workflow':
        case 'assign_editor':
        case 'start_editing':
          navigate(`/shoots/${shoot.id}#workflow`)
          return
        default:
          handleShootSelect(shoot)
      }
    },
    [handleShootSelect, handleUploadMedia, navigate],
  )

  const fetchOperationalData = useCallback(async () => {
    operationalFetchAbortRef.current?.abort()
    const controller = new AbortController()
    operationalFetchAbortRef.current = controller
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now()

    setLoading(true)
    try {
      let backendTab = (['scheduled', 'completed', 'delivered', 'hold', 'editing', 'edited'] as const).includes(activeTab as any)
        ? (activeTab as ActiveOperationalTab)
        : 'scheduled'

      if (isEditor) {
        if (backendTab === 'editing') {
          backendTab = 'completed'
        } else if (backendTab === 'edited') {
          backendTab = 'delivered'
        } else if (backendTab === 'scheduled') {
          backendTab = 'completed'
        }
      }

      const params: Record<string, unknown> = { tab: backendTab, page: operationalPage, per_page: 9, include_files: 'true' }
      if (operationalFilters.search) params.search = operationalFilters.search
      if (!shouldHideClientDetails && operationalFilters.clientId) params.client_id = operationalFilters.clientId
      if (operationalFilters.photographerId) params.photographer_id = operationalFilters.photographerId
      if (operationalFilters.address) params.address = operationalFilters.address
      if (operationalFilters.services.length) params.services = operationalFilters.services
      if (operationalFilters.dateRange !== 'all') {
        if (operationalFilters.dateRange === 'custom') {
          if (operationalFilters.scheduledStart) params.scheduled_start = operationalFilters.scheduledStart
          if (operationalFilters.scheduledEnd) params.scheduled_end = operationalFilters.scheduledEnd
        } else {
          params.date_range = operationalFilters.dateRange
        }
      }

      const response = await apiClient.get('/shoots', {
        params,
        signal: controller.signal,
      })
      const payload = (response.data ?? {}) as { data?: unknown; meta?: { filters?: FilterCollections } }
      const shoots = Array.isArray(payload.data) ? (payload.data as Record<string, unknown>[]) : []
      const mappedShoots = shoots.map(mapShootApiToShootData)
      
      // Filter shoots based on role: Super Admin/Admin see all, others see only their own
      // Apply role visibility
      const roleFilteredShoots = canViewAllShoots
        ? mappedShoots
        : mappedShoots.filter((shoot) => {
            if (role === 'client') {
              const userId = user?.id ? String(user.id) : ''
              const clientId = shoot.client?.id ? String(shoot.client.id) : ''
              if (userId && clientId) return userId === clientId

              const userEmail = user?.email?.toLowerCase() || ''
              const userName = user?.name?.toLowerCase() || ''
              const shootClientEmail = shoot.client?.email?.toLowerCase() || ''
              const shootClientName = shoot.client?.name?.toLowerCase() || ''

              if (!userId && !userEmail && !userName) return true
              return shootClientEmail === userEmail || shootClientName === userName
            }

            if (role === 'photographer') {
              const userId = user?.id ? String(user.id) : ''
              const photographerId = shoot.photographer?.id ? String(shoot.photographer.id) : ''
              if (userId && photographerId) return userId === photographerId

              const userName = user?.name?.toLowerCase() || ''
              const photographerName = shoot.photographer?.name?.toLowerCase() || ''
              if (!userId && !userName) return true
              return photographerName === userName
            }

            if (role === 'editor') {
              const userId = user?.id ? String(user.id) : ''
              const editorId = shoot.editor?.id ? String(shoot.editor.id) : ''
              if (userId && editorId) return userId === editorId

              const userName = user?.name?.toLowerCase() || ''
              const editorName = shoot.editor?.name?.toLowerCase() || ''
              if (!editorId && !editorName) return true
              if (!userId && !userName) return true
              return editorName === userName
            }

            return true
          })

      // Hide private-exclusive listings from default views
      const visibleShoots = roleFilteredShoots.filter((shoot) => !shoot.isPrivateListing)

      // Apply status filter per active tab (using status or workflowStatus)
      const filterTab = (['scheduled', 'completed', 'delivered', 'hold', 'editing', 'edited'] as const).includes(activeTab as any)
        ? (activeTab as ActiveOperationalTab)
        : backendTab
      const allowedStatuses = STATUS_FILTERS_BY_TAB[filterTab] ?? STATUS_FILTERS_BY_TAB.scheduled
      const filteredByStatus = visibleShoots.filter((shoot) => {
        const status = (shoot.workflowStatus || shoot.status || '').toLowerCase()
        return allowedStatuses.some((allowed) => status.includes(allowed))
      })

      setOperationalData(filteredByStatus)

      // Set pagination meta if available
      const meta = payload.meta as any
      if (meta && (meta.current_page !== undefined || meta.total !== undefined || meta.count !== undefined)) {
        setOperationalMeta({
          current_page: meta.current_page ?? operationalPage,
          per_page: 9, // Always use 9 for display consistency
          total: meta.total ?? meta.count ?? 0, // Backend returns 'count', but we use 'total' for consistency
        })
      } else {
        // Fallback: create meta from current data - but this shouldn't happen if backend returns proper meta
        setOperationalMeta({
          current_page: operationalPage,
          per_page: 9,
          total: 0, // Don't use filteredByStatus.length as it's only current page items
        })
      }

      const filtersMeta: FilterCollections = payload.meta?.filters ?? deriveFilterOptionsFromShoots(mappedShoots)
      setOperationalOptions(shouldHideClientDetails ? { ...filtersMeta, clients: [] } : filtersMeta)
    } catch (error) {
      if (axios.isAxiosError(error) && (error.code === 'ERR_CANCELED' || error.name === 'CanceledError')) {
        // Request was aborted, loading will be cleared in finally block
        return
      }
      console.error('Error fetching operational data:', error)
      let errorMessage = 'Please try refreshing the page.'
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          errorMessage = 'Unable to connect to the server. Please check your connection and ensure the backend is running.'
        } else if (error.response) {
          const status = error.response.status
          const data = error.response.data
          if (status === 401 || status === 419) {
            errorMessage = 'Your session has expired. Please log in again.'
          } else if (status === 403) {
            errorMessage = 'You do not have permission to view this data.'
          } else if (status >= 500) {
            errorMessage = data?.message || data?.error || 'Server error occurred. Please try again later.'
          } else {
            errorMessage = data?.message || data?.error || `Request failed with status ${status}.`
          }
        } else {
          errorMessage = error.message || 'An unexpected error occurred.'
        }
      } else if (error instanceof Error) {
        errorMessage = error.message
      }
      
      toast({
        title: 'Unable to load shoots',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now()
      console.debug('[ShootHistory] operational fetch', {
        tab: activeTab,
        ms: Math.round(end - start),
      })

      // Always clear loading state if this is still the current request
      // This prevents loading from getting stuck if a new request starts
      if (operationalFetchAbortRef.current === controller) {
        operationalFetchAbortRef.current = null
        setLoading(false)
      } else if (!operationalFetchAbortRef.current) {
        // If no current request, make sure loading is cleared
        setLoading(false)
      }
    }
  }, [activeTab, operationalFilters, operationalPage, toast, canViewAllShoots, role, user])

  const fetchBulkShoots = useCallback(async () => {
    if (!(isSuperAdmin || isAdmin)) return
    setBulkShootsLoading(true)

    try {
      const tabs: Array<'scheduled' | 'completed' | 'delivered' | 'hold'> = [
        'scheduled',
        'completed',
        'delivered',
        'hold',
      ]

      const responses = await Promise.all(
        tabs.map((tab) =>
          apiClient.get('/shoots', {
            params: {
              tab,
              page: 1,
              per_page: 200,
              include_files: 'true',
            },
          }),
        ),
      )

      const combined = responses.flatMap((response) => {
        const payload = response.data?.data ?? response.data
        return Array.isArray(payload) ? payload : []
      })

      const mapped = combined.map(mapShootApiToShootData)
      const unique = Array.from(new Map(mapped.map((shoot) => [shoot.id, shoot])).values())
      setBulkShoots(unique)
    } catch (error: any) {
      console.error('Error fetching bulk shoots:', error)
      toast({
        title: 'Unable to load bulk shoots',
        description: error?.response?.data?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setBulkShootsLoading(false)
    }
  }, [isAdmin, isSuperAdmin, toast])

  useEffect(() => {
    if (!isBulkActionsOpen) return
    fetchBulkShoots()
  }, [isBulkActionsOpen, fetchBulkShoots])

  const fetchHistoryData = useCallback(async () => {
    if (!canViewHistory) {
      setLoading(false)
      return
    }
    historyFetchAbortRef.current?.abort()
    const controller = new AbortController()
    historyFetchAbortRef.current = controller
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now()

    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        group_by: historyFilters.groupBy,
        page: historyPage,
        per_page: 9,
      }
      if (historyFilters.search) params.search = historyFilters.search
      if (!shouldHideClientDetails && historyFilters.clientId) params.client_id = historyFilters.clientId
      if (historyFilters.photographerId) params.photographer_id = historyFilters.photographerId
      if (historyFilters.services.length) params.services = historyFilters.services
      if (historyFilters.dateRange && historyFilters.dateRange !== 'all') {
        if (historyFilters.dateRange === 'custom') {
          if (historyFilters.scheduledStart) params.custom_start = historyFilters.scheduledStart
          if (historyFilters.scheduledEnd) params.custom_end = historyFilters.scheduledEnd
          params.date_range = 'custom'
        } else {
          params.date_range = historyFilters.dateRange
        }
      }
      if (historyFilters.scheduledStart && historyFilters.dateRange !== 'custom') params.scheduled_start = historyFilters.scheduledStart
      if (historyFilters.scheduledEnd && historyFilters.dateRange !== 'custom') params.scheduled_end = historyFilters.scheduledEnd
      if (historyFilters.completedStart) params.completed_start = historyFilters.completedStart
      if (historyFilters.completedEnd) params.completed_end = historyFilters.completedEnd

      const response = await apiClient.get('/shoots/history', {
        params,
        signal: controller.signal,
      })

      const payload = (response.data ?? {}) as {
        data?: unknown
        meta?: { filters?: FilterCollections; current_page?: number; per_page?: number; total?: number }
      }
      const isServiceGrouping = historyFilters.groupBy === 'services'

      const rows = Array.isArray(payload.data) ? payload.data : []
      const visibleRows = rows.filter((record) => {
        const recordAny = record as any
        return !(recordAny?.is_private_listing || recordAny?.isPrivateListing)
      })

      if (isServiceGrouping) {
        setHistoryAggregates(visibleRows as ShootHistoryServiceAggregate[])
        setHistoryRecords([])
        setHistoryMeta(null)
      } else {
        setHistoryRecords(visibleRows as ShootHistoryRecord[])
        setHistoryAggregates([])
        setHistoryMeta(
          payload.meta
            ? {
                current_page: payload.meta.current_page ?? 1,
                per_page: 9, // Always use 9 for display consistency
                total: payload.meta.total ?? 0, // Only use backend total, don't fallback to rows.length
              }
            : null,
        )
      }

      if (payload.meta?.filters) {
        const metaFilters = payload.meta.filters
        setHistoryOptions(shouldHideClientDetails ? { ...metaFilters, clients: [] } : metaFilters)
      }
    } catch (error) {
      if (axios.isAxiosError(error) && (error.code === 'ERR_CANCELED' || error.name === 'CanceledError')) {
        // Request was aborted, loading will be cleared in finally block
        return
      }
      console.error('History fetch error:', error)
      let errorMessage = 'Please try refreshing the page.'
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          errorMessage = 'Unable to connect to the server. Please check your connection and ensure the backend is running.'
        } else if (error.response) {
          const status = error.response.status
          const data = error.response.data
          if (status === 401 || status === 419) {
            errorMessage = 'Your session has expired. Please log in again.'
          } else if (status === 403) {
            errorMessage = 'You do not have permission to view this data.'
          } else if (status >= 500) {
            errorMessage = data?.message || data?.error || 'Server error occurred. Please try again later.'
          } else {
            errorMessage = data?.message || data?.error || `Request failed with status ${status}.`
          }
        } else {
          errorMessage = error.message || 'An unexpected error occurred.'
        }
      } else if (error instanceof Error) {
        errorMessage = error.message
      }
      
      toast({
        title: 'Unable to load history',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now()
      console.debug('[ShootHistory] history fetch', {
        ms: Math.round(end - start),
        page: historyPage,
        groupBy: historyFilters.groupBy,
      })

      // Always clear loading state if this is still the current request
      // This prevents loading from getting stuck if a new request starts
      if (historyFetchAbortRef.current === controller) {
        historyFetchAbortRef.current = null
        setLoading(false)
      } else if (!historyFetchAbortRef.current) {
        // If no current request, make sure loading is cleared
        setLoading(false)
      }
    }
  }, [historyFilters, historyPage, canViewHistory, toast])

  const handlePublishMls = useCallback(
    async (record: ShootHistoryRecord) => {
      if (!record?.id || !(record as any).mls_id) {
        toast({
          title: 'Cannot publish',
          description: 'This shoot does not have an MLS ID.',
          variant: 'destructive',
        })
        return
      }

      try {
        // Load shoot details first
        const shoot = await loadShootById(record.id, { quiet: true })
        if (!shoot) {
          throw new Error('Shoot not found')
        }

        // Prepare photos from shoot files
        const photos = (shoot.files || [])
          .filter((f: any) => f.path || f.url)
          .slice(0, 20)
          .map((f: any) => ({
            id: f.id,
            url: f.path || f.url || '',
            filename: f.filename || `photo-${f.id}`,
            selected: true,
          }))

        // Publish to Bright MLS
        const response = await apiClient.post(
          API_ROUTES.integrations.brightMls.publish(record.id),
          {
            photos,
            iguide_tour_url: (shoot as any).iguide_tour_url,
            documents: ((shoot as any).iguide_floorplans || []).map((fp: any) => ({
              url: fp.url || fp,
              filename: fp.filename || 'floorplan.pdf',
              visibility: 'private',
            })),
          }
        )

        if (response.data.success) {
          toast({
            title: 'Published to Bright MLS',
            description: 'Media manifest has been published successfully.',
          })
          // Refresh history data to show updated status
          await fetchHistoryData()
        } else {
          throw new Error(response.data.message || 'Publishing failed')
        }
      } catch (error: any) {
        toast({
          title: 'Publish failed',
          description: error.response?.data?.message || error.message || 'Failed to publish to Bright MLS.',
          variant: 'destructive',
        })
      }
    },
    [loadShootById, toast, fetchHistoryData],
  )

  // Safety timeout to prevent loading from getting stuck
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('[ShootHistory] Loading timeout - clearing loading state after 30s')
        setLoading(false)
      }
    }, 30000) // 30 second timeout

    return () => clearTimeout(timeoutId)
  }, [loading])

  // Track last active tab to detect tab changes
  const lastActiveTabRef = useRef(activeTab)

  useEffect(() => {
    // Reset page when tab changes
    const tabChanged = lastActiveTabRef.current !== activeTab
    lastActiveTabRef.current = activeTab
    
    if (tabChanged) {
      if (activeTab === 'history') {
        setHistoryPage(1)
      } else {
        setOperationalPage(1)
      }
    }
  }, [activeTab])

  // Fetch history data when page changes or tab changes to history
  useEffect(() => {
    if (activeTab === 'history' && canViewHistory) {
      // Always fetch when page changes
      fetchHistoryData()
    }
  }, [historyPage, activeTab, canViewHistory, fetchHistoryData])

  // Fetch operational data when page changes or tab changes away from history
  useEffect(() => {
    if (activeTab !== 'history') {
      // Always fetch when page changes
      fetchOperationalData()
    }
  }, [operationalPage, activeTab, fetchOperationalData])

  const refreshActiveTabData = useCallback(async () => {
    if (activeTab === 'history') {
      await fetchHistoryData()
    } else {
      await fetchOperationalData()
    }
  }, [activeTab, fetchHistoryData, fetchOperationalData])

  useEffect(() => registerShootHistoryRefresh(refreshActiveTabData), [refreshActiveTabData])

  const handleSendToEditing = useCallback(
    async (shoot: ShootData) => {
      if (!shoot?.id) return
      try {
        const currentStatus = shoot.status || shoot.workflowStatus || 'booked'
        if (String(currentStatus).toLowerCase() !== 'uploaded') {
          throw new Error('Shoot must be in Uploaded status before sending to editing')
        }

        await apiClient.post(`/shoots/${shoot.id}/start-editing`)

        toast({
          title: 'Success',
          description: 'Shoot sent to editing',
        })

        await refreshActiveTabData()

        if (selectedShoot?.id && String(selectedShoot.id) === String(shoot.id)) {
          await loadShootById(selectedShoot.id, { openDetail: isDetailOpen, quiet: true })
        }
      } catch (error: any) {
        console.error('Send to editing error:', error)
        toast({
          title: 'Error',
          description: error?.response?.data?.message || error?.message || 'Failed to send to editing',
          variant: 'destructive',
        })
      }
    },
    [toast, refreshActiveTabData, selectedShoot, loadShootById, isDetailOpen],
  )

  const confirmDeleteShoot = useCallback(async () => {
    if (!deleteShootId) return

    setIsDeleting(true)
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/shoots/${deleteShootId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete shoot' }))
        throw new Error(errorData.message || 'Failed to delete shoot')
      }

      toast({
        title: 'Success',
        description: 'Shoot deleted successfully',
      })

      // Refresh the data
      if (selectedShoot?.id && String(selectedShoot.id) === String(deleteShootId)) {
        setSelectedShoot(null)
        setIsDetailOpen(false)
      }
      
      // Trigger refresh
      await refreshActiveTabData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete shoot',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
      setDeleteShootId(null)
    }
  }, [deleteShootId, toast, selectedShoot, refreshActiveTabData])

  const handleUploadComplete = useCallback(async () => {
    setIsUploadDialogOpen(false)
    await refreshActiveTabData()
    if (selectedShoot?.id) {
      await loadShootById(selectedShoot.id, { openDetail: isDetailOpen, quiet: true })
    }
  }, [refreshActiveTabData, selectedShoot, loadShootById, isDetailOpen])

  const onOperationalFilterChange = <K extends keyof OperationalFiltersState>(
    key: K,
    value: OperationalFiltersState[K],
  ) => {
    // Convert "all" to empty string for clientId and photographerId to maintain compatibility with filtering logic
    if ((key === 'clientId' || key === 'photographerId') && value === 'all') {
      setOperationalFilters((prev) => ({ ...prev, [key]: '' as OperationalFiltersState[K] }))
    } else {
    setOperationalFilters((prev) => ({ ...prev, [key]: value }))
    }
    setOperationalPage(1)
  }

  const onHistoryFilterChange = <K extends keyof HistoryFiltersState>(
    key: K,
    value: HistoryFiltersState[K],
  ) => {
    // Convert "all" to empty string for clientId and photographerId to maintain compatibility with filtering logic
    const processedValue = (key === 'clientId' || key === 'photographerId') && value === 'all' 
      ? '' as HistoryFiltersState[K]
      : value
    setHistoryFilters((prev) => {
      const next = { ...prev, [key]: processedValue }
      if (key === 'groupBy' && processedValue === 'services') {
        next.viewAs = 'list'
      }
      return next
    })
    setHistoryPage(1)
  }

  const resetOperationalFilters = () => {
    setOperationalFilters(DEFAULT_OPERATIONAL_FILTERS)
    setOperationalPage(1)
  }

  const resetHistoryFilters = () => {
    setHistoryFilters(defaultHistoryFilters)
    setHistoryPage(1)
  }

  // Filter operational data based on sub-tabs
  const filteredOperationalData = useMemo(() => {
    // Scheduled tab filtering
    if (activeTab === 'scheduled') {
      if (scheduledSubTab === 'all') return operationalData
      if (scheduledSubTab === 'requested') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return status === 'requested'
        })
      }
      if (scheduledSubTab === 'scheduled') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return status === 'scheduled' || status === 'booked'
        })
      }
      return operationalData
    }
    
    // In-Progress tab filtering
    if (activeTab === 'completed') {
      if (inProgressSubTab === 'all') return operationalData
      if (inProgressSubTab === 'uploaded') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return status.includes('uploaded') || status === 'photos_uploaded' || status === 'raw_uploaded'
        })
      }
      if (inProgressSubTab === 'editing') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return status.includes('editing') || status === 'start_editing'
        })
      }
      return operationalData
    }
    
    // Delivered tab filtering
    if (activeTab === 'delivered') {
      if (deliveredSubTab === 'all') return operationalData
      if (deliveredSubTab === 'delivered') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return status === 'delivered' || status === 'admin_verified'
        })
      }
      if (deliveredSubTab === 'ready') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return status === 'ready_for_client' || status === 'ready'
        })
      }
      return operationalData
    }
    
    // Hold tab filtering
    if (activeTab === 'hold') {
      if (holdSubTab === 'all') return operationalData
      if (holdSubTab === 'on_hold') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return status === 'on_hold' || status === 'hold_on'
        })
      }
      if (holdSubTab === 'cancelled') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return status === 'cancelled' || status === 'canceled'
        })
      }
      return operationalData
    }
    
    return operationalData
  }, [activeTab, scheduledSubTab, inProgressSubTab, deliveredSubTab, holdSubTab, operationalData])

  const operationalMarkers: MapMarker[] = useMemo(() => {
    // Always generate markers for map view, use filtered data for all tabs
    const dataToUse = filteredOperationalData
    return dataToUse
      .map((shoot) => {
        const address = shoot.location.fullAddress
        if (!address) return null
        const coords = geoCache[address]
        if (!coords) return null
        return {
          id: shoot.id,
          title: shouldHideClientDetails ? address : shoot.client.name,
          subtitle: `${formatDisplayDatePref(shoot.scheduledDate)}${shoot.time ? ` · ${formatTime(shoot.time)}` : ''}`,
          address,
          coords,
        }
      })
      .filter(Boolean) as MapMarker[]
  }, [filteredOperationalData, geoCache, shouldHideClientDetails])

  const historyMarkers: MapMarker[] = useMemo(() => {
    if (activeTab !== 'history' || historyFilters.viewAs !== 'map' || historyFilters.groupBy === 'services') {
      return []
    }

    return historyRecords
      .map((record) => {
        const address = record.address?.full
        if (!address) return null
        const coords = geoCache[address]
        if (!coords) return null
        return {
          id: String(record.id),
          title: shouldHideClientDetails ? address : (record.client?.name ?? 'Unknown Client'),
          subtitle: `${formatDisplayDatePref(record.scheduledDate)}${record.completedDate ? ` · Completed ${formatDisplayDatePref(record.completedDate)}` : ''}`,
          address,
          coords,
        }
      })
      .filter(Boolean) as MapMarker[]
  }, [activeTab, historyFilters.viewAs, historyFilters.groupBy, historyRecords, geoCache, shouldHideClientDetails])

  const mapAddresses = useMemo(() => {
    if (activeTab === 'history') {
      if (historyFilters.viewAs !== 'map' || historyFilters.groupBy === 'services') return []
      return historyRecords
        .map((record) => record.address?.full)
        .filter((addr): addr is string => Boolean(addr))
    }

    if (viewMode !== 'map') return []
    return filteredOperationalData
      .map((shoot) => shoot.location.fullAddress)
      .filter((addr): addr is string => Boolean(addr))
  }, [activeTab, historyFilters.viewAs, historyFilters.groupBy, historyRecords, viewMode, filteredOperationalData])

  useEffect(() => {
    if (!mapAddresses.length) return
    const unknownAddresses = mapAddresses.filter((addr) => !geoCache[addr]).slice(0, 6)
    if (!unknownAddresses.length) return

    let cancelled = false

    const geocode = async () => {
      const updates: Record<string, { lat: number; lng: number }> = {}

      for (const address of unknownAddresses) {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
            { headers: { Accept: 'application/json' } },
          )
          if (!response.ok) continue
          const data = await response.json()
          const match = data?.[0]
          if (match && !cancelled) {
            updates[address] = {
              lat: parseFloat(match.lat),
              lng: parseFloat(match.lon),
            }
          }
        } catch (error) {
          // ignore
        }
        await new Promise((resolve) => setTimeout(resolve, 450))
      }

      if (!cancelled && Object.keys(updates).length) {
        setGeoCache((prev) => ({ ...prev, ...updates }))
      }
    }

    geocode()

    return () => {
      cancelled = true
    }
  }, [mapAddresses, geoCache])

  const handleHistoryPageChange = (direction: 'prev' | 'next') => {
    if (!historyMeta) return
    const currentPage = historyPage // Use state directly instead of metadata
    let newPage = currentPage
    if (direction === 'prev' && currentPage > 1) {
      newPage = currentPage - 1
    } else if (direction === 'next') {
      const totalPages = Math.ceil(historyMeta.total / historyMeta.per_page)
      if (currentPage < totalPages) {
        newPage = currentPage + 1
      }
    }
    
    if (newPage !== currentPage) {
      setHistoryPage(newPage)
      // Fetch will be triggered by useEffect when historyPage changes
    }
  }

  const handleOperationalPageChange = (direction: 'prev' | 'next') => {
    if (!operationalMeta) return
    const currentPage = operationalPage // Use state directly instead of metadata
    let newPage = currentPage
    if (direction === 'prev' && currentPage > 1) {
      newPage = currentPage - 1
    } else if (direction === 'next') {
      const totalPages = Math.ceil(operationalMeta.total / operationalMeta.per_page)
      if (currentPage < totalPages) {
        newPage = currentPage + 1
      }
    }
    
    if (newPage !== currentPage) {
      setOperationalPage(newPage)
      // Fetch will be triggered by useEffect when operationalPage changes
    }
  }

  const buildHistoryParams = () => {
    const params: Record<string, unknown> = {
      group_by: historyFilters.groupBy,
      page: historyPage,
      per_page: 9,
    }
    if (historyFilters.search) params.search = historyFilters.search
    if (!shouldHideClientDetails && historyFilters.clientId) params.client_id = historyFilters.clientId
    if (historyFilters.photographerId) params.photographer_id = historyFilters.photographerId
    if (historyFilters.services.length) params.services = historyFilters.services
    if (historyFilters.dateRange) {
      if (historyFilters.dateRange === 'custom') {
        if (historyFilters.scheduledStart) params.custom_start = historyFilters.scheduledStart
        if (historyFilters.scheduledEnd) params.custom_end = historyFilters.scheduledEnd
        params.date_range = 'custom'
      } else {
        params.date_range = historyFilters.dateRange
      }
    }
    if (historyFilters.scheduledStart && historyFilters.dateRange !== 'custom') params.scheduled_start = historyFilters.scheduledStart
    if (historyFilters.scheduledEnd && historyFilters.dateRange !== 'custom') params.scheduled_end = historyFilters.scheduledEnd
    if (historyFilters.completedStart) params.completed_start = historyFilters.completedStart
    if (historyFilters.completedEnd) params.completed_end = historyFilters.completedEnd
    return params
  }

  const handleExportHistory = async () => {
    try {
      const response = await apiClient.get('/shoots/history/export', {
        params: buildHistoryParams(),
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `shoot-history-${new Date().toISOString()}.csv`)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast({ title: 'Export started', description: 'Your CSV download should begin shortly.' })
    } catch (error) {
      console.error(error)
      toast({ title: 'Export failed', description: 'Please try again.', variant: 'destructive' })
    }
  }

  const handleCopyHistory = async () => {
    try {
      if (!historyRecords.length) {
        toast({ title: 'Nothing to copy', description: 'Run a history search first.' })
        return
      }
      const includeClientDetails = !shouldHideClientDetails
      const headers = isSuperAdmin
        ? includeClientDetails
          ? ['Scheduled Date', 'Completed Date', 'Client', 'Address', 'Total Paid']
          : ['Scheduled Date', 'Completed Date', 'Address', 'Total Paid']
        : includeClientDetails
          ? ['Scheduled Date', 'Completed Date', 'Client', 'Address']
          : ['Scheduled Date', 'Completed Date', 'Address']
      const rows = historyRecords.map((record) => {
        const baseRow = [
          formatDisplayDatePref(record.scheduledDate),
          formatDisplayDatePref(record.completedDate),
        ]
        if (includeClientDetails) {
          baseRow.push(record.client?.name ?? '—')
        }
        baseRow.push(record.address?.full ?? '—')
        if (isSuperAdmin) {
          baseRow.push(formatCurrency(record.financials?.totalPaid ?? 0))
        }
        return baseRow
      })
      const csv = [headers, ...rows].map((row) => row.join('\t')).join('\n')
      await navigator.clipboard.writeText(csv)
      toast({ title: 'Copied!', description: 'History rows copied to clipboard.' })
    } catch (error) {
      toast({ title: 'Copy failed', description: 'Clipboard permissions denied.', variant: 'destructive' })
    }
  }

  // Download handler for completed shoots
  const handleDownloadShoot = useCallback(async (shoot: ShootData, type: 'full' | 'web') => {
    try {
      toast({ title: 'Preparing download...', description: `Generating ${type === 'full' ? 'full size' : 'web size'} archive.` })
      
      // First try to get the download URL (JSON response)
      const response = await apiClient.get(`/shoots/${shoot.id}/media/download-zip`, {
        params: { type: type === 'full' ? 'raw' : 'edited' },
      })
      
      // Check if backend returned a redirect URL
      if (response.data?.type === 'redirect' && response.data?.url) {
        // Open the Dropbox download link in new tab
        window.open(response.data.url, '_blank')
        toast({ title: 'Download started', description: 'Your download should begin shortly.' })
        return
      }
      
      // If backend returned a blob directly (fallback case)
      if (response.data instanceof Blob) {
        const url = window.URL.createObjectURL(response.data)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `${shoot.location.address.replace(/[^a-zA-Z0-9]/g, '_')}_${type}.zip`)
        document.body.appendChild(link)
        link.click()
        link.parentNode?.removeChild(link)
        window.URL.revokeObjectURL(url)
        toast({ title: 'Download started', description: 'Your download should begin shortly.' })
        return
      }
      
      // If we get here, something unexpected happened
      toast({ title: 'Download failed', description: 'Unexpected response from server.', variant: 'destructive' })
    } catch (error) {
      console.error('Download error:', error)
      toast({ title: 'Download failed', description: 'Please try again.', variant: 'destructive' })
    }
  }, [toast])

  // Scheduled shoots content
  const scheduledContent = useMemo(() => {
    if (loading && activeTab === 'scheduled') {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      )
    }

    if (!filteredOperationalData.length) {
      // Determine the message based on sub-tab
      let message = 'No scheduled shoots found'
      let description = 'Try adjusting your filters or book a new shoot.'
      
      if (scheduledSubTab === 'requested') {
        message = 'No requested shoots'
        description = 'Shoots awaiting approval will appear here.'
      } else if (scheduledSubTab === 'scheduled') {
        message = 'No scheduled shoots'
        description = 'Approved and scheduled shoots will appear here.'
      }
      
      return (
        <div className="rounded-xl border border-dashed p-16 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
          <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium text-lg">{message}</p>
          <p className="text-sm mt-1">{description}</p>
        </div>
      )
    }

    // Apply client-side pagination - always show 9 items per page
    const perPage = 9
    const currentPage = operationalMeta?.current_page ?? 1
    const startIndex = (currentPage - 1) * perPage
    const endIndex = startIndex + perPage
    const paginatedData = filteredOperationalData.slice(startIndex, endIndex)

    if (viewMode === 'grid') {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paginatedData.map((shoot) => (
            <SharedShootCard
              key={shoot.id}
              shoot={shoot}
              role={role}
              onSelect={handleShootSelect}
              onPrimaryAction={(action) => handlePrimaryAction(action, shoot)}
              onOpenWorkflow={(selected) => navigate(`/shoots/${selected.id}#workflow`)}
              onApprove={(s) => setApprovalModalShoot(s)}
              onDecline={(s) => setDeclineModalShoot(s)}
              onModify={(s) => setEditModalShoot(s)}
              onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
              onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
              onSendToEditing={handleSendToEditing}
            />
          ))}
        </div>
      )
    }

    if (viewMode === 'map') {
      return <ShootMapView markers={operationalMarkers} />
    }

    return (
      <div className="space-y-3">
        {paginatedData.map((shoot) => (
          <ScheduledShootListRow 
            key={shoot.id} 
            shoot={shoot} 
            onSelect={handleShootSelect} 
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
            isEditingManager={isEditingManager}
            isEditor={isEditor}
            onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
            onApprove={(s) => setApprovalModalShoot(s)}
            onDecline={(s) => setDeclineModalShoot(s)}
            onModify={(s) => setEditModalShoot(s)}
            onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
            onSendToEditing={handleSendToEditing}
            shouldHideClientDetails={shouldHideClientDetails}
          />
        ))}
      </div>
    )
  }, [loading, activeTab, filteredOperationalData, operationalMeta, viewMode, role, operationalMarkers, handleShootSelect, handlePrimaryAction, navigate, isSuperAdmin, scheduledSubTab, isAdmin, isEditingManager, isEditor, canViewInvoice, handleViewInvoice, handleDeleteShoot, handleSendToEditing, shouldHideClientDetails])

    // Completed shoots content
  const completedContent = useMemo(() => {
    const isEditedTab = activeTab === 'edited'
    const isDeliveredTab = activeTab === 'delivered'
    const isEditingTab = activeTab === 'editing'
    const label = isDeliveredTab
      ? 'delivered'
      : isEditedTab
        ? 'edited'
        : isEditingTab
          ? 'editing'
          : 'completed'
    
    if (loading && (activeTab === 'completed' || activeTab === 'delivered' || activeTab === 'editing' || activeTab === 'edited')) {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Skeleton key={item} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      )
    }

    if (!filteredOperationalData.length) {
      // Determine the message based on tab and sub-tab
      let message = `No ${label} shoots found`
      let description = isDeliveredTab ? 'Delivered shoots will appear here once they are sent.' : 'Completed shoots will appear here once they are finished.'
      
      if (activeTab === 'editing') {
        message = 'No editing shoots'
        description = 'Shoots currently being edited will appear here.'
      } else if (activeTab === 'edited') {
        message = 'No edited shoots'
        description = 'Finalised shoots will appear here once delivered.'
      } else if (activeTab === 'completed') {
        if (inProgressSubTab === 'uploaded') {
          message = 'No uploaded shoots'
          description = 'Shoots with uploaded photos will appear here.'
        } else if (inProgressSubTab === 'editing') {
          message = 'No editing shoots'
          description = 'Shoots currently being edited will appear here.'
        }
      } else if (activeTab === 'delivered') {
        if (deliveredSubTab === 'delivered') {
          message = 'No delivered shoots'
          description = 'Shoots that have been delivered will appear here.'
        } else if (deliveredSubTab === 'ready') {
          message = 'No ready shoots'
          description = 'Shoots ready for client will appear here.'
        }
      }
      
      return (
        <div className="rounded-xl border border-dashed p-16 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium text-lg">{message}</p>
          <p className="text-sm mt-1">{description}</p>
        </div>
      )
    }

    // Apply client-side pagination - always show 9 items per page
    const perPage = 9
    const currentPage = operationalMeta?.current_page ?? 1
    const startIndex = (currentPage - 1) * perPage
    const endIndex = startIndex + perPage
    const displayData = filteredOperationalData.slice(startIndex, endIndex)

    if (viewMode === 'grid') {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayData.map((shoot) => (
            <CompletedAlbumCard
              key={shoot.id}
              shoot={shoot}
              onSelect={handleShootSelect}
              onDownload={handleDownloadShoot}
              isSuperAdmin={isSuperAdmin}
              isAdmin={isAdmin}
              isEditingManager={isEditingManager}
              isEditor={isEditor}
              onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
              onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
              onSendToEditing={handleSendToEditing}
              shouldHideClientDetails={shouldHideClientDetails}
            />
          ))}
        </div>
      )
    }

    if (viewMode === 'map') {
      return <ShootMapView markers={operationalMarkers} />
    }

    return (
      <div className="space-y-3">
        {displayData.map((shoot) => (
          <CompletedShootListRow
            key={shoot.id}
            shoot={shoot}
            onSelect={handleShootSelect}
            onDownload={handleDownloadShoot}
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
            isEditingManager={isEditingManager}
            isEditor={isEditor}
            onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
            onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
            onSendToEditing={handleSendToEditing}
            shouldHideClientDetails={shouldHideClientDetails}
          />
        ))}
      </div>
    )
  }, [loading, activeTab, filteredOperationalData, operationalMeta, viewMode, operationalMarkers, handleShootSelect, handleDownloadShoot, isSuperAdmin, isAdmin, isEditingManager, isEditor, handleDeleteShoot, handleViewInvoice, handleSendToEditing, inProgressSubTab, deliveredSubTab, canViewInvoice, shouldHideClientDetails])

  // Hold-on shoots content
  const holdOnContent = useMemo(() => {
    if (loading && activeTab === 'hold') {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      )
    }

    // Apply client-side pagination - always show 9 items per page
    const perPage = 9
    const currentPage = operationalMeta?.current_page ?? 1
    const startIndex = (currentPage - 1) * perPage
    const endIndex = startIndex + perPage
    const paginatedData = filteredOperationalData.slice(startIndex, endIndex)

    if (!filteredOperationalData.length) {
      // Determine the message based on sub-tab
      let message = 'No hold-on shoots'
      let description = 'Shoots awaiting scheduling or payment will appear here.'
      
      if (holdSubTab === 'on_hold') {
        message = 'No on-hold shoots'
        description = 'Shoots that are on hold will appear here.'
      } else if (holdSubTab === 'cancelled') {
        message = 'No cancelled shoots'
        description = 'Cancelled shoots will appear here.'
      }
      
      return (
        <div className="rounded-xl border border-dashed p-16 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
          <PauseCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium text-lg">{message}</p>
          <p className="text-sm mt-1">{description}</p>
        </div>
      )
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paginatedData.map((shoot) => (
            <HoldOnShootCard 
              key={shoot.id} 
              shoot={shoot} 
              onSelect={handleShootSelect}
              isSuperAdmin={isSuperAdmin}
              isAdmin={isAdmin}
              isEditingManager={isEditingManager}
              isEditor={isEditor}
              onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
              onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
              onSendToEditing={handleSendToEditing}
              shouldHideClientDetails={shouldHideClientDetails}
            />
          ))}
        </div>
      )
    }

    if (viewMode === 'map') {
      return <ShootMapView markers={operationalMarkers} />
    }

    return (
      <div className="space-y-3">
        {paginatedData.map((shoot) => (
          <HoldOnShootCard 
            key={shoot.id} 
            shoot={shoot} 
            onSelect={handleShootSelect}
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
            isEditingManager={isEditingManager}
            isEditor={isEditor}
            onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
            onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
            onSendToEditing={handleSendToEditing}
            shouldHideClientDetails={shouldHideClientDetails}
          />
        ))}
      </div>
    )
  }, [loading, activeTab, filteredOperationalData, operationalMeta, viewMode, operationalMarkers, handleShootSelect, isSuperAdmin, isAdmin, isEditingManager, isEditor, handleDeleteShoot, handleViewInvoice, handleSendToEditing, canViewInvoice, shouldHideClientDetails])

  // Legacy operationalContent for backward compatibility
  const operationalContent = useMemo(() => {
    if (activeTab === 'scheduled') return scheduledContent
    if (activeTab === 'completed') return completedContent
    if (activeTab === 'hold') return holdOnContent
    return scheduledContent
  }, [activeTab, scheduledContent, completedContent, holdOnContent])

  const historyContent = useMemo(() => {
    if (!canViewHistory) {
      return (
        <div className="rounded-xl border p-8 text-center text-muted-foreground">
          You do not have permission to view the history report.
        </div>
      )
    }

    if (loading && activeTab === 'history') {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      )
    }

    if (historyFilters.groupBy === 'services') {
      if (!historyAggregates.length) {
        return (
          <div className="rounded-xl border p-8 text-center text-muted-foreground">
            No aggregates found for the selected filters.
          </div>
        )
      }
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {historyAggregates.map((aggregate) => (
            <HistoryAggregateCard key={aggregate.serviceId} aggregate={aggregate} isSuperAdmin={isSuperAdmin} />
          ))}
        </div>
      )
    }

    if (historyFilters.viewAs === 'map') {
      return <ShootMapView markers={historyMarkers} />
    }

    if (!historyRecords.length) {
      return (
        <div className="rounded-xl border p-8 text-center text-muted-foreground">
          No history records match the current filters.
        </div>
      )
    }

    // Backend already paginates, so render the returned page as-is
    const paginatedRecords = historyRecords

    if (historyFilters.viewAs === 'grid') {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paginatedRecords.map((record) => (
            <Card key={record.id} className="overflow-hidden border hover:border-primary/40 transition-colors cursor-pointer" onClick={() => handleHistoryRecordSelect(record)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {shouldHideClientDetails ? 'Shoot' : (record.client?.name ?? 'Unknown Client')}
                    </CardTitle>
                    <CardDescription>
                      {record.address?.full || 'No address'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {record.status}
                    </Badge>
                    {(isAdmin || isSuperAdmin) && record.id && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 w-7 p-0 bg-red-500 hover:bg-red-600"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDeleteHistoryRecord(record)
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDisplayDatePref(record.scheduledDate)}</span>
                </div>
                {record.completedDate && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    <span>Completed: {formatDisplayDatePref(record.completedDate)}</span>
                  </div>
                )}
                {isSuperAdmin && record.financials && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-semibold">{formatCurrency(record.financials.totalQuote)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    // List view (default)
    return (
      <div className="space-y-4">
        {paginatedRecords.map((record) => (
          <HistoryRow 
            key={record.id} 
            record={record} 
            onViewRecord={handleHistoryRecordSelect} 
            onPublishMls={handlePublishMls}
            isBusy={detailLoading}
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
            isEditingManager={isEditingManager}
            isEditor={isEditor}
            onDelete={isAdmin || isSuperAdmin ? handleDeleteHistoryRecord : undefined}
            onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
            onSendToEditing={handleSendToEditing as any}
            shouldHideClientDetails={shouldHideClientDetails}
          />
        ))}
      </div>
    )
  }, [canViewHistory, loading, activeTab, historyFilters, historyAggregates, historyRecords, historyMarkers, historyMeta, handleHistoryRecordSelect, handlePublishMls, detailLoading, isSuperAdmin, isAdmin, isEditingManager, isEditor, handleDeleteHistoryRecord, handleViewInvoice, handleSendToEditing, canViewInvoice, shouldHideClientDetails])

  const operationalServicesSelected = operationalFilters.services.length > 0
  const historyServicesSelected = historyFilters.services.length > 0

  // Auto-expanding tabs configuration with counts
  const tabsConfig: AutoExpandingTab[] = useMemo(() => {
    const statusKey = (shoot: ShootData) => (shoot.workflowStatus || shoot.status || '').toLowerCase()
    const matchesTab = (shoot: ShootData, tab: ActiveOperationalTab) =>
      (STATUS_FILTERS_BY_TAB[tab] ?? []).some((allowed) => statusKey(shoot).includes(allowed))

    // Count shoots by status
    const scheduledCount = operationalData.filter((shoot) => matchesTab(shoot, 'scheduled')).length
    const completedCount = operationalData.filter((shoot) => matchesTab(shoot, 'completed')).length
    const deliveredCount = operationalData.filter((shoot) => matchesTab(shoot, 'delivered')).length
    const holdCount = operationalData.filter((shoot) => matchesTab(shoot, 'hold')).length
    const editingCount = operationalData.filter((shoot) => matchesTab(shoot, 'editing')).length
    const editedCount = operationalData.filter((shoot) => matchesTab(shoot, 'edited')).length

    if (isEditor) {
      const editorTabs: AutoExpandingTab[] = [
        {
          value: 'editing',
          icon: Image,
          label: 'Editing',
          badge: editingCount > 0 ? editingCount : undefined,
        },
        {
          value: 'edited',
          icon: CheckCircle2,
          label: 'Edited',
          badge: editedCount > 0 ? editedCount : undefined,
        },
      ]

      if (canViewHistory) {
        editorTabs.push({
          value: 'history',
          icon: Clock,
          label: 'History',
          badge: historyMeta?.total ? historyMeta.total : undefined,
        })
      }

      return editorTabs
    }

    // Hide In-Progress tab for client and editor roles
    const canViewInProgress = !['client', 'editor'].includes(role || '')

    const baseTabs: AutoExpandingTab[] = [
      {
        value: 'scheduled',
        icon: CalendarIcon,
        label: 'Scheduled',
        badge: scheduledCount > 0 ? scheduledCount : undefined,
      },
      ...(canViewInProgress ? [{
        value: 'completed' as const,
        icon: Loader2,
        label: 'In-Progress',
        badge: completedCount > 0 ? completedCount : undefined,
      }] : []),
      {
        value: 'delivered',
        icon: CheckCircle2,
        label: 'Delivered',
        badge: deliveredCount > 0 ? deliveredCount : undefined,
      },
      {
        value: 'hold',
        icon: PauseCircle,
        label: 'On-Hold',
        badge: holdCount > 0 ? holdCount : undefined,
      },
    ]
    
    // Add history tab if allowed
    if (canViewHistory) {
      baseTabs.push({
        value: 'history',
        icon: Clock,
        label: 'History',
        badge: historyMeta?.total ? historyMeta.total : undefined,
      })
    }

    // Add linked view tab if user can view linked accounts AND has linked accounts
    if (canViewLinkedAccounts) {
      baseTabs.push({
        value: 'linked',
        icon: Link2,
        label: 'Linked View',
      })
    }

    return baseTabs
  }, [canViewHistory, canViewLinkedAccounts, operationalData, historyMeta, role, isEditor])

  return (
    <>
      <DashboardLayout>
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">Shoot History</h1>
              <p className="text-muted-foreground">
                View and manage scheduled, completed, delivered, and on-hold shoots.
              </p>
            </div>
            <div className="flex items-center gap-2 md:justify-end">
              {(isSuperAdmin || isAdmin) && (
                <Button
                  onClick={() => setIsBulkActionsOpen(true)}
                  variant="outline"
                  className="gap-2"
                >
                  <Layers className="h-4 w-4" />
                  Bulk Actions
                </Button>
              )}
            </div>
          </div>

        {/* Tab bar with view controls */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AvailableTab)} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AutoExpandingTabsList 
                tabs={tabsConfig} 
                value={activeTab}
              />
              {/* Pin button for current tab */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => togglePinTab(activeTab)}
                title={pinnedTabs.has(activeTab) ? 'Unpin tab' : 'Pin tab'}
              >
                <Pin className={`h-4 w-4 ${pinnedTabs.has(activeTab) ? 'fill-current' : ''}`} />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <ToggleGroup 
                type="single" 
                value={activeTab === 'history' ? historyFilters.viewAs : viewMode} 
                onValueChange={(value) => {
                  if (!value) return
                  if (activeTab === 'history') {
                    setHistoryFilters(prev => ({ ...prev, viewAs: value as 'grid' | 'list' | 'map' }))
                  } else {
                    setViewMode(value as typeof viewMode)
                  }
                }}
              >
                <ToggleGroupItem value="grid" aria-label="Grid view">
                  <Grid3X3 className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="map" aria-label="Map view">
                  <MapIcon className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
              {activeTab !== 'history' && (
                <Collapsible open={operationalFiltersOpen} onOpenChange={setOperationalFiltersOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant={operationalFiltersOpen ? 'outline' : 'ghost'}
                      size={operationalFiltersOpen ? 'sm' : 'icon'}
                      className={operationalFiltersOpen ? 'gap-2' : 'h-8 w-8'}
                      title={operationalFiltersOpen ? 'Hide filters' : 'Show filters'}
                    >
                      <Filter className="h-4 w-4" />
                      {operationalFiltersOpen && <span>Hide filters</span>}
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              )}
              <Button variant="ghost" size="icon" onClick={fetchOperationalData} title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Sub-tabs and Filter button row */}
          <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-2 -mt-3">
            {/* Sub-tabs based on active tab */}
            {activeTab === 'history' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHistorySubTab('all')}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    historySubTab === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  All Shoots
                </button>
                <button
                  onClick={() => setHistorySubTab('mls-queue')}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    historySubTab === 'mls-queue'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  MLS Queue
                </button>
              </div>
            ) : activeTab === 'completed' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInProgressSubTab('all')}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    inProgressSubTab === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setInProgressSubTab('uploaded')}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    inProgressSubTab === 'uploaded'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Uploaded
                </button>
                <button
                  onClick={() => setInProgressSubTab('editing')}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    inProgressSubTab === 'editing'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Editing
                </button>
              </div>
            ) : activeTab === 'delivered' && !hideDeliveredSubTabs ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDeliveredSubTab('all')}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    deliveredSubTab === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setDeliveredSubTab('delivered')}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    deliveredSubTab === 'delivered'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Delivered
                </button>
                <button
                  onClick={() => setDeliveredSubTab('ready')}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    deliveredSubTab === 'ready'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Ready
                </button>
              </div>
            ) : activeTab === 'hold' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHoldSubTab('all')}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    holdSubTab === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setHoldSubTab('on_hold')}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    holdSubTab === 'on_hold'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  On Hold
                </button>
                <button
                  onClick={() => setHoldSubTab('cancelled')}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    holdSubTab === 'cancelled'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Cancelled
                </button>
              </div>
            ) : activeTab === 'scheduled' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setScheduledSubTab('all')}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    scheduledSubTab === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setScheduledSubTab('requested')}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    scheduledSubTab === 'requested'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Requested
                </button>
                <button
                  onClick={() => setScheduledSubTab('scheduled')}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    scheduledSubTab === 'scheduled'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Scheduled
                </button>
              </div>
            ) : (
              <div></div>
            )}
            
          </div>

          {/* Filter content - expands below */}
          <Collapsible open={operationalFiltersOpen} onOpenChange={setOperationalFiltersOpen}>
            <CollapsibleContent>
              <div className="rounded-2xl border bg-card p-4 mt-2">
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Search</span>
                    <Input
                      placeholder="Search by address, client, photographer"
                      value={operationalFilters.search}
                      onChange={(event) => onOperationalFilterChange('search', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Client</span>
                    <Select
                      value={operationalFilters.clientId || 'all'}
                      onValueChange={(value) => onOperationalFilterChange('clientId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All clients" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All clients</SelectItem>
                        {operationalOptions.clients
                          .filter((client) => client.id || client.name)
                          .map((client) => (
                          <SelectItem key={client.id ?? client.name ?? ''} value={String(client.id ?? client.name ?? '')}>
                            {client.name ?? 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Photographer</span>
                    <Select
                      value={operationalFilters.photographerId || 'all'}
                      onValueChange={(value) => onOperationalFilterChange('photographerId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All photographers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All photographers</SelectItem>
                        {operationalOptions.photographers
                          .filter((photographer) => photographer.id || photographer.name)
                          .map((photographer) => (
                          <SelectItem key={photographer.id ?? photographer.name ?? ''} value={String(photographer.id ?? photographer.name ?? '')}>
                            {photographer.name ?? 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Address</span>
                    <Input
                      placeholder="Filter by address"
                      value={operationalFilters.address}
                      onChange={(event) => onOperationalFilterChange('address', event.target.value)}
                    />
                  </div>
                  <MultiSelectFilter
                    label="Services"
                    options={operationalOptions.services}
                    values={operationalFilters.services}
                    onChange={(values) => onOperationalFilterChange('services', values)}
                  />
                    <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Date range</span>
                      <Select
                      value={operationalFilters.dateRange}
                      onValueChange={(value) => onOperationalFilterChange('dateRange', value as OperationalFiltersState['dateRange'])}
                      >
                        <SelectTrigger>
                        <SelectValue placeholder="All dates" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="all">All dates</SelectItem>
                        <SelectItem value="this_week">This week</SelectItem>
                        <SelectItem value="this_month">This month</SelectItem>
                        <SelectItem value="this_quarter">This quarter</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  {operationalFilters.dateRange === 'custom' && (
                    <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">Start date</span>
                        <Input
                          type="date"
                          value={operationalFilters.scheduledStart}
                          onChange={(event) => onOperationalFilterChange('scheduledStart', event.target.value)}
                        />
                    </div>
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">End date</span>
                        <Input
                          type="date"
                          value={operationalFilters.scheduledEnd}
                          onChange={(event) => onOperationalFilterChange('scheduledEnd', event.target.value)}
                        />
                  </div>
                </div>
                  )}
                </div>
                  {(operationalServicesSelected || operationalFilters.search || operationalFilters.clientId || operationalFilters.photographerId || operationalFilters.address || operationalFilters.dateRange !== 'all') && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Filters applied.</span>
                      <Button variant="ghost" size="sm" onClick={resetOperationalFilters}>
                        Clear filters
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <TabsContent value="scheduled" className="space-y-6">
            {scheduledContent}

            {operationalMeta && operationalMeta.total > 0 && (
              <div className="flex items-center justify-between rounded-xl border bg-card p-4 text-sm">
                <div>
                  Page {operationalPage} of {Math.max(1, Math.ceil(operationalMeta.total / operationalMeta.per_page))} · {operationalMeta.total} records
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOperationalPageChange('prev')}
                    disabled={operationalPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOperationalPageChange('next')}
                    disabled={operationalPage >= Math.ceil(operationalMeta.total / operationalMeta.per_page)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="editing" className="space-y-6">
            {completedContent}

            {operationalMeta && operationalMeta.total > 0 && (
              <div className="flex items-center justify-between rounded-xl border bg-card p-4 text-sm">
                <div>
                  Page {operationalPage} of {Math.max(1, Math.ceil(operationalMeta.total / operationalMeta.per_page))} · {operationalMeta.total} records
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOperationalPageChange('prev')}
                    disabled={operationalPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOperationalPageChange('next')}
                    disabled={operationalPage >= Math.ceil(operationalMeta.total / operationalMeta.per_page)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="edited" className="space-y-6">
            {completedContent}

            {operationalMeta && operationalMeta.total > 0 && (
              <div className="flex items-center justify-between rounded-xl border bg-card p-4 text-sm">
                <div>
                  Page {operationalPage} of {Math.max(1, Math.ceil(operationalMeta.total / operationalMeta.per_page))} · {operationalMeta.total} records
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOperationalPageChange('prev')}
                    disabled={operationalPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOperationalPageChange('next')}
                    disabled={operationalPage >= Math.ceil(operationalMeta.total / operationalMeta.per_page)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Delivered Shoots Tab */}
          <TabsContent value="delivered" className="space-y-6">
            {completedContent}

            {operationalMeta && operationalMeta.total > 0 && (
              <div className="flex items-center justify-between rounded-xl border bg-card p-4 text-sm">
                <div>
                  Page {operationalPage} of {Math.max(1, Math.ceil(operationalMeta.total / operationalMeta.per_page))} · {operationalMeta.total} records
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOperationalPageChange('prev')}
                    disabled={operationalPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOperationalPageChange('next')}
                    disabled={operationalPage >= Math.ceil(operationalMeta.total / operationalMeta.per_page)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Completed Shoots Tab - spec 2.2 */}
          <TabsContent value="completed" className="space-y-6">
            {completedContent}

            {operationalMeta && operationalMeta.total > 0 && (
              <div className="flex items-center justify-between rounded-xl border bg-card p-4 text-sm">
                <div>
                  Page {operationalPage} of {Math.max(1, Math.ceil(operationalMeta.total / operationalMeta.per_page))} · {operationalMeta.total} records
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOperationalPageChange('prev')}
                    disabled={operationalPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOperationalPageChange('next')}
                    disabled={operationalPage >= Math.ceil(operationalMeta.total / operationalMeta.per_page)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Hold-On Shoots Tab - spec 2.3 */}
          <TabsContent value="hold" className="space-y-6">
            {holdOnContent}

            {operationalMeta && operationalMeta.total > 0 && (
              <div className="flex items-center justify-between rounded-xl border bg-card p-4 text-sm">
                <div>
                  Page {operationalPage} of {Math.max(1, Math.ceil(operationalMeta.total / operationalMeta.per_page))} · {operationalMeta.total} records
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOperationalPageChange('prev')}
                    disabled={operationalPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOperationalPageChange('next')}
                    disabled={operationalPage >= Math.ceil(operationalMeta.total / operationalMeta.per_page)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* History Tab - spec 3 */}
          {canViewHistory && (
            <TabsContent value="history" className="space-y-6">
              <Tabs value={historySubTab} onValueChange={(value) => setHistorySubTab(value as 'all' | 'mls-queue')} className="w-full">
                {/* Reporting filters - expands below */}
                <Collapsible open={historyFiltersOpen} onOpenChange={setHistoryFiltersOpen}>
                  <CollapsibleContent>
                    <div className="rounded-2xl border bg-card p-4 mt-2">
                      <div className="space-y-4">
                        <div>
                          <p className="font-medium">Reporting filters</p>
                          <p className="text-sm text-muted-foreground">Date ranges, grouping and drill-down controls.</p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-muted-foreground">Search</span>
                      <Input
                        placeholder="Client, address, company"
                        value={historyFilters.search}
                        onChange={(event) => onHistoryFilterChange('search', event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-muted-foreground">Client</span>
                      <Select
                        value={historyFilters.clientId || 'all'}
                        onValueChange={(value) => onHistoryFilterChange('clientId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All clients" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All clients</SelectItem>
                          {historyOptions.clients
                            .filter((client) => client.id || client.name)
                            .map((client) => (
                            <SelectItem key={client.id ?? client.name ?? ''} value={String(client.id ?? client.name ?? '')}>
                              {client.name ?? 'Unknown'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-muted-foreground">Photographer</span>
                      <Select
                        value={historyFilters.photographerId || 'all'}
                        onValueChange={(value) => onHistoryFilterChange('photographerId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All photographers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All photographers</SelectItem>
                          {historyOptions.photographers
                            .filter((photographer) => photographer.id || photographer.name)
                            .map((photographer) => (
                            <SelectItem key={photographer.id ?? photographer.name ?? ''} value={String(photographer.id ?? photographer.name ?? '')}>
                              {photographer.name ?? 'Unknown'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <MultiSelectFilter
                      label="Services"
                      options={historyOptions.services}
                      values={historyFilters.services}
                      onChange={(values) => onHistoryFilterChange('services', values)}
                    />
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-muted-foreground">Date range preset</span>
                      <Select
                        value={historyFilters.dateRange}
                        onValueChange={(value) => onHistoryFilterChange('dateRange', value as HistoryFiltersState['dateRange'])}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All time</SelectItem>
                          <SelectItem value="this_quarter">This quarter</SelectItem>
                          <SelectItem value="this_month">This month</SelectItem>
                          <SelectItem value="q1">Q1</SelectItem>
                          <SelectItem value="q2">Q2</SelectItem>
                          <SelectItem value="q3">Q3</SelectItem>
                          <SelectItem value="q4">Q4</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">Scheduled start</span>
                        <Input
                          type="date"
                          value={historyFilters.scheduledStart}
                          onChange={(event) => onHistoryFilterChange('scheduledStart', event.target.value)}
                          disabled={historyFilters.dateRange !== 'custom'}
                        />
                      </div>
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">Scheduled end</span>
                        <Input
                          type="date"
                          value={historyFilters.scheduledEnd}
                          onChange={(event) => onHistoryFilterChange('scheduledEnd', event.target.value)}
                          disabled={historyFilters.dateRange !== 'custom'}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">Completed start</span>
                        <Input
                          type="date"
                          value={historyFilters.completedStart}
                          onChange={(event) => onHistoryFilterChange('completedStart', event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">Completed end</span>
                        <Input
                          type="date"
                          value={historyFilters.completedEnd}
                          onChange={(event) => onHistoryFilterChange('completedEnd', event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-muted-foreground">Group by</span>
                      <Select
                        value={historyFilters.groupBy}
                        onValueChange={(value) => onHistoryFilterChange('groupBy', value as HistoryFiltersState['groupBy'])}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Per shoot" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shoot">Per shoot</SelectItem>
                          <SelectItem value="services">Services</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                        </div>
                  {(historyServicesSelected || historyFilters.search || historyFilters.clientId || historyFilters.photographerId || historyFilters.dateRange !== defaultHistoryFilters.dateRange || historyFilters.groupBy !== 'shoot') && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Filters applied.</span>
                      <Button variant="ghost" size="sm" onClick={resetHistoryFilters}>
                        Clear filters
                      </Button>
                    </div>
                  )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <TabsContent value="all" className="space-y-6">
                  {historyContent}

                  {historyMeta && historyFilters.groupBy === 'shoot' && (
                    <div className="flex items-center justify-between rounded-xl border bg-card p-4 text-sm">
                      <div>
                        Page {historyMeta.current_page} of {Math.ceil(historyMeta.total / historyMeta.per_page)} · {historyMeta.total} records
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleHistoryPageChange('prev')}
                          disabled={historyMeta.current_page === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleHistoryPageChange('next')}
                          disabled={historyMeta.current_page >= Math.ceil(historyMeta.total / historyMeta.per_page)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="mls-queue" className="space-y-6">
                  <MlsQueueView />
                </TabsContent>
              </Tabs>
            </TabsContent>
          )}

          {/* Linked View Tab - Shows combined data from all linked accounts */}
          {canViewLinkedAccounts && (
            <TabsContent value="linked" className="space-y-6">
              <div className="space-y-6">
                {/* Header with linked accounts info */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Link2 className="h-5 w-5" />
                          Linked Accounts View
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Combined data from {linkedAccounts.length + 1} linked account{(linkedAccounts.length + 1) !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {linkedLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <span className="ml-2 text-muted-foreground">Loading linked accounts...</span>
                    </div>
                  ) : (
                    <>
                    {linkedAccountsLoaded && linkedAccounts.length === 0 && (
                      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        No linked accounts yet. Invite another account to collaborate here.
                      </div>
                    )}
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <CalendarIcon className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                        <p className="text-2xl font-bold text-blue-600">
                          {sharedData?.totalShoots || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Shoots</p>
                      </div>
                      
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <DollarSign className="h-6 w-6 mx-auto mb-2 text-green-600" />
                        <p className="text-2xl font-bold text-green-600">
                          ${(sharedData?.totalSpent || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Spent</p>
                      </div>
                      
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <Building2 className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                        <p className="text-2xl font-bold text-purple-600">
                          {sharedData?.properties?.length || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Properties</p>
                      </div>
                      
                      <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <Camera className="h-6 w-6 mx-auto mb-2 text-orange-600" />
                        <p className="text-2xl font-bold text-orange-600">
                          {sharedData?.linkedAccounts?.length || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Linked Accounts</p>
                      </div>
                    </div>

                    {/* Linked Accounts List */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">Linked Accounts</h4>
                      <div className="space-y-2">
                        {/* Main Account */}
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium">
                                {user.name[0]?.toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-sm">{user.name} (You)</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                          <Badge variant="default">Main Account</Badge>
                        </div>
                        
                        {/* Linked Accounts */}
                        {linkedAccounts.map((account) => (
                          <div
                            key={account.id}
                            className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium">
                                  {(account.accountName || account.mainAccountName || 'Unknown')[0]?.toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-sm">{account.accountName || account.mainAccountName || 'Unknown Account'}</p>
                                <p className="text-xs text-muted-foreground">{account.accountEmail || account.mainAccountEmail || 'No email'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={account.status === 'active' ? 'default' : 'secondary'}
                              >
                                {account.status || 'Active'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Properties from all accounts */}
                    {sharedData?.properties && sharedData.properties.length > 0 && (
                      <div className="space-y-3 pt-4 border-t">
                        <h4 className="font-medium text-sm">All Properties ({sharedData.properties.length})</h4>
                        <div className="grid gap-2">
                          {sharedData.properties.slice(0, 6).map((property: any) => (
                            <div
                              key={property.id}
                              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm"
                            >
                              <div>
                                <p className="font-medium">{property.address}</p>
                                <p className="text-xs text-muted-foreground">
                                  {property.city}, {getStateFullName(property.state)} • {property.shootCount || 0} shoot{(property.shootCount || 0) !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </div>
                          ))}
                          {sharedData.properties.length > 6 && (
                            <p className="text-xs text-muted-foreground text-center pt-2">
                              And {sharedData.properties.length - 6} more properties...
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Recent Payment History */}
                    {sharedData?.paymentHistory && sharedData.paymentHistory.length > 0 && (
                      <div className="space-y-3 pt-4 border-t">
                        <h4 className="font-medium text-sm">Recent Payments (All Accounts)</h4>
                        <div className="space-y-2">
                          {sharedData.paymentHistory.slice(0, 5).map((payment: any) => (
                            <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm">
                              <div>
                                <p className="font-medium">${payment.amount.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">{payment.date} • {payment.type}</p>
                              </div>
                              <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                                {payment.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    </>
                  )}

                    {/* Last Activity */}
                    {sharedData?.lastActivity && (
                      <div className="text-xs text-muted-foreground text-center pt-4 border-t">
                        Last activity across all accounts: {new Date(sharedData.lastActivity).toLocaleString()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
      </DashboardLayout>
      {selectedShoot?.id && (
        <ShootDetailsModal
          shootId={selectedShoot.id}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false)
            setSelectedShoot(null)
          }}
          onShootUpdate={refreshActiveTabData}
          shouldHideClientDetails={shouldHideClientDetails}
        />
      )}
      {(isSuperAdmin || isAdmin) && (
        <BulkActionsDialog
          isOpen={isBulkActionsOpen}
          onClose={() => setIsBulkActionsOpen(false)}
          shoots={bulkShoots}
          isLoading={bulkShootsLoading}
          onComplete={refreshActiveTabData}
        />
      )}
      
      {/* Approval Modal for requested shoots */}
      {approvalModalShoot && (
        <ShootApprovalModal
          isOpen={!!approvalModalShoot}
          onClose={() => setApprovalModalShoot(null)}
          shootId={approvalModalShoot.id}
          shootAddress={approvalModalShoot.location?.address || ''}
          currentScheduledAt={approvalModalShoot.scheduledDate}
          onApproved={() => {
            setApprovalModalShoot(null)
            refreshActiveTabData()
          }}
          photographers={photographers}
        />
      )}

      {/* Decline Modal for requested shoots */}
      {declineModalShoot && (
        <ShootDeclineModal
          isOpen={!!declineModalShoot}
          onClose={() => setDeclineModalShoot(null)}
          shootId={declineModalShoot.id}
          shootAddress={declineModalShoot.location?.address || ''}
          onDeclined={() => {
            setDeclineModalShoot(null)
            refreshActiveTabData()
          }}
        />
      )}

      {/* Edit Modal for modifying shoot requests */}
      {editModalShoot && (
        <ShootEditModal
          isOpen={!!editModalShoot}
          onClose={() => setEditModalShoot(null)}
          shootId={editModalShoot.id}
          onSaved={() => {
            setEditModalShoot(null)
            refreshActiveTabData()
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteShootId !== null} onOpenChange={(open) => !open && setDeleteShootId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shoot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this shoot? This action cannot be undone and will permanently delete all associated files and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteShoot}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoice View Dialog */}
      {selectedInvoice && (
        <InvoiceViewDialog
          isOpen={invoiceDialogOpen}
          onClose={() => {
            setInvoiceDialogOpen(false)
            setSelectedInvoice(null)
          }}
          invoice={selectedInvoice}
        />
      )}
    </>
  )
}

const ShootHistoryWithBoundary = withErrorBoundary(ShootHistory)

export default ShootHistoryWithBoundary
