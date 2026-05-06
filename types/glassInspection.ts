export type DetectionStatus = 'success' | 'warning' | 'error'

export interface PointCloudData {
  points: number[][]
  dists: number[]
  plane: number[]
  normal?: number[]
  projected_points?: number[][]
  projected_dists?: number[]
}

export interface DetectionDetail {
  label: string
  value: string
  description?: string
  image?: string
}

export interface DetectionResultData {
  status: DetectionStatus
  title: string
  description: string
  details?: DetectionDetail[]
  image?: string
  pointcloud?: PointCloudData
}

export const FLATNESS_FIELD_NAMES = ['left_env', 'left_mix', 'right_env', 'right_mix'] as const

export type FlatnessFieldName = (typeof FLATNESS_FIELD_NAMES)[number]
