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
import { getApprovalNotes, getEditingNotes, formatCurrency, getShootPlaceholderSrc, resolveShootThumbnail } from './shootHistoryUtils'
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

export const ScheduledShootListRow = ({
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
  const approvalNotes = getApprovalNotes(shoot.notes)
  const editingNotes = getEditingNotes(shoot.notes)
  const canShowApprovalNotes = Boolean(approvalNotes) && (isSuperAdmin || isAdmin || isEditingManager || isEditor)
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

          {/* Address - Main Content (can wrap) - Highlighted & Larger */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold leading-tight break-words text-primary">{shoot.location.address}</h3>
            <p className="text-sm text-muted-foreground break-words">
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
            {isSuperAdmin && paymentStatus === 'Unpaid' && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <PaymentButton shoot={shoot} onViewInvoice={onViewInvoice} />
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
                          className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200 dark:bg-primary/10 dark:text-primary dark:hover:bg-primary/20 dark:border-primary/20 font-medium px-2.5 py-1 text-xs rounded-md border"
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

