import { useMemo } from 'react'
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-7xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-base">MMM Print Materials</DialogTitle>
          <DialogDescription>
            {isLaunching
              ? 'Preparing your print session now.'
              : errorMessage
                ? 'MMM could not be opened yet. Review the message below.'
                : 'Complete the MMM login and print flow here.'}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4">
          {isLaunching ? (
            <div className="flex h-[40vh] flex-col items-center justify-center gap-3 rounded-xl border bg-muted/20 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="space-y-1">
                <p className="font-medium">Preparing print materials...</p>
                <p className="text-sm text-muted-foreground">
                  Your MMM session is being created. This popup will load automatically.
                </p>
              </div>
            </div>
          ) : errorMessage ? (
            <div className="flex h-[40vh] flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 px-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div className="space-y-1">
                <p className="font-medium">Unable to open print materials</p>
                <p className="max-w-xl text-sm text-muted-foreground">{errorMessage}</p>
              </div>
              {safeRedirectUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(safeRedirectUrl, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open existing MMM session
                </Button>
              )}
            </div>
          ) : safeRedirectUrl ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Stay in this popup to finish login and print ordering. If MMM blocks embedding, open it externally.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(safeRedirectUrl, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open externally
                </Button>
              </div>

              <div className="overflow-hidden rounded-xl border bg-background">
                <iframe
                  key={safeRedirectUrl}
                  title="MMM Print Materials"
                  src={safeRedirectUrl}
                  className="h-[78vh] w-full bg-background"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          ) : (
            <div className="flex h-[30vh] items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
              MMM is ready when you are.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
