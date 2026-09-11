const SELECTED_PIN_COLOR = '#d74432'
const LIGHT_PIN_COLOR = '#1f5aa6'
const DARK_PIN_COLOR = '#3b82f6'

export const createPinIcon = (
  label: string,
  count: number,
  selected: boolean,
  showLabel: boolean,
  theme: 'light' | 'dark',
): string => {
  const color = selected
    ? SELECTED_PIN_COLOR
    : theme === 'dark'
      ? DARK_PIN_COLOR
      : LIGHT_PIN_COLOR
  const pinSize = selected ? 46 : 36
  const width = showLabel ? 168 : 64
  const height = showLabel ? 78 : 58
  const pinTop = showLabel ? 28 : 4
  const pinLeft = (width - pinSize) / 2
  const scale = pinSize / 24
  const chipWidth = Math.min(152, Math.max(58, label.length * 7 + 20))
  const chipLeft = (width - chipWidth) / 2
  const countMarkup = count > 1
    ? `<circle cx="${pinLeft + pinSize - 3}" cy="${pinTop + 5}" r="10" fill="#2563eb" stroke="#fff" stroke-width="2"/><text x="${pinLeft + pinSize - 3}" y="${pinTop + 8.5}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="10" font-weight="700" fill="#fff">${count}</text>`
    : ''
  const labelMarkup = showLabel
    ? `<rect x="${chipLeft}" y="1" width="${chipWidth}" height="23" rx="11.5" fill="${color}"/><text x="${width / 2}" y="16.5" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="11" font-weight="700" fill="#fff">${label}</text>`
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${labelMarkup}<g transform="translate(${pinLeft} ${pinTop}) scale(${scale})" style="filter:drop-shadow(0 6px 8px rgba(15,23,42,.36))"><path fill="${color}" stroke="#fff" stroke-width="1.5" d="M12 1.5c-4.14 0-7.5 3.36-7.5 7.5 0 5.34 6.43 12.31 6.71 12.6a1.08 1.08 0 0 0 1.58 0c.28-.29 6.71-7.26 6.71-12.6 0-4.14-3.36-7.5-7.5-7.5Z"/><circle cx="12" cy="9" r="3" fill="#fff"/></g>${countMarkup}</svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}
