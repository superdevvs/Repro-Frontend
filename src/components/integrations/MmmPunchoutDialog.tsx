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
  const headerMessage = isLaunching
    ? 'Preparing your print session now.'
    : errorMessage
      ? 'MMM could not be opened yet. Review the message below.'
      : 'Stay in this popup to finish login and print ordering. If MMM stalls, use the external button.'

  const handleOpenExternally = () => {
    if (!safeRedirectUrl) return
    window.open(safeRedirectUrl, '_blank', 'noopener,noreferrer')
  }

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
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 items-start justify-center overflow-hidden rounded-xl border border-border/70 bg-[#0f1723] shadow-sm">
                <iframe
                  key={safeRedirectUrl}
                  title="MMM Print Materials"
                  src={safeRedirectUrl}
                  className="shrink-0 border-0 bg-background"
                  style={{
                    width: '90%',
                    height: '92%',
                    transform: 'scale(1.1)',
                    transformOrigin: 'top center',
                  }}
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
