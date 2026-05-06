import React, { memo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useUserPreferences } from '@/contexts/UserPreferencesContext'
import { formatCurrency, getShootStatusBadgeClass } from './shootHistoryUtils'
import {
  Building2,
  Calendar as CalendarIcon,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  DollarSign,
  Edit,
  FileText,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Send,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { ShootData, ShootHistoryRecord, ShootHistoryServiceAggregate } from '@/types/shoots'

export const HistoryRow = memo(({
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
  onSendToEditing?: (shoot: ShootData | { id: string | number; status?: string | null; workflowStatus?: string | null }) => void | Promise<void>
  shouldHideClientDetails?: boolean
}) => {
  const { formatDate: formatDatePref } = useUserPreferences()
  const formatDisplayDatePref = (value?: string | null) => {
    if (!value) return '—'
    try { return formatDatePref(new Date(value)) } catch { return value ?? '—' }
  }
  const [open, setOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [isSendingToEditing, setIsSendingToEditing] = useState(false)
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
  const approvalNotesValue = (record.notes as any)?.approvalNotes || (record.notes as any)?.approval
  const editingNotesValue = (record.notes as any)?.editingNotes || (record.notes as any)?.editing
  const canShowApprovalNotes = Boolean(approvalNotesValue) && (isSuperAdmin || isAdmin || isEditingManager)
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

  const handleSendToEditingClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onSendToEditing || !record.id || isSendingToEditing) return
    setIsSendingToEditing(true)
    try {
      await onSendToEditing({ id: record.id, status: record.status })
    } finally {
      setIsSendingToEditing(false)
    }
  }

  return (
    <Card className="overflow-hidden border hover:border-primary/40 transition-colors">
      <div className="cursor-pointer p-3 sm:p-4 hover:bg-muted/30 transition-colors" onClick={() => setOpen((prev) => !prev)}>
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
                getShootStatusBadgeClass(record.status)
              )}
            >
              {statusLabel}
            </Badge>
            {record.id && (
              <Badge variant="secondary" className="text-[11px] font-semibold">
                ID #{record.id}
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
                <Button size="sm" variant="ghost" onClick={handlePublishMls} disabled={isBusy || publishing} className="h-auto p-0 hover:bg-transparent">
                  {publishing ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Publishing...
                    </span>
                  ) : (
                    <img
                      src="/brightmls-media-sync-button.svg"
                      alt="Publish to Bright MLS"
                      className="h-8 w-auto rounded-full"
                    />
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
                  onClick={handleSendToEditingClick}
                  title="Send to Editing"
                  disabled={isSendingToEditing}
                >
                  {isSendingToEditing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
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

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary/70" />
            <span className="truncate max-w-[400px] font-semibold text-base text-foreground">{record.address?.full ?? '—'}</span>
          </div>
          {!isEditor && (
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              <span>{record.photographer?.name ?? 'Unassigned'}</span>
            </div>
          )}
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
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground ml-auto transition-transform', open && 'rotate-180')} />
        </div>
      </div>
      {(canShowApprovalNotes && approvalNotesValue) || (canShowEditingNotes && editingNotesValue) ? (
        <div className="overflow-hidden rounded-b-lg border-t border-gray-200 dark:border-slate-700/40">
          {canShowApprovalNotes && approvalNotesValue && (
            <div className="bg-gray-100 px-3 py-1.5 text-xs sm:px-4 dark:bg-slate-900/40">
              <span className="text-gray-700 font-medium dark:text-slate-300">Approval notes :</span>{' '}
              <span className="text-gray-600 dark:text-slate-400">{approvalNotesValue}</span>
            </div>
          )}
          {canShowEditingNotes && editingNotesValue && (
            <div className="bg-gray-100 px-3 py-1.5 text-xs sm:px-4 dark:bg-purple-900/30">
              <span className="text-gray-700 font-medium dark:text-purple-400">Editing notes :</span>{' '}
              <span className="text-gray-600 dark:text-purple-300">{editingNotesValue}</span>
            </div>
          )}
        </div>
      ) : null}
      {open && (
        <div className="border-t bg-muted/20 p-3 sm:p-5">
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
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
                  {!isEditor && (
                    <div>
                      <span className="text-muted-foreground">Shoot Notes:</span>
                      <p className="mt-0.5">{record.notes?.shoot || 'No notes'}</p>
                    </div>
                  )}
                  {!isEditor && record.notes?.photographer && (
                    <div>
                      <span className="text-muted-foreground">Photographer Notes:</span>
                      <p className="mt-0.5">{record.notes.photographer}</p>
                    </div>
                  )}
                  {!isEditor && record.notes?.company && (
                    <div>
                      <span className="text-muted-foreground">Company Notes:</span>
                      <p className="mt-0.5">{record.notes.company}</p>
                    </div>
                  )}
                  {record.notes?.approval && (
                    <div>
                      <span className="text-muted-foreground">Approval Notes:</span>
                      <p className="mt-0.5">{record.notes.approval}</p>
                    </div>
                  )}
                  {(record.notes as any)?.editing && (
                    <div>
                      <span className="text-muted-foreground">Editing Notes:</span>
                      <p className="mt-0.5">{(record.notes as any).editing}</p>
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

            <div className="space-y-4">
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

export const HistoryAggregateCard = memo(({ aggregate, isSuperAdmin = false }: { aggregate: ShootHistoryServiceAggregate; isSuperAdmin?: boolean }) => (
  <Card>
    <CardContent className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Service</p>
          <h3 className="text-lg font-semibold">{aggregate.serviceName}</h3>
        </div>
        <Badge variant="secondary">{aggregate.shootCount} shoots</Badge>
      </div>
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
