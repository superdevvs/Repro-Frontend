/** SVG data-URL icons for photographer picker map pins. */

const encodeSvg = (svg: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

export const PIN_COLORS = {
  photographer: '#3b82f6',
  last: '#94a3b8',
  job: '#22c55e',
  next: '#a855f7',
  homeDot: '#3b82f6',
} as const

/** Default overview avatar diameter (px). Selected is slightly larger. */
export const PROFILE_PIN_SIZE = 56
export const PROFILE_PIN_SIZE_SELECTED = 64

/** Isometric property marker: roof, shaded walls and a precise ground anchor. */
export function jobHomePinIcon(selected = true): string {
  const size = selected ? 56 : 46
  return encodeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
<defs><linearGradient id="roof" x2="0.8" y2="1"><stop stop-color="#67e8f9"/><stop offset="1" stop-color="#0284c7"/></linearGradient><linearGradient id="wall" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#dbeafe"/></linearGradient></defs>
<ellipse cx="32" cy="53" rx="24" ry="7" fill="#0f172a" opacity=".22"/>
<path d="M8 46 30 35 56 48 34 60Z" fill="#059669" stroke="#d1fae5" stroke-width="1.5"/>
<path d="M13 28 33 18 51 28 51 44 32 54 13 44Z" fill="url(#wall)" stroke="#f8fafc" stroke-width="1.2"/>
<path d="M32 34 51 25 51 44 32 54Z" fill="#93c5fd"/>
<path d="M9 29 26 8 46 18 32 40Z" fill="url(#roof)" stroke="#e0f2fe" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M26 8 46 18 56 31 51 34 42 24 32 40Z" fill="#075985" stroke="#bae6fd" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M18 36 25 39 25 50 18 46Z" fill="#334155"/>
<path d="M36 38 42 35 42 41 36 44Z M45 34 49 32 49 38 45 40Z" fill="#fef3c7" stroke="#eff6ff" stroke-width="1"/>
<path d="M33 58 32 62 31 58" fill="#fff"/>
</svg>`)
}

/** Classic teardrop for last / next / photographer-home (selected route). */
export function routePinIcon(kind: 'photographer' | 'last' | 'next', selected = false): string {
  const fill = PIN_COLORS[kind]
  const size = selected ? 36 : 30
  const height = selected ? 46 : 40
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}" viewBox="0 0 32 42">
<path fill="${fill}" stroke="#fff" stroke-width="2" d="M16 1C7.7 1 1 7.7 1 16c0 11 15 25 15 25s15-14 15-25C31 7.7 24.3 1 16 1Z"/>
<circle cx="16" cy="16" r="5.5" fill="#fff"/>
</svg>`
  return encodeSvg(svg)
}

/** Circular avatar / initials pin used in overview mode (and Leaflet). */
export function profilePinHtml(args: {
  avatarUrl?: string | null
  initials: string
  selected?: boolean
  size?: number
}): string {
  const size = args.size ?? PROFILE_PIN_SIZE
  const border = args.selected ? '#2563eb' : '#ffffff'
  const outer = args.selected ? '#1d4ed8' : '#0f172a'
  const fontPx = Math.max(14, Math.round(size * 0.32))
  const ring = args.selected
    ? 'box-shadow:0 0 0 3px rgba(37,99,235,.55),0 4px 14px rgba(15,23,42,.55);'
    : 'box-shadow:0 4px 14px rgba(15,23,42,.5);'
  const img = args.avatarUrl
    ? `<img src="${escapeAttr(args.avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;opacity:1" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='grid')" />
<span style="display:none;place-items:center;width:100%;height:100%;font:700 ${fontPx}px/1 Inter,system-ui,sans-serif;color:#f8fafc;background:linear-gradient(145deg,#64748b,#1e293b);border-radius:50%;opacity:1">${escapeHtml(args.initials)}</span>`
    : `<span style="display:grid;place-items:center;width:100%;height:100%;font:700 ${fontPx}px/1 Inter,system-ui,sans-serif;color:#f8fafc;background:linear-gradient(145deg,#64748b,#1e293b);border-radius:50%;opacity:1">${escapeHtml(args.initials)}</span>`
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;border:3.5px solid ${border};outline:2.5px solid ${outer};overflow:hidden;cursor:pointer;background:#1e293b;opacity:1;${ring}">${img}</div>`
}

export function photographerInitials(name?: string | null): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;')
}
