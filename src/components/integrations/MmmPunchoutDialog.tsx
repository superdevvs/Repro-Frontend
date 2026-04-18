import { useMemo } from 'react'
import { AlertCircle, ExternalLink, Loader2, X } from 'lucide-react'
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

  const handleOpenExternally = () => {
    if (!safeRedirectUrl) return
    window.open(safeRedirectUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-border/70 bg-background p-0 shadow-2xl sm:w-[calc(100vw-3rem)] sm:max-w-[calc(100vw-3rem)] [&>button]:hidden">
        <DialogHeader className="shrink-0 border-b px-5 py-4 text-left sm:px-6">
          <div className="flex items-center gap-3">
            <DialogTitle className="min-w-0 flex-1 text-lg font-semibold tracking-tight">
              MMM Print Materials
            </DialogTitle>
            {canOpenExternally && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg px-3.5"
                onClick={handleOpenExternally}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open externally
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

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3 sm:px-5">
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
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-2.5">
                <p className="text-sm text-muted-foreground">
                  Stay in this popup to finish login and print ordering. If MMM stalls in the embedded view, use the external button above.
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
                <iframe
                  key={safeRedirectUrl}
                  title="MMM Print Materials"
                  src={safeRedirectUrl}
                  className="h-full min-h-0 w-full bg-background"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
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
