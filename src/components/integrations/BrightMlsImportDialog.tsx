import { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface BrightMlsImportDialogProps {
  redirectUrl: string | null
  onRedirectUrlChange: (value: string | null) => void
}

const normalizeBrightMlsUrl = (value: string | null) => {
  const candidate = String(value ?? '').trim()
  return /^https?:\/\//i.test(candidate) ? candidate : null
}

export function BrightMlsImportDialog({
  redirectUrl,
  onRedirectUrlChange,
}: BrightMlsImportDialogProps) {
  const safeRedirectUrl = useMemo(() => normalizeBrightMlsUrl(redirectUrl), [redirectUrl])

  return (
    <Dialog
      open={!!safeRedirectUrl}
      onOpenChange={(open) => {
        if (!open) {
          onRedirectUrlChange(null)
        }
      }}
    >
      <DialogContent className="w-[96vw] max-w-7xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-base">Bright MLS Import</DialogTitle>
          <DialogDescription>
            Complete the Bright MLS login and import flow here.
          </DialogDescription>
        </DialogHeader>

        {safeRedirectUrl && (
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-2">
              <p className="text-sm text-muted-foreground">
                Stay in this popup to finish login and import. If Bright blocks embedding, open it externally.
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
                title="Bright MLS Import"
                src={safeRedirectUrl}
                className="h-[78vh] w-full bg-background"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
