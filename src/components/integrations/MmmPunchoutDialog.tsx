import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface MmmPunchoutDialogProps {
  open: boolean
  isLaunching: boolean
  redirectUrl: string | null
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
}

const normalizeMmmUrl = (value: string | null) => {
  const candidate = String(value ?? '').trim()
  return /^https?:\/\//i.test(candidate) ? candidate : null
}

export function MmmPunchoutDialog({
  open,
  isLaunching,
  redirectUrl,
  errorMessage,
  onOpenChange,
}: MmmPunchoutDialogProps) {
  const safeRedirectUrl = useMemo(() => normalizeMmmUrl(redirectUrl), [redirectUrl])
  const canOpenExternally = Boolean(safeRedirectUrl) && !isLaunching
  const [autoOpenStatus, setAutoOpenStatus] = useState<'idle' | 'opened' | 'blocked'>('idle')
  const openedUrlRef = useRef<string | null>(null)

  const handleOpenExternally = (url?: string | null) => {
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
  }

  // Auto-open MMM in a real new tab once per redirect URL.
  // Embedding in an iframe breaks MMM because its session cookie is treated as
  // third-party and blocked, which causes an unexpected login prompt even when
  // the punchout token already authenticated the user.
  useEffect(() => {
    if (!open) {
      openedUrlRef.current = null
      setAutoOpenStatus('idle')
      return
    }
    if (!safeRedirectUrl || isLaunching || errorMessage) return
    if (openedUrlRef.current === safeRedirectUrl) return
    handleOpenExternally(safeRedirectUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, safeRedirectUrl, isLaunching, errorMessage])

  const headerMessage = isLaunching
    ? 'Preparing your print session now.'
    : errorMessage
      ? 'MMM could not be opened yet. Review the message below.'
      : safeRedirectUrl
        ? autoOpenStatus === 'blocked'
          ? 'Your browser blocked the new tab. Use the button on the right to open MMM.'
          : 'MMM opened in a new tab. Complete your print order there.'
        : 'MMM is ready when you are.'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[95vh] w-[calc(100vw-1.25rem)] max-w-[calc(100vw-1.25rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-border/70 bg-background p-0 shadow-2xl sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] [&>button]:hidden">
        <DialogHeader className="shrink-0 border-b px-5 py-3 text-left sm:px-6">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold tracking-tight">
                MMM Print Materials
              </DialogTitle>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {headerMessage}
              </p>
            </div>
            {canOpenExternally && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg px-3.5"
                onClick={() => handleOpenExternally()}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in new tab
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

        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2 sm:px-4">
          {isLaunching ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl border bg-muted/20 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="space-y-1">
                <p className="font-medium">Preparing print materials...</p>
                <p className="text-sm text-muted-foreground">
                  Your MMM session is being created. This popup will load automatically.
                </p>
              </div>
            </div>
          ) : errorMessage ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 px-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div className="space-y-1">
                <p className="font-medium">Unable to open print materials</p>
                <p className="max-w-xl text-sm text-muted-foreground">{errorMessage}</p>
              </div>
            </div>
          ) : safeRedirectUrl ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border bg-muted/20 px-6 py-10 text-center">
              {autoOpenStatus === 'blocked' ? (
                <>
                  <AlertCircle className="h-8 w-8 text-amber-500" />
                  <div className="space-y-1">
                    <p className="font-medium">Your browser blocked the new tab</p>
                    <p className="max-w-xl text-sm text-muted-foreground">
                      Allow popups for this site, or click the button below to open MMM in a new tab.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleOpenExternally()}
                    className="h-9 rounded-lg px-4"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in new tab
                  </Button>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <div className="space-y-1">
                    <p className="font-medium">MMM opened in a new tab</p>
                    <p className="max-w-xl text-sm text-muted-foreground">
                      Complete your print order in that tab. You can close this popup, or reopen the
                      session at any time.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenExternally()}
                    className="h-9 rounded-lg px-4"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Reopen in new tab
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
              MMM is ready when you are.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
