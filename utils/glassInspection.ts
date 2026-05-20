import type { DetectionResultData } from '~/types/glassInspection'

const RESULT_PATH_PATTERN = /(?:^|[\\/])data[\\/]result(?<suffix>[\\/].+)$/i
const IMAGE_PATH_PATTERN = /(?:^|[\\/])data[\\/]images?(?<suffix>[\\/].+)$/i
const PUBLIC_RESULT_PATH_PATTERN = /(?:^|[\\/])results(?<suffix>[\\/].+)$/i
const PUBLIC_IMAGE_PATH_PATTERN = /(?:^|[\\/])images(?<suffix>[\\/].+)$/i

export function isAbsoluteMediaSrc(src: string) {
  return /^(?:data:|blob:|https?:\/\/)/i.test(src)
}

function toLeadingSlashPath(prefix: '/results' | '/images', suffix: string) {
  const normalizedSuffix = suffix.replace(/\\/g, '/').replace(/^\/+/, '')
  return `${prefix}/${normalizedSuffix}`
}

function ensureLeadingSlash(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

export function normalizeInspectionMediaPath(src?: string | null) {
  if (!src) {
    return ''
  }

  const trimmed = String(src).trim()
  if (!trimmed) {
    return ''
  }

  if (isAbsoluteMediaSrc(trimmed)) {
    return trimmed
  }

  if (trimmed.startsWith('/results/') || trimmed.startsWith('/images/')) {
    return trimmed.replace(/\\/g, '/')
  }

  if (trimmed.startsWith('results/') || trimmed.startsWith('images/')) {
    return ensureLeadingSlash(trimmed.replace(/\\/g, '/'))
  }

  const resultMatch = trimmed.match(RESULT_PATH_PATTERN)
  if (resultMatch?.groups?.suffix) {
    return toLeadingSlashPath('/results', resultMatch.groups.suffix)
  }

  const imageMatch = trimmed.match(IMAGE_PATH_PATTERN)
  if (imageMatch?.groups?.suffix) {
    return toLeadingSlashPath('/images', imageMatch.groups.suffix)
  }

  const publicResultMatch = trimmed.match(PUBLIC_RESULT_PATH_PATTERN)
  if (publicResultMatch?.groups?.suffix) {
    return toLeadingSlashPath('/results', publicResultMatch.groups.suffix)
  }

  const publicImageMatch = trimmed.match(PUBLIC_IMAGE_PATH_PATTERN)
  if (publicImageMatch?.groups?.suffix) {
    return toLeadingSlashPath('/images', publicImageMatch.groups.suffix)
  }

  return ensureLeadingSlash(trimmed.replace(/\\/g, '/'))
}

export function resolveInspectionMediaSrc(src?: string | null) {
  return normalizeInspectionMediaPath(src)
}

export function normalizeDetectionResultMedia(result?: DetectionResultData | null): DetectionResultData | null {
  if (!result) {
    return null
  }

  return {
    ...result,
    image: normalizeInspectionMediaPath(result.image),
    details: result.details?.map((detail) => ({
      ...detail,
      image: normalizeInspectionMediaPath(detail.image)
    }))
  }
}

export function absolutizeInspectionMediaSrc(src?: string | null, baseURL?: string) {
  const normalized = normalizeInspectionMediaPath(src)
  if (!normalized || isAbsoluteMediaSrc(normalized) || !baseURL) {
    return normalized
  }

  return `${baseURL.replace(/\/+$/, '')}${ensureLeadingSlash(normalized)}`
}

export function absolutizeDetectionResultMedia(
  result?: DetectionResultData | null,
  baseURL?: string
): DetectionResultData | null {
  const normalized = normalizeDetectionResultMedia(result)
  if (!normalized || !baseURL) {
    return normalized
  }

  return {
    ...normalized,
    image: absolutizeInspectionMediaSrc(normalized.image, baseURL),
    details: normalized.details?.map((detail) => ({
      ...detail,
      image: absolutizeInspectionMediaSrc(detail.image, baseURL)
    }))
  }
}
