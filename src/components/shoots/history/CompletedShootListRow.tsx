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
import { getStateFullName } from '@/utils/stateUtils'
import { formatWorkflowStatus } from '@/utils/status'
import { getCheckoutLaunchToastCopy, openCheckoutLink } from '@/utils/checkoutLaunch'
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary'
import { getEditingNotes, formatCurrency, getShootPlaceholderSrc, resolveShootThumbnail } from './shootHistoryUtils'
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Edit,
  FileText,
  Image,
  Layers,
  Loader2,
  PauseCircle,
  Send,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react'
import { ShootData } from '@/types/shoots'

const getServiceLabel = (service: unknown): string => {
  if (typeof service === 'string') return service
  if (service && typeof service === 'object') {
    const candidate = service as { name?: unknown; label?: unknown }
    if (typeof candidate.name === 'string' && candidate.name.trim()) return candidate.name
    if (typeof candidate.label === 'string' && candidate.label.trim()) return candidate.label
  }
  return String(service ?? '')
}

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
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error || 'Failed to create payment link'
        : 'Failed to create payment link'
      toast({
        title: 'Error',
        description: message,
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

export const CompletedShootListRow = ({
  shoot,
  onSelect,
  onDownload,
  isSuperAdmin = false,
  isAdmin = false,
  isClient = false,
  showPaymentStatus = false,
  isEditingManager = false,
  isEditor = false,
  onDelete,
  onViewInvoice,
  onPayNow,
  onSendToEditing,
  shouldHideClientDetails = false,
}: {
  shoot: ShootData
  onSelect: (shoot: ShootData) => void
  onDownload?: (shoot: ShootData, type: 'full' | 'web') => void
  isSuperAdmin?: boolean
  isAdmin?: boolean
  isClient?: boolean
  showPaymentStatus?: boolean
  isEditingManager?: boolean
  isEditor?: boolean
  onDelete?: (shoot: ShootData) => void
  onViewInvoice?: (shoot: ShootData) => void
  onPayNow?: (shoot: ShootData) => void
  onSendToEditing?: (shoot: ShootData) => void
  shouldHideClientDetails?: boolean
}) => {
  const { formatDate: formatDatePref, formatTime } = useUserPreferences()
  const { theme } = useTheme()
  const [imgErrored, setImgErrored] = React.useState(false)
  const formatDisplayDateLocal = (value?: string | null) => {
    if (!value) return '—'
    try { return formatDatePref(new Date(value)) } catch { return value ?? '—' }
  }
  const heroImage = resolveShootThumbnail(shoot, 'thumb')
  const isInProgress = (shoot.status === 'in_progress' || shoot.workflowStatus === 'in_progress' || 
                        shoot.status === 'uploaded' || shoot.workflowStatus === 'uploaded' ||
                        shoot.status === 'editing' || shoot.workflowStatus === 'editing')
  const photoCount = isInProgress 
    ? (shoot.rawPhotoCount ?? shoot.files?.length ?? 0)
    : (shoot.media?.images?.length ?? shoot.editedPhotoCount ?? shoot.rawPhotoCount ?? shoot.files?.length ?? 0)
  const hasTour = shoot.tourPurchased || Boolean(shoot.tourLinks?.branded || shoot.tourLinks?.mls)
  const paymentSummary = normalizeShootPaymentSummary(shoot)
  const canShowPaymentStatus = showPaymentStatus && Boolean(onViewInvoice) && (
    paymentSummary.paymentStatus !== null ||
    paymentSummary.totalQuote > 0 ||
    paymentSummary.totalPaid > 0
  )
  const isPaid = paymentSummary.paymentStatus === 'paid'
  const paymentBadgeLabel = isPaid
    ? `Paid: ${formatCurrency(paymentSummary.totalPaid)}`
    : paymentSummary.totalPaid > 0.01
      ? `Partial: ${formatCurrency(paymentSummary.totalPaid)}`
      : 'Unpaid'
  const balanceDue = paymentSummary.balance
  const hasPendingPayment = isClient && balanceDue > 0.01 && paymentSummary.paymentStatus !== 'paid'
  const statusValue = shoot.workflowStatus ?? shoot.status ?? ''
  const statusLabel = formatWorkflowStatus(statusValue)
  const editingNotes = getEditingNotes(shoot.notes)
  const canShowEditingNotes = Boolean(editingNotes) && (isSuperAdmin || isAdmin || isEditingManager || isEditor)
  const shootStatus = String(shoot.status ?? shoot.workflowStatus ?? '').toLowerCase()
  const canSendToEditing = Boolean(onSendToEditing) && shootStatus === 'uploaded'

  const placeholderImage = getShootPlaceholderSrc(theme)
  const hasNoImages = !heroImage
  const showPlaceholder = hasNoImages || imgErrored
  const displayImage = showPlaceholder ? placeholderImage : heroImage

  return (
    <Card
      className="cursor-pointer hover:border-primary/60 hover:shadow-md transition-all group"
      onClick={() => onSelect(shoot)}
    >
      <div className="flex items-stretch gap-3 sm:gap-4 p-3 sm:p-4">
        {/* Thumbnail - Small square on mobile, rectangular landscape on desktop */}
        <div
          className={cn(
            'relative w-28 aspect-[4/3] overflow-hidden rounded-lg flex-shrink-0 self-start shadow-sm sm:w-40 min-[1180px]:w-44',
            showPlaceholder ? 'bg-transparent' : 'bg-muted'
          )}
        >
          <img 
            src={displayImage} 
            alt={shoot.location.address} 
            className={cn(
              'absolute inset-0 h-full w-full',
              showPlaceholder ? 'object-contain' : 'object-cover'
            )}
            loading="lazy"
            onError={() => setImgErrored(true)}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex flex-col gap-3">
            {/* Top row: Address + date */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h3
                className="mb-1 text-[0.92rem] font-bold leading-[1.1] break-words text-balance min-[1180px]:text-[0.98rem]"
                title={shoot.location.address}
              >
                {shoot.location.address}
              </h3>
              <p
                className="text-[0.72rem] leading-[1.2] text-muted-foreground break-words min-[1180px]:text-[0.78rem]"
                title={`${shoot.location.city}, ${getStateFullName(shoot.location.state)} ${shoot.location.zip}`}
              >
                {shoot.location.city}, {getStateFullName(shoot.location.state)} {shoot.location.zip}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground flex-shrink-0 min-[1180px]:justify-end min-[1180px]:gap-3 min-[1180px]:text-sm">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5 min-[1180px]:h-4 min-[1180px]:w-4" />
                <span className="font-medium">{formatDisplayDateLocal(shoot.completedDate || shoot.scheduledDate)}</span>
              </div>
              {shoot.time && shoot.time !== 'TBD' && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 min-[1180px]:h-4 min-[1180px]:w-4" />
                  <span className="font-medium">{formatTime(shoot.time)}</span>
                </div>
              )}
              {canShowPaymentStatus && (
                <Badge variant={isPaid ? 'secondary' : 'destructive'} className="text-xs">
                  {paymentBadgeLabel}
                </Badge>
              )}
              {isSuperAdmin && !isPaid && (
                <div onClick={(e) => e.stopPropagation()}>
                  <PaymentButton shoot={shoot} onViewInvoice={onViewInvoice} />
                </div>
              )}
            </div>
            </div>

            {/* Services */}
            {(() => {
              const services = Array.isArray(shoot.services) ? shoot.services : [];
              return (
                <div className="flex flex-wrap items-start gap-2 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2 pt-0.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    <Layers className="h-3.5 w-3.5" />
                    <span>Services</span>
                  </div>
                  {services.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {services.map((service, idx) => {
                        const serviceName = getServiceLabel(service);
                        if (!serviceName) return null;
                        return (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="bg-primary/10 text-primary hover:bg-primary/20 font-medium px-2 py-0.5 text-xs rounded-md border border-primary/20"
                          >
                            {serviceName}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="pt-0.5 text-xs text-muted-foreground/70 italic">No services assigned</p>
                  )}
                </div>
              );
            })()}

            {/* Footer metadata + actions */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/50 min-[1180px]:flex-row min-[1180px]:items-end min-[1180px]:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  {!shouldHideClientDetails && (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <User className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate"><span className="font-semibold text-foreground">{shoot.client.name}</span></span>
                    </span>
                  )}
                  {!isEditor && (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate"><span className="font-semibold text-foreground">{shoot.photographer?.name ?? 'Unassigned'}</span></span>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Image className="h-3.5 w-3.5" />
                    <span>{photoCount} photos</span>
                  </span>
                  {hasTour && (
                    <Badge variant="secondary" className="text-[10px] font-medium py-0 px-1.5">
                      Tour
                    </Badge>
                  )}
                </div>
                {!shouldHideClientDetails && shoot.client.email && (
                  <p className="mt-1 text-xs text-muted-foreground truncate">{shoot.client.email}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 min-[1180px]:justify-end">
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
                {hasPendingPayment && onPayNow && (
                  <Button
                    size="sm"
                    className="h-7 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPayNow(shoot)
                    }}
                    title="Pay now"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Pay ${balanceDue.toFixed(2)}</span>
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
          </div>

        </div>
      </div>
      {/* Editing Notes - full-width bottom banner */}
      {canShowEditingNotes && editingNotes && (
        <div className="bg-gray-100 dark:bg-purple-900/30 px-3 sm:px-4 py-1.5 text-xs flex items-center gap-2 border-t border-gray-200 dark:border-purple-700/30 rounded-b-lg">
          <span className="text-gray-700 dark:text-purple-400 font-medium">Editing notes :</span>
          <span className="text-gray-600 dark:text-purple-300 truncate">{editingNotes}</span>
        </div>
      )}
    </Card>
  )
}

