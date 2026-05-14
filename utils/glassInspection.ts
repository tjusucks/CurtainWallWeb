import { useRuntimeConfig } from '#app'

const DEFAULT_GLASS_DETECTION_BASE = 'http://8.153.161.229:8003'

export function getGlassDetectionBaseURL() {
  try {
    const config = useRuntimeConfig()
    return String(config.public.glassDetectionApiBase || DEFAULT_GLASS_DETECTION_BASE).replace(/\/+$/, '')
  } catch {
    return DEFAULT_GLASS_DETECTION_BASE
  }
}

export function resolveInspectionMediaSrc(src?: string | null) {
  if (!src) {
    return ''
  }

  if (
    src.startsWith('data:') ||
    src.startsWith('blob:') ||
    src.startsWith('http://') ||
    src.startsWith('https://')
  ) {
    return src
  }

  const base = getGlassDetectionBaseURL()
  return `${base}${src.startsWith('/') ? src : `/${src}`}`
}
