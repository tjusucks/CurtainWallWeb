const imageCache = new Map<string, string>()
const imageRequests = new Map<string, Promise<string>>()

const isClient = () => typeof window !== 'undefined'

const isDirectRenderable = (src: string) => {
  return src.startsWith('blob:') || src.startsWith('data:')
}

export const getCachedImageSrc = (src?: string) => {
  if (!src) return ''
  return imageCache.get(src) || src
}

export const primeImageCache = async (src?: string) => {
  if (!src || !isClient()) return src || ''
  const cached = imageCache.get(src)
  if (cached) return cached
  const pending = imageRequests.get(src)
  if (pending) return pending

  if (isDirectRenderable(src)) {
    imageCache.set(src, src)
    return src
  }

  const request = (async () => {
    try {
      const resp = await fetch(src, { credentials: 'same-origin' })
      if (!resp.ok) throw new Error(`image fetch failed: ${resp.status}`)
      const blob = await resp.blob()
      const objectUrl = URL.createObjectURL(blob)
      imageCache.set(src, objectUrl)
      return objectUrl
    } catch {
      const loaded = await new Promise<string>((resolve) => {
        const img = new Image()
        img.decoding = 'async'
        img.loading = 'eager'
        img.onload = () => resolve(src)
        img.onerror = () => resolve(src)
        img.src = src
      })
      imageCache.set(src, loaded)
      return loaded
    } finally {
      imageRequests.delete(src)
    }
  })()

  imageRequests.set(src, request)
  return request
}

export const primeImageList = async (srcList: Array<string | undefined | null>) => {
  if (!isClient()) return
  await Promise.all(srcList.map((src) => primeImageCache(src || '')))
}
