import { API_BASE_URL } from '@/config/env'
import type { ShootData, ShootFileData } from '@/types/shoots'
import { getImageUrl, normalizeImageUrl } from '@/utils/imageUrl'
import { getPreferredIguideUrl, getRawTourLinks, normalizeIguideFloorplans } from '@/utils/shootTourData'

type LooseRecord = Record<string, unknown>

type BrightMlsPhotoPayload = {
  id?: string | number
  url: string
  filename: string
  description: string
  roomType: string
  selected: boolean
  sortOrder: number
}

type BrightMlsDocumentPayload = {
  url: string
  filename: string
  type: 'floor_plan'
  visibility: 'private'
  description: string
}

export type BrightMlsPublishPayload = {
  photos: BrightMlsPhotoPayload[]
  iguide_tour_url: string | null
  slideshow_url: string | null
  matterport_url: string | null
  cubicasa_url: string | null
  additional_tour_urls: Record<string, string>
  documents: BrightMlsDocumentPayload[]
}

type BrightMlsBuildOptions = {
  selectedPhotoIds?: Iterable<string | number> | null
}

const asRecord = (value: unknown): LooseRecord =>
  value && typeof value === 'object' ? (value as LooseRecord) : {}

const normalizeString = (value: unknown): string => String(value ?? '').trim()

const firstUrl = (...values: unknown[]): string | null => {
  for (const value of values) {
    const candidate = normalizeImageUrl(normalizeString(value))
    if (candidate) {
      return candidate
    }
  }

  return null
}

const getFileUrl = (file: Partial<ShootFileData> & LooseRecord): string =>
  firstUrl(
    getImageUrl(file, 'large'),
    getImageUrl(file, 'medium'),
    file.web_url,
    file.web_path,
    file.large_url,
    file.large,
    file.medium_url,
    file.medium,
    file.url,
    file.storage_path,
    file.path,
    file.original_url,
    file.original,
    getImageUrl(file, 'original'),
  ) || ''

const getLatestCommentText = (file: Partial<ShootFileData> & LooseRecord): string => {
  const latestComment = normalizeString(asRecord(file.latest_comment).comment)
  if (latestComment) {
    return latestComment
  }

  if (Array.isArray(file.comments)) {
    for (let index = file.comments.length - 1; index >= 0; index -= 1) {
      const comment = normalizeString(asRecord(file.comments[index]).comment)
      if (comment) {
        return comment
      }
    }
  }

  const metadataComments = asRecord(file.metadata).comments
  if (Array.isArray(metadataComments)) {
    for (let index = metadataComments.length - 1; index >= 0; index -= 1) {
      const comment = normalizeString(asRecord(metadataComments[index]).comment)
      if (comment) {
        return comment
      }
    }
  }

  return ''
}

const RAW_FILENAME_PATTERN = /\.(arw|cr2|cr3|dng|heic|heif|nef|nrw|orf|pef|raf|raw|rw2|sr2)$/i
const EDITED_FILENAME_PATTERN = /\.(jpg|jpeg|png|gif|webp)$/i
const EDITED_WORKFLOW_STAGES = new Set(['completed', 'verified', 'review', 'ready', 'delivered'])
const EDITED_MEDIA_TYPES = new Set(['edited', 'image', 'photo'])

const isImageFile = (file: Partial<ShootFileData> & LooseRecord): boolean => {
  const mediaType = normalizeString(file.mediaType || file.media_type || file.fileType || file.file_type).toLowerCase()
  const typeLabel = normalizeString(file.type).toLowerCase()
  const workflowStage = normalizeString(file.workflowStage || file.workflow_stage).toLowerCase()
  const filename = normalizeString(file.filename)
  const storagePath = normalizeString(
    file.web_path || file.web_url || file.large_url || file.medium_url || file.path || file.url || file.original || file.original_url,
  )
  const originalPath = normalizeString(file.original || file.original_url || file.path)

  if (mediaType === 'raw' || typeLabel === 'raw' || workflowStage === 'todo') {
    return false
  }

  if (RAW_FILENAME_PATTERN.test(filename) || RAW_FILENAME_PATTERN.test(originalPath)) {
    return false
  }

  return (
    EDITED_MEDIA_TYPES.has(mediaType) ||
    mediaType.startsWith('image/') ||
    EDITED_MEDIA_TYPES.has(typeLabel) ||
    typeLabel.startsWith('image/') ||
    EDITED_WORKFLOW_STAGES.has(workflowStage) ||
    EDITED_FILENAME_PATTERN.test(filename) ||
    EDITED_FILENAME_PATTERN.test(storagePath)
  )
}

export const getBrightMlsPublishableFiles = (
  shoot: Partial<ShootData> & LooseRecord,
): Array<Partial<ShootFileData> & LooseRecord> => {
  const mediaRecord = asRecord(shoot.media)
  const files = Array.isArray(shoot.files) ? shoot.files : []
  const mediaFiles = Array.isArray(mediaRecord.files) ? mediaRecord.files : []

  return [...files, ...mediaFiles]
    .map((file) => (file || {}) as Partial<ShootFileData> & LooseRecord)
    .filter((file) => isImageFile(file) && !!getFileUrl(file))
}

const formatTourLabel = (key: string): string =>
  key
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())

// Tour link keys we explicitly want forwarded to Bright MLS (branded + MLS variants
// and 3D section links). `video_link` (the in-page video embed) and the `embeds`
// iframe array are intentionally excluded per product requirements.
const BRIGHT_MLS_BROADCAST_TOUR_KEYS: Array<{ key: string; label: string }> = [
  { key: 'branded', label: 'Branded Tour' },
  { key: 'mls', label: 'MLS Tour' },
  { key: 'generic_mls', label: 'MLS Tour' },
  { key: 'genericMls', label: 'MLS Tour' },
  { key: 'zillow_3d', label: 'Zillow 3D Home Tour' },
  { key: 'matterport_branded', label: 'Matterport 3D Tour (Branded)' },
  { key: 'matterport_mls', label: 'Matterport 3D Tour (MLS)' },
  { key: 'iguide_branded', label: 'iGUIDE 3D Tour (Branded)' },
  { key: 'iguide_mls', label: 'iGUIDE 3D Tour (MLS)' },
  { key: 'video_branded', label: 'Branded Video' },
  { key: 'video_mls', label: 'MLS Video' },
  { key: 'video_generic', label: 'Property Video' },
]

const getSortOrder = (file: Partial<ShootFileData> & LooseRecord, index: number): number => {
  const sortOrder = Number(file.sort_order)
  if (Number.isFinite(sortOrder)) {
    return sortOrder
  }

  const sequence = Number(file.sequence)
  if (Number.isFinite(sequence)) {
    return sequence
  }

  return index
}

export const buildBrightMlsPublishPayload = (
  shoot: Partial<ShootData> & LooseRecord,
  options?: BrightMlsBuildOptions,
): BrightMlsPublishPayload => {
  const selectedPhotoIds = options?.selectedPhotoIds ? new Set(Array.from(options.selectedPhotoIds, (value) => String(value))) : null
  const mediaRecord = asRecord(shoot.media)
  const mediaImages = Array.isArray(mediaRecord.images) ? (mediaRecord.images as LooseRecord[]) : []

  const filePhotos = getBrightMlsPublishableFiles(shoot)
    .map((file, index) => ({ file: (file || {}) as Partial<ShootFileData> & LooseRecord, index }))
    .filter(({ file }) => {
      if (!selectedPhotoIds) {
        return true
      }

      return selectedPhotoIds.has(String(file.id ?? ''))
    })
    .sort((left, right) => getSortOrder(left.file, left.index) - getSortOrder(right.file, right.index))
    .map(({ file, index }) => ({
      id: file.id,
      url: getFileUrl(file),
      filename: normalizeString(file.filename) || `photo-${index + 1}`,
      description: getLatestCommentText(file),
      roomType: '',
      selected: true,
      sortOrder: getSortOrder(file, index),
    }))

  const fallbackPhotos = mediaImages
    .map((image, index) => ({ image, index }))
    .filter(({ image }) => isImageFile(image) && !!firstUrl(
      getImageUrl(image, 'original'),
      getImageUrl(image, 'large'),
      getImageUrl(image, 'medium'),
      image.url,
      image.original_url,
      image.original,
      image.large_url,
      image.large,
      image.path,
      image.thumbnail_path,
      image.web_path,
    ))
    .filter(({ image }) => {
      if (!selectedPhotoIds) {
        return true
      }

      return selectedPhotoIds.has(String(image.id ?? ''))
    })
    .sort((left, right) => getSortOrder(left.image as Partial<ShootFileData> & LooseRecord, left.index) - getSortOrder(right.image as Partial<ShootFileData> & LooseRecord, right.index))
    .map(({ image, index }) => ({
      id: typeof image.id === 'string' || typeof image.id === 'number' ? image.id : undefined,
      url: firstUrl(
        getImageUrl(image, 'large'),
        getImageUrl(image, 'medium'),
        image.web_path,
        image.url,
        image.large_url,
        image.large,
        image.thumbnail_path,
        image.path,
        image.original_url,
        image.original,
        getImageUrl(image, 'original'),
      ) || '',
      filename: normalizeString(image.filename || image.name) || `photo-${index + 1}`,
      description: getLatestCommentText(image as Partial<ShootFileData> & LooseRecord),
      roomType: '',
      selected: true,
      sortOrder: getSortOrder(image as Partial<ShootFileData> & LooseRecord, index),
    }))

  const photos = Array.from(
    new Map(
      [...filePhotos, ...fallbackPhotos]
        .filter((photo) => photo.url)
        .map((photo) => [String(photo.id ?? photo.url), photo]),
    ).values(),
  )

  const rawTourLinks = getRawTourLinks(shoot)
  const documents = normalizeIguideFloorplans(shoot).map((floorplan) => ({
    url: floorplan.url,
    filename: normalizeString(floorplan.filename) || 'floorplan.pdf',
    type: 'floor_plan' as const,
    visibility: 'private' as const,
    description: 'Floor plan',
  }))

  const HANDLED_OR_SKIPPED_TOUR_KEYS = new Set([
    // Dedicated payload slots
    'iguide_mls',
    'iguide_branded',
    'iguide',
    'iGuide',
    'cubicasa',
    'cubicasa_url',
    'matterport_mls',
    'matterport_branded',
    'matterport',
    'slideshow',
    'slideshow_url',
    'neo_tour',
    'neotour',
    // Broadcast keys handled explicitly below
    'branded',
    'mls',
    'generic_mls',
    'genericMls',
    'zillow_3d',
    'video_branded',
    'video_mls',
    'video_generic',
    // Intentionally excluded from Bright MLS sync
    'video_link',
    'embeds',
    'featured_embed_id',
    'featured_embed',
    'tour_style',
    'realtor_client',
    'realtor_client_id',
    'realtorClient',
    'realtorClientId',
  ])

  const iguideTourUrl = firstUrl(shoot.iguide_tour_url, shoot.iguideTourUrl, getPreferredIguideUrl(shoot))
  const slideshowUrl = firstUrl(
    rawTourLinks.mls,
    rawTourLinks.generic_mls,
    rawTourLinks.genericMls,
    rawTourLinks.slideshow,
    rawTourLinks.slideshow_url,
    rawTourLinks.neo_tour,
    rawTourLinks.neotour,
  )
  const matterportUrl = firstUrl(rawTourLinks.matterport_mls, rawTourLinks.matterport_branded, rawTourLinks.matterport)
  const cubicasaUrl = firstUrl(rawTourLinks.cubicasa, rawTourLinks.cubicasa_url)

  const additional_tour_urls: Record<string, string> = {}
  const seenUrls = new Set<string>(
    [iguideTourUrl, slideshowUrl, matterportUrl, cubicasaUrl].filter((value): value is string => !!value),
  )

  // Explicit broadcast of branded/MLS/3D/video (branded+MLS) tour links.
  for (const { key, label } of BRIGHT_MLS_BROADCAST_TOUR_KEYS) {
    const candidate = normalizeString(rawTourLinks[key])
    if (!/^https?:\/\//i.test(candidate) || seenUrls.has(candidate) || additional_tour_urls[label]) {
      continue
    }
    additional_tour_urls[label] = candidate
    seenUrls.add(candidate)
  }

  // Forward any remaining unhandled URL-valued tour link entries as-is.
  for (const [key, value] of Object.entries(rawTourLinks)) {
    if (HANDLED_OR_SKIPPED_TOUR_KEYS.has(key)) {
      continue
    }

    const candidate = normalizeString(value)
    if (!/^https?:\/\//i.test(candidate) || seenUrls.has(candidate)) {
      continue
    }

    const label = formatTourLabel(key)
    if (!additional_tour_urls[label]) {
      additional_tour_urls[label] = candidate
      seenUrls.add(candidate)
    }
  }

  return {
    photos,
    iguide_tour_url: iguideTourUrl,
    slideshow_url: slideshowUrl,
    matterport_url: matterportUrl,
    cubicasa_url: cubicasaUrl,
    additional_tour_urls,
    documents,
  }
}

const getBrightMlsFetchHeaders = (authToken?: string | null): HeadersInit => {
  if (!authToken) {
    return { Accept: 'application/json' }
  }

  return {
    Accept: 'application/json',
    Authorization: `Bearer ${authToken}`,
  }
}

const fetchShootFilesForBrightMls = async (
  shootId: string | number,
  authToken?: string | null,
): Promise<LooseRecord[]> => {
  const headers = getBrightMlsFetchHeaders(authToken)
  const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/files?type=edited`, { headers })
  if (!response.ok) {
    return []
  }

  const payload = await response.json().catch(() => ({ data: [] }))
  return Array.isArray(payload?.data) ? (payload.data as LooseRecord[]) : Array.isArray(payload) ? (payload as LooseRecord[]) : []
}

const fetchShootDetailsForBrightMls = async (
  shootId: string | number,
  authToken?: string | null,
): Promise<LooseRecord | null> => {
  const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
    headers: getBrightMlsFetchHeaders(authToken),
  })
  if (!response.ok) {
    return null
  }

  const payload = await response.json().catch(() => null)
  if (payload && typeof payload === 'object') {
    const record = payload as LooseRecord
    const data = record.data
    if (data && typeof data === 'object') {
      return data as LooseRecord
    }
  }

  return payload && typeof payload === 'object' ? (payload as LooseRecord) : null
}

export const buildBrightMlsPublishPayloadWithFallback = async (
  shoot: Partial<ShootData> & LooseRecord,
  authToken?: string | null,
  options?: BrightMlsBuildOptions,
): Promise<BrightMlsPublishPayload> => {
  const initialPayload = buildBrightMlsPublishPayload(shoot, options)
  if (!shoot.id) {
    return initialPayload
  }

  const [fetchedShoot, fetchedFiles] = await Promise.all([
    fetchShootDetailsForBrightMls(shoot.id, authToken),
    fetchShootFilesForBrightMls(shoot.id, authToken),
  ])

  const baseShoot = fetchedShoot ? { ...shoot, ...fetchedShoot } : shoot
  const currentMedia = asRecord(shoot.media)

  if (fetchedFiles.length === 0 && !fetchedShoot) {
    return initialPayload
  }

  return buildBrightMlsPublishPayload(
    {
      ...baseShoot,
      files: fetchedFiles.length > 0
        ? (fetchedFiles as unknown as ShootFileData[])
        : (Array.isArray(baseShoot.files) ? (baseShoot.files as ShootFileData[]) : []),
      media: {
        ...currentMedia,
        ...asRecord(baseShoot.media),
        files: fetchedFiles.length > 0
          ? (fetchedFiles as unknown as ShootData['media']['files'])
          : (Array.isArray(currentMedia.files) ? currentMedia.files : asRecord(baseShoot.media).files as ShootData['media']['files']),
      },
    },
    options,
  )
}

const BRIGHT_MLS_POPUP_NAME = 'bright-mls-import'
const BRIGHT_MLS_POPUP_FEATURES = [
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

const openBrightMlsPopup = (url: string): Window | null => {
  if (typeof window === 'undefined') {
    return null
  }

  return window.open(url, BRIGHT_MLS_POPUP_NAME, BRIGHT_MLS_POPUP_FEATURES)
}

export const openPendingBrightMlsWindow = (): Window | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const popup = openBrightMlsPopup('about:blank')
  if (!popup) {
    return null
  }

  try {
    popup.document.title = 'Bright MLS Import'
    popup.document.body.innerHTML = '<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;padding:24px;line-height:1.5;color:#0f172a"><h2 style="margin:0 0 12px">Preparing Bright MLS import…</h2><p style="margin:0;color:#475569">Your media manifest is being published. This tab will redirect to Bright MLS automatically.</p></div>'
  } catch {
    // ignore popup document access issues
  }

  return popup
}

export const navigateBrightMlsWindow = (popup: Window | null, redirectUrl: string | null | undefined): boolean => {
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
    // ignore popup navigation issues and fall back to window.open
  }

  if (typeof window === 'undefined') {
    return false
  }

  return Boolean(openBrightMlsPopup(targetUrl))
}

export const closePendingBrightMlsWindow = (popup: Window | null) => {
  try {
    if (popup && !popup.closed) {
      popup.close()
    }
  } catch {
    // ignore popup close issues
  }
}
