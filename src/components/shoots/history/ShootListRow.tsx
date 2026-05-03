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
import { getCheckoutLaunchToastCopy, openCheckoutLink } from '@/utils/checkoutLaunch'
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

export const ShootListRow = ({
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
  const rawStatusValue = shoot.workflowStatus ?? shoot.status ?? ''
  const statusLabel = formatWorkflowStatus(rawStatusValue)
  const normalizedStatusValue = String(rawStatusValue).toLowerCase()
  const isCancelledStatus = normalizedStatusValue === 'cancelled' || normalizedStatusValue === 'canceled'
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
          <h3 className="text-lg font-bold leading-tight text-primary">
            {shoot.location.fullAddress}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'uppercase tracking-wide',
              isCancelledStatus &&
                'border-red-500/80 bg-red-500/10 text-red-700 shadow-[0_0_0_1px_rgba(239,68,68,0.35)] dark:bg-red-950/40 dark:text-red-200'
            )}
          >
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
                    className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200 dark:bg-primary/10 dark:text-primary dark:hover:bg-primary/20 dark:border-primary/20 font-medium px-3 py-1 text-sm rounded-md border"
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
