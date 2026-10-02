/**
 * Map styles aligned with Exclusive Listing (`PrivateListingGoogleMap`) dark theme,
 * plus user-requested highway shield / road icon label suppression.
 */

const HIDE_BUSINESS_POIS = {
  featureType: 'poi.business',
  stylers: [{ visibility: 'off' }],
} as const

/** Hide highway shields (e.g. I-80), arterial icons, transit, and POI icons. */
export const HIDE_ROAD_ICON_LABELS: ReadonlyArray<Record<string, unknown>> = [
  { featureType: 'road.highway', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
]

/** Same base as Exclusive Listing dark map geometry. */
export const PHOTOGRAPHER_DARK_MAP_STYLES: ReadonlyArray<Record<string, unknown>> = [
  HIDE_BUSINESS_POIS,
  { elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#263244' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111827' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#13281f' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#071827' }] },
  ...HIDE_ROAD_ICON_LABELS,
]

export const PHOTOGRAPHER_LIGHT_MAP_STYLES: ReadonlyArray<Record<string, unknown>> = [
  HIDE_BUSINESS_POIS,
  ...HIDE_ROAD_ICON_LABELS,
]

export const photographerMapOptions = (theme: 'light' | 'dark') => ({
  cameraControl: false,
  clickableIcons: false,
  fullscreenControl: false,
  gestureHandling: 'greedy' as const,
  mapTypeControl: false,
  rotateControl: false,
  scaleControl: false,
  streetViewControl: false,
  styles: theme === 'dark' ? PHOTOGRAPHER_DARK_MAP_STYLES : PHOTOGRAPHER_LIGHT_MAP_STYLES,
  zoomControl: false,
})
