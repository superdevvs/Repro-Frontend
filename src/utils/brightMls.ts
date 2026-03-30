import type { ShootData, ShootFileData } from '@/types/shoots'
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

const asRecord = (value: unknown): LooseRecord =>
  value && typeof value === 'object' ? (value as LooseRecord) : {}

const normalizeString = (value: unknown): string => String(value ?? '').trim()

const firstUrl = (...values: unknown[]): string | null => {
  for (const value of values) {
    const candidate = normalizeString(value)
    if (/^https?:\/\//i.test(candidate)) {
      return candidate
    }
  }

  return null
}

const getFileUrl = (file: Partial<ShootFileData> & LooseRecord): string =>
  firstUrl(
    file.url,
    file.path,
    file.original_url,
    file.original,
    file.large_url,
    file.large,
    file.web_url,
    file.web_path,
    file.medium_url,
    file.medium,
    file.storage_path,
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

const isImageFile = (file: Partial<ShootFileData> & LooseRecord): boolean => {
  const fileType = normalizeString(file.fileType || file.file_type || file.media_type).toLowerCase()
  const workflowStage = normalizeString(file.workflowStage || file.workflow_stage).toLowerCase()
  const filename = normalizeString(file.filename)

  return (
    fileType === 'image' ||
    fileType === 'edited' ||
    fileType === 'photo' ||
    workflowStage === 'completed' ||
    workflowStage === 'verified' ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)
  )
}

const formatTourLabel = (key: string): string =>
  key
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())

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
  options?: { selectedPhotoIds?: Iterable<string | number> | null },
): BrightMlsPublishPayload => {
  const selectedPhotoIds = options?.selectedPhotoIds ? new Set(Array.from(options.selectedPhotoIds, (value) => String(value))) : null
  const files = Array.isArray(shoot.files) ? shoot.files : []

  const filePhotos = files
    .map((file, index) => ({ file: (file || {}) as Partial<ShootFileData> & LooseRecord, index }))
    .filter(({ file }) => isImageFile(file) && !!getFileUrl(file))
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

  const mediaImages = Array.isArray(asRecord(shoot.media).images)
    ? (asRecord(shoot.media).images as LooseRecord[])
    : []

  const fallbackPhotos = mediaImages
    .map((image, index) => ({ image, index }))
    .filter(({ image }) => !!firstUrl(image.url, image.original_url, image.original, image.large_url, image.large))
    .filter(({ image }) => {
      if (!selectedPhotoIds) {
        return true
      }

      return selectedPhotoIds.has(String(image.id ?? ''))
    })
    .sort((left, right) => getSortOrder(left.image as Partial<ShootFileData> & LooseRecord, left.index) - getSortOrder(right.image as Partial<ShootFileData> & LooseRecord, right.index))
    .map(({ image, index }) => ({
      id: typeof image.id === 'string' || typeof image.id === 'number' ? image.id : undefined,
      url: firstUrl(image.url, image.original_url, image.original, image.large_url, image.large) || '',
      filename: normalizeString(image.filename) || `photo-${index + 1}`,
      description: getLatestCommentText(image as Partial<ShootFileData> & LooseRecord),
      roomType: '',
      selected: true,
      sortOrder: getSortOrder(image as Partial<ShootFileData> & LooseRecord, index),
    }))

  const photos = filePhotos.length > 0 ? filePhotos : fallbackPhotos

  const rawTourLinks = getRawTourLinks(shoot)
  const documents = normalizeIguideFloorplans(shoot).map((floorplan) => ({
    url: floorplan.url,
    filename: normalizeString(floorplan.filename) || 'floorplan.pdf',
    type: 'floor_plan' as const,
    visibility: 'private' as const,
    description: 'Floor plan',
  }))

  const additional_tour_urls = Object.entries(rawTourLinks).reduce<Record<string, string>>((acc, [key, value]) => {
    if (
      [
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
        'video_mls',
        'video_generic',
        'video_link',
        'embeds',
        'tour_style',
      ].includes(key)
    ) {
      return acc
    }

    const candidate = normalizeString(value)
    if (!/^https?:\/\//i.test(candidate)) {
      return acc
    }

    acc[formatTourLabel(key)] = candidate
    return acc
  }, {})

  return {
    photos,
    iguide_tour_url: firstUrl(shoot.iguide_tour_url, shoot.iguideTourUrl, getPreferredIguideUrl(shoot)),
    slideshow_url: firstUrl(rawTourLinks.slideshow, rawTourLinks.slideshow_url, rawTourLinks.neo_tour, rawTourLinks.neotour, rawTourLinks.video_mls, rawTourLinks.video_generic, rawTourLinks.video_link),
    matterport_url: firstUrl(rawTourLinks.matterport_mls, rawTourLinks.matterport_branded, rawTourLinks.matterport),
    cubicasa_url: firstUrl(rawTourLinks.cubicasa, rawTourLinks.cubicasa_url),
    additional_tour_urls,
    documents,
  }
}

export const openPendingBrightMlsWindow = (): Window | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const popup = window.open('', '_blank')
  if (!popup) {
    return null
  }

  try {
    popup.document.title = 'Bright MLS Import'
    popup.document.body.innerHTML = '<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;padding:24px;line-height:1.5;color:#0f172a"><h2 style="margin:0 0 12px">Preparing Bright MLS import…</h2><p style="margin:0;color:#475569">Your media manifest is being published. This tab will redirect to Bright MLS automatically.</p></div>'
  } catch {
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
  }

  if (typeof window === 'undefined') {
    return false
  }

  return Boolean(window.open(targetUrl, '_blank'))
}

export const closePendingBrightMlsWindow = (popup: Window | null) => {
  try {
    if (popup && !popup.closed) {
      popup.close()
    }
  } catch {
  }
}
