import React, { memo, useState } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { API_BASE_URL } from '@/config/env'
import { useTheme } from '@/hooks/useTheme'
import { useToast } from '@/hooks/use-toast'
import { useUserPreferences } from '@/contexts/UserPreferencesContext'
import { useWeatherData } from '@/hooks/useWeatherData'
import { formatTimeForDisplay } from '@/utils/availabilityUtils'
import { getShootLocalDate, parseLocalYmd } from '@/utils/shootLocalDate'
import { getStateFullName } from '@/utils/stateUtils'
import { formatWorkflowStatus } from '@/utils/status'
import { getCheckoutLaunchToastCopy, openCheckoutLink } from '@/utils/checkoutLaunch'
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary'
import { getApprovalNotes, getEditingNotes, formatCurrency, getShootPlaceholderSrc, getShootStatusBadgeClass, resolveShootThumbnail } from './shootHistoryUtils'
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  CloudSun,
  CreditCard,
  DollarSign,
  Download,
  Edit,
  FileText,
  Image,
  Layers,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  Send,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react'
import { ShootData } from '@/types/shoots'
// Payment Button Component for Super Admin
const PaymentButton = ({ shoot, onViewInvoice }: { shoot: ShootData; onViewInvoice?: (shoot: ShootData) => void }) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleInvoice = () => {
    if (onViewInvoice) {
      onViewInvoice(shoot)
    }
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
        const launchMode = openCheckoutLink(response.data.checkoutUrl)
        toast(getCheckoutLaunchToastCopy(launchMode))
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

// Status configuration for visual consistency
const statusConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  requested: { icon: AlertCircle, color: 'text-sky-600', bgColor: 'bg-sky-50 border-sky-200' },
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

export const ScheduledShootListRow = ({
  shoot,
  onSelect,
  isSuperAdmin = false,
  isAdmin = false,
  isClient = false,
  isEditingManager = false,
  isEditor = false,
  onDelete,
  onViewInvoice,
  onPayNow,
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
  isClient?: boolean
  isEditingManager?: boolean
  isEditor?: boolean
  onDelete?: (shoot: ShootData) => void
  onViewInvoice?: (shoot: ShootData) => void
  onPayNow?: (shoot: ShootData) => void
  onApprove?: (shoot: ShootData) => void
  onDecline?: (shoot: ShootData) => void
  onModify?: (shoot: ShootData) => void
  onSendToEditing?: (shoot: ShootData) => void | Promise<void>
  shouldHideClientDetails?: boolean
}) => {
  const { formatDate: formatDatePref, formatTemperature } = useUserPreferences()
  // Route shoot-time display through the shared Time_Formatter so canonical
  // values (HH:mm and HH:mm:ss, e.g. 07:00:00) render as 12-hour text (7:00 AM).
  const formatTime = formatTimeForDisplay
  // Source the day from the shoot's intended local calendar date (never the
  // absolute instant) so it does not drift across browser timezones.
  const formatDisplayDateLocal = (value?: string | null) => {
    if (!value) return '—'
    try { return formatDatePref(value) } catch { return value ?? '—' }
  }
  const shootLocalDate = getShootLocalDate(shoot)
  const weatherDate = parseLocalYmd(shootLocalDate)
  const hasWeatherDate = !Number.isNaN(weatherDate.getTime())
  const fetchedWeather = useWeatherData({
    date: hasWeatherDate ? weatherDate : undefined,
    time: shoot.time,
    address: shoot.location.fullAddress || shoot.location.address,
    city: shoot.location.city,
    state: shoot.location.state,
    zip: shoot.location.zip,
    enabled: hasWeatherDate,
  })
  // Prioritize status over workflowStatus for display, but check both
  const displayStatus = shoot.status ?? shoot.workflowStatus ?? 'scheduled'
  // Normalize hold_on to on_hold for config lookup
  const statusKey = displayStatus === 'hold_on' ? 'on_hold' : displayStatus
  const statusLabel = formatWorkflowStatus(displayStatus)
  const config = statusConfig[statusKey] ?? statusConfig[displayStatus] ?? statusConfig.scheduled
  const statusBadgeClass = getShootStatusBadgeClass(statusKey)
  const StatusIcon = config.icon
  const paymentSummary = normalizeShootPaymentSummary(shoot)
  const clientHasPendingPayment = isClient && paymentSummary.balance > 0.01 && paymentSummary.paymentStatus !== 'paid'
  const canShowPaymentStatus = isSuperAdmin || isAdmin || isClient
  const paymentStatus = canShowPaymentStatus
    ? paymentSummary.paymentStatus === 'paid'
      ? 'Paid'
      : paymentSummary.paymentStatus === 'partial'
        ? 'Partial'
        : 'Unpaid'
    : null
  const paymentBadgeVariant = paymentStatus === 'Paid'
    ? 'secondary'
    : paymentStatus === 'Partial'
      ? 'outline'
      : 'destructive'
  const approvalNotes = getApprovalNotes(shoot.notes)
  const editingNotes = getEditingNotes(shoot.notes)
  const canShowApprovalNotes = Boolean(approvalNotes) && (isSuperAdmin || isAdmin || isEditingManager)
  const canShowEditingNotes = Boolean(editingNotes) && (isSuperAdmin || isAdmin || isEditingManager || isEditor)
  const shootStatus = String(shoot.status ?? shoot.workflowStatus ?? '').toLowerCase()
  const canSendToEditing = Boolean(onSendToEditing) && shootStatus === 'uploaded'
  const canShowRequestedActions = displayStatus === 'requested' && (isAdmin || isSuperAdmin) && (onApprove || onDecline || onModify)
  const hasBottomActions = Boolean(
    (clientHasPendingPayment && onPayNow) ||
      canSendToEditing ||
      onViewInvoice ||
      ((isSuperAdmin || isAdmin) && onDelete) ||
      canShowRequestedActions
  )
  const [isSendingToEditing, setIsSendingToEditing] = useState(false)
  const weatherTemperatureLabel = (() => {
    const rawTemperature = fetchedWeather.temperature ?? shoot.weather?.temperature ?? (shoot as any).temperature
    if (rawTemperature === null || rawTemperature === undefined || rawTemperature === '') return null

    if (typeof rawTemperature === 'string' && rawTemperature.includes('°')) {
      return rawTemperature
    }

    const numericTemperature = Number(rawTemperature)
    return Number.isFinite(numericTemperature) ? formatTemperature(numericTemperature) : String(rawTemperature)
  })()
  const weatherCondition = fetchedWeather.condition ?? shoot.weather?.summary ?? (shoot as any).weather_description ?? null
  const hasWeather = Boolean(weatherTemperatureLabel || weatherCondition)

  const handleSendToEditingClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onSendToEditing || isSendingToEditing) return
    setIsSendingToEditing(true)
    try {
      await onSendToEditing(shoot)
    } finally {
      setIsSendingToEditing(false)
    }
  }

  const overflowActionsAvailable = Boolean(
    canSendToEditing || onViewInvoice || ((isSuperAdmin || isAdmin) && onDelete),
  )

  const renderOverflowMenu = (triggerClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={triggerClassName}
          onClick={(e) => e.stopPropagation()}
          title="More actions"
          aria-label="More actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {canSendToEditing && (
          <DropdownMenuItem
            disabled={isSendingToEditing}
            onClick={(e) => {
              e.stopPropagation()
              void handleSendToEditingClick(e)
            }}
          >
            {isSendingToEditing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send to editing
          </DropdownMenuItem>
        )}
        {onViewInvoice && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onViewInvoice(shoot)
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            View invoice
          </DropdownMenuItem>
        )}
        {(isSuperAdmin || isAdmin) && onDelete && (
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(shoot)
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete shoot
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <Card
      className="cursor-pointer border border-border/70 bg-card/50 hover:border-primary/50 hover:shadow-lg transition-all group backdrop-blur-sm flex flex-col"
      onClick={() => onSelect(shoot)}
    >
      <div className="p-4 sm:p-4 flex flex-col flex-1">
        {/* Row 1: Date/Time | Address | Client/Photographer | Status */}
        {/* Mobile: Stack vertically, Desktop: Horizontal layout */}
        <div className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)] lg:grid-cols-[140px_minmax(220px,1fr)_minmax(220px,0.72fr)_auto] lg:items-start lg:gap-4 mb-2">
          {/* Top row on mobile: Date/Time and Status */}
          <div className="flex items-start justify-between gap-3 md:hidden">
            {/* Date and Time - Left Side */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>{formatDisplayDateLocal(shootLocalDate)}</span>
              </div>
              {shoot.time && shoot.time !== 'TBD' && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{formatTime(shoot.time)}</span>
                </div>
              )}
              {hasWeather && (
                <div
                  className="mt-1 flex max-w-[130px] items-center gap-1.5 truncate text-xs text-muted-foreground"
                  title={[weatherTemperatureLabel, weatherCondition].filter(Boolean).join(' · ')}
                >
                  <CloudSun className="h-3.5 w-3.5 flex-shrink-0 text-sky-400" />
                  {weatherTemperatureLabel && <span className="font-medium text-foreground">{weatherTemperatureLabel}</span>}
                  {weatherCondition && <span className="min-w-0 truncate capitalize">{weatherCondition}</span>}
                </div>
              )}
            </div>
            {/* Status - Right Side (mobile only) */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn('capitalize font-medium', statusBadgeClass)}>
                  <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
                  {statusLabel}
                </Badge>
                {paymentStatus && (
                  <Badge variant={paymentBadgeVariant} className="text-xs">
                    {paymentStatus}
                  </Badge>
                )}
              </div>
              {overflowActionsAvailable && (
                <div onClick={(e) => e.stopPropagation()}>
                  {renderOverflowMenu('h-9 w-9 rounded-xl p-0')}
                </div>
              )}
            </div>
          </div>

          {/* Desktop: Date and Time - Left Side */}
          <div className="hidden md:flex flex-col gap-0.5 min-w-[140px] flex-shrink-0">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>{formatDisplayDateLocal(shootLocalDate)}</span>
            </div>
            {shoot.time && shoot.time !== 'TBD' && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{formatTime(shoot.time)}</span>
              </div>
            )}
            {hasWeather && (
              <div
                className="mt-1 flex max-w-[132px] items-center gap-1.5 truncate text-xs text-muted-foreground"
                title={[weatherTemperatureLabel, weatherCondition].filter(Boolean).join(' · ')}
              >
                <CloudSun className="h-3.5 w-3.5 flex-shrink-0 text-sky-400" />
                {weatherTemperatureLabel && <span className="font-medium text-foreground">{weatherTemperatureLabel}</span>}
                {weatherCondition && <span className="min-w-0 truncate capitalize">{weatherCondition}</span>}
              </div>
            )}
          </div>

          {/* Address - Main Content (can wrap) - Highlighted & Larger */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className="min-w-0 max-w-full overflow-hidden text-lg font-bold leading-tight text-primary [display:-webkit-box] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                title={shoot.location.address}
              >
                {shoot.location.address}
              </h3>
            </div>
            <p
              className="mt-1 min-w-0 max-w-full truncate text-sm text-muted-foreground"
              title={`${shoot.location.city}, ${getStateFullName(shoot.location.state)} ${shoot.location.zip}`}
            >
              {shoot.location.city}, {getStateFullName(shoot.location.state)} {shoot.location.zip}
            </p>
          </div>

          {/* Client & Photographer - Compact Inline */}
          <div className="flex min-w-0 flex-col gap-1.5 text-sm md:col-start-2 lg:col-start-auto lg:max-w-[360px] xl:max-w-[440px]">
            {!shouldHideClientDetails && (
              <div className="flex min-w-0 items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="min-w-0 truncate font-medium" title={shoot.client.name}>
                  {shoot.client.name}
                </span>
              </div>
            )}
            {!isEditor && shoot.photographer?.name && shoot.photographer.name !== 'Unassigned' && (
              <div className="flex min-w-0 items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="min-w-0 truncate font-medium" title={shoot.photographer.name}>
                  {shoot.photographer.name}
                </span>
              </div>
            )}
          </div>

          {/* Desktop: Status & Actions - Right Side */}
          <div className="hidden md:flex md:col-start-2 lg:col-start-auto items-center gap-2 flex-shrink-0 lg:justify-end">
            {paymentStatus && (
              <Badge variant={paymentBadgeVariant} className="text-xs">
                {paymentStatus}
              </Badge>
            )}
            {isSuperAdmin && paymentStatus === 'Unpaid' && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <PaymentButton shoot={shoot} onViewInvoice={onViewInvoice} />
              </div>
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
              <div className="hidden md:flex min-w-[140px] flex-shrink-0 items-start">
                <Badge variant="outline" className={cn('capitalize font-medium', statusBadgeClass)}>
                  <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
                  {statusLabel}
                </Badge>
              </div>
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
                          className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200 dark:bg-primary/10 dark:text-primary dark:hover:bg-primary/20 dark:border-primary/20 font-medium px-2.5 py-1 text-xs rounded-md border"
                        >
                          {serviceName}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground/70 italic">No services assigned</p>
                    )}
                  </div>
                  {hasBottomActions ? (
                    <div
                      className="mt-1 flex w-full flex-col gap-2 sm:mt-0 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Primary row: primary action + overflow menu side by side */}
                      <div className="flex items-center justify-end gap-2 sm:contents">
                        {clientHasPendingPayment && onPayNow && (
                          <Button
                            size="sm"
                            className="h-11 flex-1 justify-center rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 sm:h-9 sm:flex-none sm:rounded-md sm:text-xs sm:font-medium"
                            onClick={(e) => {
                              e.stopPropagation()
                              onPayNow(shoot)
                            }}
                          >
                            <CreditCard className="mr-1.5 h-4 w-4" />
                            Pay ${paymentSummary.balance.toFixed(2)}
                          </Button>
                        )}
                        {canShowRequestedActions && onApprove && (
                          <Button
                            size="sm"
                            className="h-11 flex-1 justify-center rounded-xl bg-green-600 text-sm font-semibold text-white shadow-sm hover:bg-green-700 sm:h-9 sm:flex-none sm:rounded-md sm:text-xs sm:font-medium"
                            onClick={(e) => {
                              e.stopPropagation();
                              onApprove(shoot);
                            }}
                          >
                            <Check className="mr-1.5 h-4 w-4" />
                            Approve
                          </Button>
                        )}
                        {overflowActionsAvailable && (
                          <div className="hidden md:contents">
                            {renderOverflowMenu('h-9 w-9 shrink-0 rounded-md p-0 md:order-last')}
                          </div>
                        )}
                      </div>
                      {canShowRequestedActions && (onModify || onDecline) && (
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
                          {onModify && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-10 w-full justify-center rounded-xl text-sm font-medium sm:h-9 sm:w-auto sm:rounded-md sm:text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                onModify(shoot);
                              }}
                            >
                              <Edit className="mr-1.5 h-4 w-4" />
                              Modify
                            </Button>
                          )}
                          {onDecline && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-10 w-full justify-center rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 sm:h-9 sm:w-auto sm:rounded-md sm:text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDecline(shoot);
                              }}
                            >
                              <X className="mr-1.5 h-4 w-4" />
                              Decline
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })()}

      </div>
      {(canShowApprovalNotes && approvalNotes) || (canShowEditingNotes && editingNotes) ? (
        <div className="overflow-hidden rounded-b-lg border-t border-gray-200 dark:border-slate-700/40">
          {canShowApprovalNotes && approvalNotes && (
            <div className="bg-gray-100 px-3 py-1.5 text-xs sm:px-4 dark:bg-slate-900/40">
              <span className="text-gray-700 font-medium dark:text-slate-300">Approval notes :</span>{' '}
              <span className="text-gray-600 dark:text-slate-400">{approvalNotes}</span>
            </div>
          )}
          {canShowEditingNotes && editingNotes && (
            <div className="bg-gray-100 px-3 py-1.5 text-xs sm:px-4 dark:bg-purple-900/30">
              <span className="text-gray-700 font-medium dark:text-purple-400">Editing notes :</span>{' '}
              <span className="text-gray-600 dark:text-purple-300">{editingNotes}</span>
            </div>
          )}
        </div>
      ) : null}
    </Card>
  )
}

