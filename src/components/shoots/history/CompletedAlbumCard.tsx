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

export const CompletedAlbumCard = ({
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
  const { formatTime, formatDate: formatDatePref } = useUserPreferences()
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
  const placeholderImage = getShootPlaceholderSrc(theme)
  const hasNoImages = !heroImage
  const showPlaceholder = hasNoImages || imgErrored
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

  return (
    <Card
      className="overflow-hidden cursor-pointer border border-border/70 hover:border-primary/50 hover:shadow-xl transition-all group bg-card/50 backdrop-blur-sm"
      onClick={() => onSelect(shoot)}
    >
      {/* Cover Image or Placeholder */}
      <div className={cn('relative h-64 overflow-hidden', showPlaceholder ? 'bg-transparent' : 'bg-muted')}>
        {showPlaceholder ? (
          <img 
            src={placeholderImage}
            alt="No images yet" 
            className="w-full h-full object-contain"
          />
        ) : (
          <img 
            src={heroImage} 
            alt={shoot.location.address} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={() => setImgErrored(true)}
          />
        )}
        {!showPlaceholder ? (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        ) : null}
        
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
              if (statusKey === 'ready' || statusKey === 'ready_for_client') return 'bg-amber-500 text-white';
              if (statusKey.includes('delivered') || statusKey.includes('admin_verified') || statusKey.includes('workflow_completed') || statusKey.includes('client_delivered') || statusKey.includes('finalized') || statusKey.includes('finalised')) return 'bg-emerald-500 text-white';
              if (statusKey.includes('declined')) return 'bg-red-500 text-white';
              if (statusKey.includes('cancel')) return 'border border-red-500/80 bg-red-500/10 text-red-700 shadow-[0_0_0_1px_rgba(239,68,68,0.35)] dark:bg-red-950/40 dark:text-red-200';
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
        </div>

        {/* Paid/Unpaid badge - Lower right (non-hover) */}
        {canShowPaymentStatus && (
          <div className="absolute bottom-3 right-3 opacity-100 group-hover:opacity-0 transition-opacity">
            <Badge variant={isPaid ? 'secondary' : 'destructive'} className="text-xs font-medium shadow-sm">
              {paymentBadgeLabel}
            </Badge>
          </div>
        )}
        
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
              title="Downloads"
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
      <div className="p-5 xl:p-6 space-y-5">
        <div className="flex flex-col gap-3 min-[1180px]:flex-row min-[1180px]:items-start min-[1180px]:justify-between min-[1180px]:gap-4">
          <div className="flex-1 min-w-0">
            <h3
              className="mb-1 text-[0.95rem] font-bold leading-[1.1] break-words text-balance min-[1180px]:text-[1rem]"
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
          <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground flex-shrink-0 min-[1180px]:items-end min-[1180px]:text-sm">
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
            {shoot.payment?.totalQuote && (isSuperAdmin || isAdmin) && (
              <span className="text-sm font-semibold text-foreground">{formatCurrency(shoot.payment.totalQuote)}</span>
            )}
          </div>
        </div>

        <div className="space-y-2 pb-3 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Layers className="h-3.5 w-3.5" />
            <span>Services</span>
          </div>
          {shoot.services && shoot.services.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {shoot.services.map((service, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="bg-primary/10 text-primary hover:bg-primary/20 font-medium px-2 py-0.5 text-xs rounded-md border border-primary/20"
                >
                  {getServiceLabel(service)}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/70 italic">No services assigned</p>
          )}
        </div>

        <div
          className={cn(
            'grid gap-4 pt-2 border-t border-border/50',
            shouldHideClientDetails ? 'grid-cols-1' : 'grid-cols-2'
          )}
        >
          {!shouldHideClientDetails && (
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <User className="h-3.5 w-3.5" />
                <span>Client</span>
              </div>
              <p className="text-sm font-semibold truncate">{shoot.client.name}</p>
              {shoot.client.email && (
                <p className="text-xs text-muted-foreground truncate">{shoot.client.email}</p>
              )}
            </div>
          )}
          {!isEditor && (
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Camera className="h-3.5 w-3.5" />
                <span>Photographer</span>
              </div>
              <p className="text-sm font-semibold truncate">{shoot.photographer?.name ?? 'Unassigned'}</p>
            </div>
          )}
        </div>

        {hasPendingPayment && onPayNow && (
          <div className="pt-3 border-t border-border/50">
            <Button
              size="sm"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={(e) => {
                e.stopPropagation()
                onPayNow(shoot)
              }}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Pay now ${balanceDue.toFixed(2)}
            </Button>
          </div>
        )}

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

