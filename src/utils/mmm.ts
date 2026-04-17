const MMM_POPUP_NAME = 'mmm-punchout'
const MMM_POPUP_FEATURES = [
  'popup=yes',
  'width=1280',
  'height=900',
  'left=120',
  'top=80',
  'resizable=yes',
  'scrollbars=yes',
  'toolbar=no',
  'menubar=no',
  'location=yes',
  'status=no',
].join(',')

const normalizeString = (value: unknown): string => String(value ?? '').trim()
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const openMmmPopup = (url: string): Window | null => {
  if (typeof window === 'undefined') {
    return null
  }

  return window.open(url, MMM_POPUP_NAME, MMM_POPUP_FEATURES)
}

const writePopupState = (popup: Window | null, title: string, body: string) => {
  try {
    if (!popup || popup.closed) {
      return
    }

    popup.document.title = title
    popup.document.body.innerHTML = body
  } catch {
    // Ignore popup document access issues.
  }
}

export const openPendingMmmWindow = (): Window | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const popup = openMmmPopup('about:blank')
  if (!popup) {
    return null
  }

  writePopupState(
    popup,
    'MMM Print Materials',
    '<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;padding:24px;line-height:1.5;color:#0f172a"><h2 style="margin:0 0 12px">Preparing print materials...</h2><p style="margin:0;color:#475569">Your print session is being prepared. This window will redirect to MyMarketingMatters automatically.</p></div>',
  )

  return popup
}

export const navigateMmmWindow = (
  popup: Window | null,
  redirectUrl: string | null | undefined,
): boolean => {
  const targetUrl = normalizeString(redirectUrl)
  if (!/^https?:\/\//i.test(targetUrl)) {
    return false
  }

  try {
    if (popup && !popup.closed) {
      popup.location.href = targetUrl
      return true
    }
  } catch {
    // Ignore popup navigation issues and fall back to opening a fresh window.
  }

  if (typeof window === 'undefined') {
    return false
  }

  return Boolean(openMmmPopup(targetUrl))
}

export const showMmmWindowError = (popup: Window | null, message: string) => {
  writePopupState(
    popup,
    'MMM Print Materials',
    `<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;line-height:1.5;color:#0f172a"><h2 style="margin:0 0 12px">Unable to open print materials</h2><p style="margin:0;color:#475569">${escapeHtml(normalizeString(message) || 'Please close this window and try again.')}</p></div>`,
  )
}

export const closePendingMmmWindow = (popup: Window | null) => {
  try {
    if (popup && !popup.closed) {
      popup.close()
    }
  } catch {
    // Ignore popup close issues.
  }
}
