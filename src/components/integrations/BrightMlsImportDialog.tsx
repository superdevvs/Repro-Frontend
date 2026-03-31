import { useEffect, useMemo } from 'react'
import { navigateBrightMlsWindow } from '@/utils/brightMls'

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

  useEffect(() => {
    if (!safeRedirectUrl) {
      return
    }

    navigateBrightMlsWindow(null, safeRedirectUrl)
    onRedirectUrlChange(null)
  }, [safeRedirectUrl, onRedirectUrlChange])

  return null
}
