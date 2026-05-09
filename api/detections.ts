import axios from 'axios'

const BASE = process.env.STAIN_BACKEND_URL || 'http://localhost:8081/api'

function getAuthHeaders() {
  const token = localStorage.getItem('authToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function createDetectionTask(file: File, payload: any, onUploadProgress?: (p: number) => void) {
  const url = `${BASE}/detections`
  const data = new FormData()
  data.append('image', file)
  data.append('building_name', payload.buildingName)
  if (payload.locationFloor !== undefined) data.append('location_floor', String(payload.locationFloor))
  if (payload.locationSection) data.append('location_section', payload.locationSection)
  if (payload.description) data.append('description', payload.description)
  data.append('inference_mode', payload.inferenceMode || 'local')

  const resp = await axios.post(url, data, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (e: ProgressEvent) => {
      if (!e.total || !onUploadProgress) return
      onUploadProgress(Math.round((e.loaded / e.total) * 100))
    }
  })
  return resp.data
}

export async function getDetectionTask(taskId: string | number) {
  const url = `${BASE}/detections/${taskId}`
  const resp = await axios.get(url, { headers: getAuthHeaders() })
  return resp.data
}

export async function getDetectionList(params: any) {
  const url = `${BASE}/detections`
  const resp = await axios.get(url, { headers: getAuthHeaders(), params })
  return resp.data
}

export async function getDetectionSignedUrl(taskId: string | number) {
  const url = `${BASE}/detections/${taskId}/signed-url`
  const resp = await axios.get(url, { headers: getAuthHeaders() })
  return resp.data
}

export async function retryDetection(taskId: string | number) {
  const url = `${BASE}/detections/${taskId}/retry`
  const resp = await axios.post(url, {}, { headers: getAuthHeaders() })
  return resp.data
}
