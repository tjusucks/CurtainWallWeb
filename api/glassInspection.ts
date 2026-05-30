import axios from 'axios'
import { FLATNESS_FIELD_NAMES, type DetectionResultData, type FlatnessFieldName } from '~/types/glassInspection'
import { normalizeDetectionResultMedia } from '~/utils/glassInspection'

const REQUEST_TIMEOUT = 600000

function getGlassDetectionApiBase() {
  const config = useRuntimeConfig()
  return String(config.public.glassDetectionApiBase || '').replace(/\/+$/, '')
}

function createMultipartHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'multipart/form-data'
  }

  if (process.client) {
    const token = localStorage.getItem('authToken')
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  return headers
}

async function postGlassInspection(path: string, formData: FormData) {
  const baseURL = getGlassDetectionApiBase()
  const response = await axios.post<DetectionResultData>(`${baseURL}${path}`, formData, {
    headers: createMultipartHeaders(),
    timeout: REQUEST_TIMEOUT,
    withCredentials: false
  })

  return normalizeDetectionResultMedia(response.data) as DetectionResultData
}

export async function detectGlassCrack(email: string, files: File[]): Promise<DetectionResultData> {
  const formData = new FormData()
  formData.append('email', email)
  files.forEach((file) => formData.append('images', file))

  return await postGlassInspection('/api/detect/glass-crack', formData)
}

export async function detectGlassFlatness(
  email: string,
  filesByField: Partial<Record<FlatnessFieldName, File>>
): Promise<DetectionResultData> {
  const formData = new FormData()
  formData.append('email', email)

  FLATNESS_FIELD_NAMES.forEach((field) => {
    const file = filesByField[field]
    if (file) {
      formData.append(field, file)
    }
  })

  return await postGlassInspection('/api/detect/glass-flatness', formData)
}
