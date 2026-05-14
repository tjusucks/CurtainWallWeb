import type { DetectionResultData, FlatnessFieldName } from '~/types/glassInspection'

const API_BASE = import.meta.dev ? 'http://8.153.161.229:8003' : ''

export async function detectGlassCrack(email: string, files: File[]): Promise<DetectionResultData> {
  const formData = new FormData()
  formData.append('email', email)
  files.forEach((file) => formData.append('images', file))

  return await $fetch(`${API_BASE}/api/detect/glass-crack`, {
    method: 'POST',
    body: formData,
  }) as DetectionResultData
}

export async function detectGlassFlatness(
  email: string,
  filesByField: Partial<Record<FlatnessFieldName, File>>
): Promise<DetectionResultData> {
  const formData = new FormData()
  formData.append('email', email)

  ;(['left_env', 'left_mix', 'right_env', 'right_mix'] as FlatnessFieldName[]).forEach((field) => {
    const file = filesByField[field]
    if (file) {
      formData.append(field, file)
    }
  })

  return await $fetch(`${API_BASE}/api/detect/glass-flatness`, {
    method: 'POST',
    body: formData,
  }) as DetectionResultData
}
