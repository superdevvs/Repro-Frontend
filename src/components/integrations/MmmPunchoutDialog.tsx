import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  mmmService,
  type MmmPunchoutOrderLineItem,
  type MmmPunchoutSessionItem,
  type MmmSessionsSummary,
} from '@/services/mmmService'

interface MmmPunchoutDialogProps {
  open: boolean
  isLaunching: boolean
  redirectUrl: string | null
  errorMessage: string | null
  shootId?: number | string | null
  onStartSession?: () => void | Promise<void>
  onOpenChange: (open: boolean) => void
}

const normalizeMmmUrl = (value: string | null | undefined) => {
  const candidate = String(value ?? '').trim()
  return /^https?:\/\//i.test(candidate) ? candidate : null
}

const formatRelative = (iso: string | null | undefined): string | null => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  try {
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return null
  }
}

const formatMoney = (value: number | null | undefined, currency?: string | null): string => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n)
    } catch {
      /* fallthrough */
    }
  }
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const statusPillStyles = (status: string | null | undefined): string => {
  const s = (status ?? '').toLowerCase()
  if (s === 'returned' || s === 'order_returned') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
  }
  if (s === 'redirect_ready' || s === 'punchout_ready') {
    return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800'
  }
  if (s === 'error') {
    return 'bg-destructive/10 text-destructive border-destructive/30'
  }
  return 'bg-muted text-muted-foreground border-border'
}

const humanizeStatus = (status: string | null | undefined): string => {
  if (!status) return 'Unknown'
  return status
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const shortCookie = (cookie: string | null | undefined): string | null => {
  if (!cookie) return null
  return cookie.length <= 10 ? cookie : `${cookie.slice(0, 8)}…`
}

const sessionOpenerLabel = (session: MmmPunchoutSessionItem): string => {
  const name = [session.first_name, session.last_name].filter(Boolean).join(' ').trim()
  if (name) return name
  if (session.username) return session.username
  if (session.employee_email) return session.employee_email
  return '—'
}

export function MmmPunchoutDialog({
  open,
  isLaunching,
  redirectUrl,
  errorMessage,
  shootId,
  onStartSession,
  onOpenChange,
}: MmmPunchoutDialogProps) {
  const safeRedirectUrl = useMemo(() => normalizeMmmUrl(redirectUrl), [redirectUrl])
  const [autoOpenStatus, setAutoOpenStatus] = useState<'idle' | 'opened' | 'blocked'>('idle')
  const openedUrlRef = useRef<string | null>(null)

  const [sessions, setSessions] = useState<MmmPunchoutSessionItem[]>([])
  const [summary, setSummary] = useState<MmmSessionsSummary | null>(null)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null)
  const prevLaunchingRef = useRef(isLaunching)

  const handleOpenExternally = useCallback(
    (url?: string | null) => {
      const target = url ?? safeRedirectUrl
      if (!target) return false
      const popup = window.open(target, '_blank', 'noopener,noreferrer')
      if (popup) {
        setAutoOpenStatus('opened')
        openedUrlRef.current = target
        return true
      }
      setAutoOpenStatus('blocked')
      return false
    },
    [safeRedirectUrl],
  )

  // Auto-open MMM in a real new tab once per redirect URL. Iframe embedding
  // fails because MMM's session cookie is treated as third-party and blocked,
  // which produces an unexpected login prompt even when the punchout token
  // already authenticated the user.
  useEffect(() => {
    if (!open) {
      openedUrlRef.current = null
      setAutoOpenStatus('idle')
      setExpandedSessionId(null)
      return
    }
    if (!safeRedirectUrl || isLaunching || errorMessage) return
    if (openedUrlRef.current === safeRedirectUrl) return
    handleOpenExternally(safeRedirectUrl)
  }, [open, safeRedirectUrl, isLaunching, errorMessage, handleOpenExternally])

  const loadSessions = useCallback(async () => {
    if (!shootId) return
    setIsLoadingSessions(true)
    setSessionsError(null)
    try {
      const data = await mmmService.listSessions(shootId)
      setSessions(Array.isArray(data.sessions) ? data.sessions : [])
      setSummary(data.summary ?? null)
    } catch (error) {
      setSessionsError(
        error instanceof Error ? error.message : 'Failed to load recent print sessions.',
      )
    } finally {
      setIsLoadingSessions(false)
    }
  }, [shootId])

  // Load on open and whenever isLaunching flips from true to false (fresh session just created).
  useEffect(() => {
    if (!open || !shootId) return
    void loadSessions()
  }, [open, shootId, loadSessions])

  useEffect(() => {
    const wasLaunching = prevLaunchingRef.current
    prevLaunchingRef.current = isLaunching
    if (open && shootId && wasLaunching && !isLaunching) {
      void loadSessions()
    }
  }, [open, shootId, isLaunching, loadSessions])

  const lastSessionWithUrl = useMemo(() => {
    return sessions.find((s) => normalizeMmmUrl(s.redirect_url)) ?? null
  }, [sessions])

  const activeRedirectUrl =
    safeRedirectUrl ??
    normalizeMmmUrl(summary?.mmm_redirect_url ?? null) ??
    normalizeMmmUrl(lastSessionWithUrl?.redirect_url ?? null)

  const canReopen = Boolean(activeRedirectUrl) && !isLaunching

  const headerMessage = isLaunching
    ? 'Preparing your print session now.'
    : errorMessage
      ? 'MMM could not be opened yet. Review the message below.'
      : autoOpenStatus === 'blocked'
        ? 'Your browser blocked the new tab — use the button on the right.'
        : activeRedirectUrl
          ? 'MMM opened in a new tab. Complete your print order there.'
          : 'Start a new print session to send this shoot to MMM.'

  const summaryStatus = summary?.mmm_status ?? null
  const headerError = errorMessage ?? summary?.mmm_last_error ?? null

  const handleStart = async () => {
    if (!onStartSession || isLaunching) return
    await onStartSession()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-[calc(100vw-0.75rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border border-border/70 bg-background p-0 shadow-2xl sm:w-[calc(100vw-2rem)] [&>button]:hidden">
        <DialogHeader className="shrink-0 border-b px-4 py-3 text-left sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">
                MMM Print Materials
              </DialogTitle>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:truncate sm:text-sm">
                {headerMessage}
              </p>
            </div>
            {canReopen && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 rounded-lg px-2.5 sm:px-3.5"
                onClick={() => handleOpenExternally(activeRedirectUrl)}
                aria-label="Open in new tab"
              >
                <ExternalLink className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Open in new tab</span>
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full border border-border/70 text-muted-foreground hover:bg-muted"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close MMM print materials</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
          {/* Summary card */}
          <section className="rounded-xl border bg-card p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    statusPillStyles(summaryStatus),
                  )}
                >
                  {humanizeStatus(summaryStatus)}
                </span>
                {summary?.mmm_order_number && (
                  <span className="truncate text-xs text-muted-foreground">
                    Order <span className="font-medium text-foreground">{summary.mmm_order_number}</span>
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 rounded-md px-2 text-xs"
                onClick={() => void loadSessions()}
                disabled={isLoadingSessions || !shootId}
                aria-label="Refresh"
              >
                <RefreshCw className={cn('h-3.5 w-3.5 sm:mr-1.5', isLoadingSessions && 'animate-spin')} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>

            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 sm:gap-3">
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">Last punchout</dt>
                <dd className="mt-0.5 font-medium">
                  {formatRelative(summary?.mmm_last_punchout_at) ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">Last order returned</dt>
                <dd className="mt-0.5 font-medium">
                  {formatRelative(summary?.mmm_last_order_at) ?? '—'}
                </dd>
              </div>
            </dl>

            {headerError && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="break-words">{headerError}</span>
              </div>
            )}

            <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                onClick={() => void handleStart()}
                disabled={!onStartSession || isLaunching}
                className="h-9 w-full sm:w-auto"
              >
                {isLaunching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing…
                  </>
                ) : (
                  <>
                    <Printer className="mr-2 h-4 w-4" />
                    Start new print session
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenExternally(activeRedirectUrl)}
                disabled={!canReopen}
                className="h-9 w-full sm:w-auto"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Reopen last session
              </Button>
            </div>

            {autoOpenStatus === 'blocked' && activeRedirectUrl && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Browser blocked the auto-opened tab. Allow popups for this site or use the button above.
              </p>
            )}
          </section>

          {/* Recent orders */}
          <section className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2 sm:px-4 sm:py-2.5">
              <h3 className="text-sm font-semibold">Recent orders</h3>
              {sessions.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
                </span>
              )}
            </div>

            {isLoadingSessions && sessions.length === 0 ? (
              <div className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading sessions…
              </div>
            ) : sessionsError ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <p className="text-sm font-medium">Couldn’t load history</p>
                <p className="max-w-sm text-xs text-muted-foreground">{sessionsError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 h-8"
                  onClick={() => void loadSessions()}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Try again
                </Button>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                No print orders yet. Start one to see history here.
              </div>
            ) : (
              <ul className="divide-y">
                {sessions.map((session) => {
                  const sessionUrl = normalizeMmmUrl(session.redirect_url)
                  const items = session.order?.items ?? []
                  const canExpand = items.length > 0
                  const isExpanded = expandedSessionId === session.id

                  return (
                    <li key={session.id} className="px-3 py-3 sm:px-4">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3">
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                            statusPillStyles(session.status),
                          )}
                        >
                          {humanizeStatus(session.status)}
                        </span>

                        <span className="min-w-0 max-w-full truncate text-sm font-medium">
                          {session.order_number ?? '—'}
                        </span>

                        {session.deployment_mode && (
                          <span className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {session.deployment_mode}
                          </span>
                        )}
                        {shortCookie(session.buyer_cookie) && (
                          <span
                            className="shrink-0 font-mono text-[11px] text-muted-foreground"
                            title={session.buyer_cookie ?? undefined}
                          >
                            {shortCookie(session.buyer_cookie)}
                          </span>
                        )}

                        <div className="ml-auto flex shrink-0 items-center gap-1.5">
                          {sessionUrl && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 rounded-md px-2 text-xs sm:px-2.5"
                              onClick={() => handleOpenExternally(sessionUrl)}
                              aria-label="Reopen in new tab"
                            >
                              <ExternalLink className="h-3.5 w-3.5 sm:mr-1" />
                              <span className="hidden sm:inline">Reopen</span>
                            </Button>
                          )}
                          {canExpand && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-md px-2 text-xs text-muted-foreground"
                              onClick={() =>
                                setExpandedSessionId(isExpanded ? null : session.id)
                              }
                              aria-label={isExpanded ? 'Hide items' : `Show ${items.length} items`}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-3.5 w-3.5 sm:mr-1" />
                                  <span className="hidden sm:inline">Hide items</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3.5 w-3.5 sm:mr-1" />
                                  <span className="hidden sm:inline">
                                    {items.length} {items.length === 1 ? 'item' : 'items'}
                                  </span>
                                  <span className="sm:hidden">{items.length}</span>
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground sm:text-xs">
                        <span className="truncate">Opened by {sessionOpenerLabel(session)}</span>
                        {formatRelative(session.redirected_at ?? session.created_at) && (
                          <span>
                            Started {formatRelative(session.redirected_at ?? session.created_at)}
                          </span>
                        )}
                        {formatRelative(session.returned_at) && (
                          <span>Returned {formatRelative(session.returned_at)}</span>
                        )}
                      </div>

                      {session.last_error && (
                        <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
                          {session.last_error}
                        </div>
                      )}

                      {isExpanded && canExpand && (
                        <LineItemsTable items={items} order={session.order} />
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface LineItemsTableProps {
  items: MmmPunchoutOrderLineItem[]
  order: MmmPunchoutSessionItem['order']
}

function LineItemsTable({ items, order }: LineItemsTableProps) {
  const currency = order?.currency ?? items.find((i) => i.currency)?.currency ?? null
  const total = order?.total ?? null
  const subtotal = order?.subtotal ?? null
  const tax = order?.tax ?? null
  const shipping = order?.shipping ?? null

  return (
    <div className="mt-3 overflow-hidden rounded-lg border">
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
            <tr>
              <th className="hidden px-2.5 py-1.5 text-left font-medium sm:table-cell">#</th>
              <th className="px-2 py-1.5 text-left font-medium sm:px-2.5">Description</th>
              <th className="px-2 py-1.5 text-right font-medium sm:px-2.5">Qty</th>
              <th className="hidden px-2.5 py-1.5 text-right font-medium sm:table-cell">Unit</th>
              <th className="px-2 py-1.5 text-right font-medium sm:px-2.5">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={`${item.line_number ?? idx}-${item.supplier_part_id ?? ''}`} className="border-t">
                <td className="hidden px-2.5 py-1.5 text-muted-foreground sm:table-cell">{item.line_number ?? idx + 1}</td>
                <td className="px-2 py-1.5 sm:px-2.5">
                  <div className="font-medium">{item.description ?? item.supplier_part_id ?? '—'}</div>
                  {item.supplier_part_id && item.description && (
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {item.supplier_part_id}
                    </div>
                  )}
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground sm:hidden">
                    {formatMoney(item.unit_price, item.currency ?? currency)} / unit
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums sm:px-2.5">
                  {item.quantity ?? '—'}
                  {item.unit_of_measure ? ` ${item.unit_of_measure}` : ''}
                </td>
                <td className="hidden px-2.5 py-1.5 text-right tabular-nums sm:table-cell">
                  {formatMoney(item.unit_price, item.currency ?? currency)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium sm:px-2.5">
                  {formatMoney(item.extended_price, item.currency ?? currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(subtotal !== null || tax !== null || shipping !== null || total !== null) && (
        <div className="flex flex-col gap-0.5 border-t bg-muted/30 px-3 py-2 text-xs">
          {subtotal !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatMoney(subtotal, currency)}</span>
            </div>
          )}
          {tax !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="tabular-nums">{formatMoney(tax, currency)}</span>
            </div>
          )}
          {shipping !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="tabular-nums">{formatMoney(shipping, currency)}</span>
            </div>
          )}
          {total !== null && (
            <div className="mt-0.5 flex justify-between border-t pt-1 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(total, currency)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
