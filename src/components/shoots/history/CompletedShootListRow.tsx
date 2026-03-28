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
  const isPaid = isSuperAdmin ? ((shoot.payment?.totalPaid ?? 0) >= (shoot.payment?.totalQuote ?? 0)) : false
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
      <div className="flex gap-3 sm:gap-4 p-3 sm:p-4">
        {/* Thumbnail - Small square on mobile, rectangular landscape on desktop */}
        <div className={cn('w-24 h-24 sm:w-40 sm:h-28 rounded-lg overflow-hidden flex-shrink-0 shadow-sm', showPlaceholder ? 'bg-transparent' : 'bg-muted')}>
          <img 
            src={displayImage} 
            alt={shoot.location.address} 
            className={cn('w-full h-full', showPlaceholder ? 'object-contain' : 'object-cover')}
            loading="lazy"
            onError={() => setImgErrored(true)}
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
              <h3 className="font-bold text-lg leading-tight truncate text-primary">{shoot.location.fullAddress}</h3>
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
                  <PaymentButton shoot={shoot} onViewInvoice={onViewInvoice} />
                </div>
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
                          className="bg-gray-100 text-gray-600 border-gray-200 dark:bg-primary/5 dark:text-primary dark:border-primary/20 font-medium text-xs py-0.5 px-2 rounded-full"
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

