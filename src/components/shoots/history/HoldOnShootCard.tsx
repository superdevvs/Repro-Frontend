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
  requested: { icon: AlertCircle, color: 'text-slate-600', bgColor: 'bg-slate-50 border-slate-200' },
  scheduled: { icon: CalendarIcon, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  booked: { icon: CalendarIcon, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  in_progress: { icon: Camera, color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200' },
  in_field: { icon: Camera, color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200' },
  editing: { icon: Image, color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200' },
  ready_for_review: { icon: CheckCircle2, color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-200' },
  pending_review: { icon: AlertCircle, color: 'text-yellow-600', bgColor: 'bg-yellow-50 border-yellow-200' },
  rescheduled: { icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
  completed: { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200' },
  ready: { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200' },
  on_hold: { icon: PauseCircle, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
  hold_on: { icon: PauseCircle, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
  cancelled: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50 border-red-200' },
  canceled: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50 border-red-200' },
  awaiting_date: { icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
  payment_pending: { icon: DollarSign, color: 'text-red-600', bgColor: 'bg-red-50 border-red-200' },
}

const holdStatusAliasMap: Record<string, string> = {
  admin_verified: 'delivered',
  booked: 'scheduled',
  completed: 'uploaded',
  delivered_to_client: 'delivered',
  editing_complete: 'editing',
  editing_issue: 'editing',
  editing_uploaded: 'editing',
  hold_on: 'on_hold',
  in_progress: 'uploaded',
  pending_review: 'editing',
  photos_uploaded: 'uploaded',
  qc: 'editing',
  raw_issue: 'uploaded',
  raw_upload_pending: 'scheduled',
  raw_uploaded: 'uploaded',
  ready_for_client: 'delivered',
  ready_for_review: 'editing',
  review: 'editing',
}

export const HoldOnShootCard = ({
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
  const rawHoldStatus = String(shoot.holdStatus ?? '').trim().toLowerCase()
  const normalizedHoldStatus = holdStatusAliasMap[rawHoldStatus] ?? rawHoldStatus
  const holdStatusKey = normalizedHoldStatus && normalizedHoldStatus !== 'on_hold'
    ? normalizedHoldStatus
    : 'on_hold'
  const holdStatusConfig = statusConfig[holdStatusKey] ?? statusConfig.on_hold
  const HoldStatusIcon = holdStatusConfig.icon
  const holdStatusLabel = formatWorkflowStatus(holdStatusKey, 'On Hold')
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
              <Badge className={cn(holdStatusConfig.bgColor, holdStatusConfig.color)}>
                <HoldStatusIcon className="h-3.5 w-3.5 mr-1" />
                {holdStatusLabel}
              </Badge>
            </div>
            <h3 className="font-bold text-lg leading-tight text-primary">{shoot.location.fullAddress}</h3>
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
            {!isEditor && shoot.photographer?.name && shoot.photographer.name !== 'Unassigned' && (
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
                          className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200 dark:bg-primary/10 dark:text-primary dark:hover:bg-primary/20 dark:border-primary/20 font-medium px-3 py-1 text-sm rounded-md border"
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

