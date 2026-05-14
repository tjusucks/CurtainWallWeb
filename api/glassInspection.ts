import type { DetectionResultData, FlatnessFieldName } from '~/types/glassInspection'

export async function detectGlassCrack(userId: string, files: File[]): Promise<DetectionResultData> {
  const formData = new FormData()
  formData.append('userId', userId)
  files.forEach((file) => formData.append('images', file))

  return await $fetch('/api/detect/glass-crack', {
    method: 'POST',
    body: formData,
  }) as DetectionResultData
}

export async function detectGlassFlatness(
  userId: string,
  filesByField: Partial<Record<FlatnessFieldName, File>>
): Promise<DetectionResultData> {
  const formData = new FormData()
  formData.append('userId', userId)

  ;(['left_env', 'left_mix', 'right_env', 'right_mix'] as FlatnessFieldName[]).forEach((field) => {
    const file = filesByField[field]
    if (file) {
      formData.append(field, file)
    }
  })

  return await $fetch('/api/detect/glass-flatness', {
    method: 'POST',
    body: formData,
  }) as DetectionResultData
}
