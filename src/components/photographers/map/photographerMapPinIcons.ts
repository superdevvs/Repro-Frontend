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

/** Teardrop pin with a house glyph — property / job location. */
export function jobHomePinIcon(selected = true): string {
  const size = selected ? 36 : 30
  const height = selected ? 46 : 40
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}" viewBox="0 0 32 42">
<path fill="${PIN_COLORS.job}" stroke="#fff" stroke-width="2" d="M16 1C7.7 1 1 7.7 1 16c0 11 15 25 15 25s15-14 15-25C31 7.7 24.3 1 16 1Z"/>
<path fill="#fff" d="M16 10.2 9.5 15.2v8.3h4.1v-4.2h4.8v4.2h4.1v-8.3L16 10.2zm0 2.2 5.2 4v5.1h-1.7v-4.2h-7v4.2h-1.7v-5.1l5.2-4z"/>
</svg>`
  return encodeSvg(svg)
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
  const size = args.size ?? 40
  const border = args.selected ? '#2563eb' : '#ffffff'
  const ring = args.selected ? 'box-shadow:0 0 0 3px rgba(37,99,235,.45),0 3px 10px rgba(15,23,42,.4);' : 'box-shadow:0 3px 10px rgba(15,23,42,.35);'
  const img = args.avatarUrl
    ? `<img src="${escapeAttr(args.avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='grid')" />
<span style="display:none;place-items:center;width:100%;height:100%;font:700 12px/1 Inter,system-ui,sans-serif;color:#e2e8f0;background:linear-gradient(145deg,#475569,#1e293b);border-radius:50%">${escapeHtml(args.initials)}</span>`
    : `<span style="display:grid;place-items:center;width:100%;height:100%;font:700 12px/1 Inter,system-ui,sans-serif;color:#e2e8f0;background:linear-gradient(145deg,#475569,#1e293b);border-radius:50%">${escapeHtml(args.initials)}</span>`
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;border:2.5px solid ${border};overflow:hidden;cursor:pointer;background:#1e293b;${ring}">${img}</div>`
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
