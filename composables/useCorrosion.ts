/**
 * Hook 名称：useCorrosion
 * 作用：管理锈蚀检测前端状态，并按后端接口文档调用锈蚀检测服务。
 */
import { ref } from 'vue'
import { primeImageList } from '~/composables/useImageCache'

const CORROSION_API_PROXY_BASE = '/corrosion-api'

const getAuthHeaders = (): Record<string, string> => {
  if (process.client) {
    const storedToken = localStorage.getItem('authToken')
    if (storedToken) return { Authorization: `Bearer ${storedToken}` }

    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=')
      acc[key] = value
      return acc
    }, {} as Record<string, string>)

    const token = cookies.auth_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  try {
    const tokenCookie = useCookie('auth_token')
    if (tokenCookie.value) return { Authorization: `Bearer ${tokenCookie.value}` }
  } catch (e) {
    console.warn('[useCorrosion] Error reading cookie in SSR:', e)
  }
  return {}
}

const getCorrosionApiBase = () => {
  return CORROSION_API_PROXY_BASE
}

const getCorrosionAssetBase = () => {
  const config = useRuntimeConfig()
  return (config.public.corrosionApiBase as string) || 'http://8.153.161.229:18000'
}

export interface DetectionMetrics {
  corrosion_count?: number
  rust_spots_count?: number
  total_count?: number
  corrosion_area_ratio?: number
  rust_spots_area_ratio?: number
  total_area_ratio?: number
  corrosion_avg_conf?: number
  rust_spots_avg_conf?: number
  total_avg_conf?: number
  count?: number
  area_ratio?: number
  avg_conf?: number
}

interface TaskItem {
  id: string
  filename: string
  mode: 'sync' | 'queue' | 'batch'
  status: 'pending' | 'processing' | 'running' | 'done' | 'error'
  message?: string
  metrics?: DetectionMetrics
  batchId?: string
  batchOrder?: number
}

interface HistoryBatchItem {
  type: 'batch'
  batch_no: string
  name: string
  status: string
  total_count: number
  processed_count: number
  created_at: string
  thumbnail_urls?: string[]
}

interface HistorySingleItem {
  type: 'single'
  job_id: string
  status: string
  created_at: string
  result_preview?: DetectionMetrics
  input_image?: string
  output_image?: string
  metrics?: DetectionMetrics
  error_msg?: string
}

type HistoryItem = HistoryBatchItem | HistorySingleItem

interface BatchDetailsTask {
  job_id: string
  input_image: string
  output_image?: string
  status: string
  metrics?: DetectionMetrics
  error_msg?: string
}

interface BatchDetailsResponse {
  batch_info: {
    batch_no: string
    name: string
    progress: string
    status: string
    created_at?: string
  }
  tasks: BatchDetailsTask[]
}

const numberOrUndefined = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

const firstValue = (...values: any[]) => values.find((value) => value !== undefined && value !== null && value !== '')

const normalizeHistoryItem = (item: any): HistoryItem => {
  const batchNo = firstValue(item.batch_no, item.batchNo, item.batch_id, item.batchId)
  if (item.type === 'batch' || batchNo) {
    return {
      ...item,
      type: 'batch',
      batch_no: String(batchNo || item.id || ''),
      name: firstValue(item.name, item.dataset_name, item.datasetName, item.batch_name, item.batchName, batchNo) || '',
      status: firstValue(item.status, item.state) || 'pending',
      total_count: numberOrUndefined(firstValue(item.total_count, item.total_files, item.totalFiles, item.file_count, item.image_count)) ?? 0,
      processed_count: numberOrUndefined(firstValue(item.processed_count, item.done_count, item.completed_count, item.finished_count)) ?? 0,
      created_at: firstValue(item.created_at, item.createdAt, item.create_time, item.createTime) || '',
      thumbnail_urls: item.thumbnail_urls || item.thumbnailUrls || item.thumbnails || [],
    }
  }

  return {
    ...item,
    type: 'single',
    job_id: String(firstValue(item.job_id, item.jobId, item.id) || ''),
    status: firstValue(item.status, item.state) || 'pending',
    created_at: firstValue(item.created_at, item.createdAt, item.create_time, item.createTime) || '',
    result_preview: item.result_preview ? normalizeCorrosionMetrics(item.result_preview) : item.resultPreview,
    input_image: firstValue(item.input_image, item.inputImage, item.input_image_url, item.inputImageUrl),
    output_image: firstValue(item.output_image, item.outputImage, item.output_image_url, item.outputImageUrl),
    metrics: item.metrics ? normalizeCorrosionMetrics(item.metrics) : item.metrics,
    error_msg: firstValue(item.error_msg, item.errorMsg, item.message),
  }
}

const normalizeBatchDetails = (raw: any): BatchDetailsResponse => {
  const batchInfo = raw.batch_info || raw.batchInfo || raw.info || {}
  return {
    ...raw,
    batch_info: {
      batch_no: String(firstValue(batchInfo.batch_no, batchInfo.batchNo, raw.batch_no, raw.batchNo) || ''),
      name: firstValue(batchInfo.name, batchInfo.dataset_name, batchInfo.datasetName, raw.name) || '',
      progress: String(firstValue(batchInfo.progress, raw.progress) || ''),
      status: firstValue(batchInfo.status, raw.status) || 'pending',
      created_at: firstValue(batchInfo.created_at, batchInfo.createdAt, raw.created_at, raw.createdAt),
    },
    tasks: (raw.tasks || raw.list || raw.items || []).map((task: any) => ({
      ...task,
      job_id: String(firstValue(task.job_id, task.jobId, task.id) || ''),
      input_image: firstValue(task.input_image, task.inputImage, task.input_image_url, task.inputImageUrl) || '',
      output_image: firstValue(task.output_image, task.outputImage, task.output_image_url, task.outputImageUrl),
      status: firstValue(task.status, task.state) || 'pending',
      metrics: task.metrics ? normalizeCorrosionMetrics(task.metrics) : task.metrics,
      error_msg: firstValue(task.error_msg, task.errorMsg, task.message),
    })),
  }
}

export const normalizeCorrosionMetrics = (raw?: any): DetectionMetrics => {
  const m = raw || {}
  const corrosionCount = numberOrUndefined(m.corrosion_count)
  const rustSpotsCount = numberOrUndefined(m.rust_spots_count)
  const totalCount = numberOrUndefined(m.total_count ?? m.count ?? m.box_count ?? m['检测数量'])
  const corrosionAreaRatio = numberOrUndefined(m.corrosion_area_ratio)
  const rustSpotsAreaRatio = numberOrUndefined(m.rust_spots_area_ratio)
  const totalAreaRatio = numberOrUndefined(m.total_area_ratio ?? m.area_ratio ?? m['面积比例'])
  const corrosionAvgConf = numberOrUndefined(m.corrosion_avg_conf)
  const rustSpotsAvgConf = numberOrUndefined(m.rust_spots_avg_conf)
  const totalAvgConf = numberOrUndefined(m.total_avg_conf ?? m.avg_conf ?? m.max_conf ?? m['平均置信度'])

  return {
    corrosion_count: corrosionCount ?? 0,
    rust_spots_count: rustSpotsCount ?? 0,
    total_count: totalCount ?? (corrosionCount ?? 0) + (rustSpotsCount ?? 0),
    corrosion_area_ratio: corrosionAreaRatio ?? 0,
    rust_spots_area_ratio: rustSpotsAreaRatio ?? 0,
    total_area_ratio: totalAreaRatio ?? 0,
    corrosion_avg_conf: corrosionAvgConf ?? 0,
    rust_spots_avg_conf: rustSpotsAvgConf ?? 0,
    total_avg_conf: totalAvgConf ?? 0,
    count: totalCount ?? (corrosionCount ?? 0) + (rustSpotsCount ?? 0),
    area_ratio: totalAreaRatio ?? 0,
    avg_conf: totalAvgConf ?? 0,
  }
}

const getImageUrl = (path?: string) => {
  if (!path) return ''
  if (path.startsWith('blob:') || path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const baseUrl = getCorrosionAssetBase().replace(/\/$/, '')
  let normalizedPath = path.replace(/\\/g, '/')
  if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath
  return `${baseUrl}${normalizedPath}`
}

const getResultImageUrl = (result: any) => {
  const base64 = result?.image_base64
  if (base64) {
    return String(base64).startsWith('data:') ? String(base64) : `data:image/png;base64,${base64}`
  }
  return getImageUrl(result?.output_image || result?.outputImage || result?.output_image_url || result?.outputImageUrl)
}

const isTerminalStatus = (status?: string) => ['done', 'error'].includes(status || '')
const isRunningStatus = (status?: string) => ['pending', 'processing', 'running', 'queued'].includes(status || '')

export function useCorrosion() {
  const files = ref<File[]>([])
  const busy = ref(false)
  const metrics = useState<DetectionMetrics>('corrosion-metrics', () => ({}))
  const previewSrc = useState<string>('corrosion-preview', () => '')
  const inputPreviewSrc = useState<string>('corrosion-input-preview', () => '')
  const progressText = useState<string>('corrosion-progress', () => '未开始')
  const gallery = useState<Array<{ id: string; input: string; output: string; metrics: DetectionMetrics; filename: string; batchId?: string; batchOrder?: number }>>('corrosion-gallery', () => [])
  const tasks = useState<TaskItem[]>('corrosion-tasks', () => [])
  const logs = useState<string[]>('corrosion-logs', () => [])
  const batchSeq = useState<number>('corrosion-batch-seq', () => 0)
  const currentBatchId = useState<string>('corrosion-current-batch', () => '')

  const historyList = useState<HistoryItem[]>('corrosion-history-list', () => [])
  const historyPage = useState<number>('corrosion-history-page', () => 1)
  const historyTotal = useState<number>('corrosion-history-total', () => 0)
  const historyLoading = ref(false)
  const historyType = useState<'single' | 'batch' | 'all'>('corrosion-history-type', () => 'all')

  const batchDetails = useState<BatchDetailsResponse | null>('corrosion-batch-details', () => null)
  const batchDetailsLoading = ref(false)

  const pushLog = (msg: string) => {
    const line = `${new Date().toLocaleTimeString()} - ${msg}`
    logs.value.unshift(line)
    if (logs.value.length > 100) logs.value.pop()
  }

  const fetchModels = async () => {
    // 模型列表接口已按新文档下线，保留空方法兼容旧调用。
  }

  const setFiles = (list: File[]) => {
    files.value = list
    progressText.value = list.length ? `已选择 ${list.length} 张图片` : '未开始'
    currentBatchId.value = ''
    if (list.length) {
      inputPreviewSrc.value = URL.createObjectURL(list[0])
    } else {
      inputPreviewSrc.value = ''
      previewSrc.value = ''
      metrics.value = {}
    }
  }

  const updateTask = (id: string, patch: Partial<TaskItem>) => {
    const task = tasks.value.find((x) => x.id === id)
    if (task) Object.assign(task, patch)
  }

  const handleResult = (data: any, inputUrl: string, filename: string, taskId?: string, batchId?: string) => {
    if (!data) return
    const result = data.result || data.data || data
    const outputUrl = getResultImageUrl(result)
    const met = normalizeCorrosionMetrics(result.metrics)

    previewSrc.value = outputUrl
    inputPreviewSrc.value = inputUrl
    metrics.value = met
    void primeImageList([inputUrl, outputUrl])

    let batchOrder: number | undefined
    if (taskId) {
      const t = tasks.value.find((x) => x.id === taskId)
      if (t) {
        t.status = 'done'
        t.metrics = met
        t.message = '完成'
        if (!batchId) batchId = t.batchId
        batchOrder = t.batchOrder
      }
    }

    pushLog(`检测成功: ${filename}, total_count=${met.total_count ?? 0}`)
    gallery.value.unshift({
      id: taskId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      input: inputUrl,
      output: outputUrl,
      metrics: met,
      filename,
      batchId,
      batchOrder,
    })
  }

  const handleBatchDetectResult = (data: any, inputUrls: Record<string, string>, fallbackBatchId: string, batchOrder: number) => {
    const batchInfo = data?.batch_info || data?.batchInfo || {}
    const taskList = data?.tasks || []
    const batchNo = String(firstValue(batchInfo.batch_no, batchInfo.batchNo, fallbackBatchId))

    currentBatchId.value = batchNo
    progressText.value = `批量检测完成 (${firstValue(batchInfo.progress, `${taskList.length}/${taskList.length}`)})`

    taskList.forEach((rawTask: any, index: number) => {
      const jobId = String(firstValue(rawTask.job_id, rawTask.jobId, rawTask.id, `${batchNo}-${index}`))
      const inputPath = firstValue(rawTask.input_image, rawTask.inputImage, rawTask.input_image_url, rawTask.inputImageUrl)
      const filename = inputPath ? String(inputPath).split(/[/\\]/).pop() || jobId : files.value[index]?.name || jobId
      const taskStatus = firstValue(rawTask.status, rawTask.state, 'done')
      const met = normalizeCorrosionMetrics(rawTask.metrics)
      const inputUrl = inputUrls[filename] || getImageUrl(inputPath) || (files.value[index] ? URL.createObjectURL(files.value[index]) : '')
      const outputUrl = getResultImageUrl(rawTask)

      const existingTask = tasks.value.find((x) => x.id === jobId)
      if (existingTask) {
        existingTask.status = taskStatus
        existingTask.metrics = met
        existingTask.message = rawTask.error_msg || rawTask.errorMsg || (taskStatus === 'done' ? '完成' : '处理中')
      } else {
        tasks.value.unshift({
          id: jobId,
          filename,
          mode: 'batch',
          status: taskStatus,
          batchId: batchNo,
          batchOrder,
          metrics: met,
          message: rawTask.error_msg || rawTask.errorMsg,
        })
      }

      if (taskStatus === 'done' && outputUrl && !gallery.value.find((g) => g.id === jobId)) {
        if (!previewSrc.value) {
          previewSrc.value = outputUrl
          inputPreviewSrc.value = inputUrl
          metrics.value = met
        }
        void primeImageList([inputUrl, outputUrl])
        gallery.value.unshift({
          id: jobId,
          input: inputUrl,
          output: outputUrl,
          metrics: met,
          filename,
          batchId: batchNo,
          batchOrder,
        })
      }
    })

    const doneCount = numberOrUndefined(firstValue(batchInfo.processed_count, batchInfo.processedCount)) ?? taskList.length
    const totalCount = numberOrUndefined(firstValue(batchInfo.total_files, batchInfo.totalFiles)) ?? files.value.length
    pushLog(`批量检测成功: ${batchNo}, ${doneCount}/${totalCount}`)
  }

  const startDetect = async () => {
    if (!files.value.length) return
    busy.value = true
    progressText.value = '检测中...'
    try {
      const batchId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      batchSeq.value += 1
      const batchOrder = batchSeq.value
      currentBatchId.value = batchId

      if (files.value.length > 1) {
        previewSrc.value = ''
        metrics.value = {}
        const form = new FormData()
        const inputUrls: Record<string, string> = {}
        files.value.forEach((file) => {
          inputUrls[file.name] = URL.createObjectURL(file)
          form.append('files', file)
        })
        form.append('dataset_name', `Dataset ${batchId}`)

        const res = await $fetch<any>(`${getCorrosionApiBase()}/detect`, {
          method: 'POST',
          body: form,
          headers: getAuthHeaders(),
          credentials: 'include',
        })

        if (res?.success && res?.data) {
          handleBatchDetectResult(res.data, inputUrls, batchId, batchOrder)
        } else {
          const errorMsg = res?.message || '批量检测失败'
          progressText.value = errorMsg
          pushLog(`批量检测失败: ${errorMsg}`)
        }
        return
      }

      let done = 0

      for (const file of files.value) {
        const inputUrl = URL.createObjectURL(file)
        const taskId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
        tasks.value.unshift({ id: taskId, filename: file.name, mode: 'sync', status: 'running', batchId, batchOrder })

        const form = new FormData()
        form.append('file', file)

        try {
          const res = await $fetch<any>(`${getCorrosionApiBase()}/detect`, {
            method: 'POST',
            body: form,
            headers: getAuthHeaders(),
            credentials: 'include',
          })

          if (res?.success) {
            handleResult(res, inputUrl, file.name, taskId, batchId)
          } else {
            const errorMsg = res?.message || '检测失败'
            updateTask(taskId, { status: 'error', message: errorMsg })
            progressText.value = errorMsg
            pushLog(`检测失败: ${file.name} - ${errorMsg}`)
          }
        } catch (err: any) {
          const errorMsg = err?.data?.message || err?.message || '请求异常'
          updateTask(taskId, { status: 'error', message: errorMsg })
          progressText.value = err?.statusCode === 401 ? '认证失败，请重新登录' : errorMsg
          pushLog(`请求异常: ${file.name} - ${errorMsg}`)
        }

        done += 1
        progressText.value = `完成 ${done}/${files.value.length}`
      }
      progressText.value = '完成'
    } finally {
      busy.value = false
    }
  }

  const pollSingleJob = async (jobId: string, inputUrl: string, filename: string) => {
    const res = await $fetch<any>(`${getCorrosionApiBase()}/jobs/${jobId}`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    })
    const status = res?.status || 'pending'
    updateTask(jobId, { status: status === 'queued' ? 'pending' : status })

    if (status === 'done' && res?.result) {
      handleResult({ result: res.result }, inputUrl, filename, jobId)
      busy.value = false
      progressText.value = '队列任务完成'
      return
    }

    if (status === 'error') {
      const errorMsg = res?.message || '检测失败'
      updateTask(jobId, { status: 'error', message: errorMsg })
      busy.value = false
      progressText.value = errorMsg
      pushLog(`队列任务失败: ${filename} - ${errorMsg}`)
      return
    }

    if (isRunningStatus(status)) {
      progressText.value = '队列任务处理中...'
      setTimeout(() => pollSingleJob(jobId, inputUrl, filename), 2000)
    }
  }

  const startSingleQueue = async (file: File) => {
    const inputUrl = URL.createObjectURL(file)
    const form = new FormData()
    form.append('file', file)
    const res = await $fetch<any>(`${getCorrosionApiBase()}/enqueue`, {
      method: 'POST',
      body: form,
      headers: getAuthHeaders(),
      credentials: 'include',
    })

    if (!res?.success || !res?.job_id) {
      throw new Error(res?.message || '入队失败')
    }

    const jobId = res.job_id
    tasks.value.unshift({ id: jobId, filename: file.name, mode: 'queue', status: res.status || 'pending', message: res.message })
    pushLog(`单图任务已入队: ${jobId}`)
    progressText.value = '队列任务已提交...'
    await pollSingleJob(jobId, inputUrl, file.name)
  }

  const startBatchQueue = async () => {
    const form = new FormData()
    for (const file of files.value) form.append('files', file)

    const res = await $fetch<any>(`${getCorrosionApiBase()}/batch`, {
      method: 'POST',
      body: form,
      headers: getAuthHeaders(),
      credentials: 'include',
    })

    if (!res?.success || !res?.data?.batch_no) {
      throw new Error(res?.message || '批量提交失败')
    }

    const batchNo = res.data.batch_no
    const totalFiles = res.data.total_files || files.value.length
    batchSeq.value += 1
    const batchOrder = batchSeq.value
    currentBatchId.value = batchNo
    pushLog(`批量任务提交成功: ${batchNo} (共 ${totalFiles} 个文件)`)
    progressText.value = `批量处理中 (0/${totalFiles})...`

    const pollBatch = async () => {
      try {
        const batchRes = await $fetch<any>(`${getCorrosionApiBase()}/history/batches/${batchNo}`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        })

        if (batchRes?.success && batchRes?.data) {
          const info = batchRes.data.batch_info
          const taskList = batchRes.data.tasks || []
          progressText.value = `批量处理中 (${info.progress || '?'})...`

          taskList.forEach((t: any) => {
            const taskStatus = t.status === 'queued' ? 'pending' : t.status
            const met = t.metrics ? normalizeCorrosionMetrics(t.metrics) : undefined
            const existingTask = tasks.value.find((x) => x.id === t.job_id)

            if (existingTask) {
              existingTask.status = taskStatus
              existingTask.metrics = met
              existingTask.message = t.error_msg || (taskStatus === 'done' ? '完成' : '处理中')
            } else {
              tasks.value.unshift({
                id: t.job_id,
                filename: t.input_image ? t.input_image.split(/[/\\]/).pop() : `Task ${t.job_id}`,
                mode: 'batch',
                status: taskStatus,
                batchId: batchNo,
                batchOrder,
                metrics: met,
                message: t.error_msg,
              })
            }

            if (taskStatus === 'done' && !gallery.value.find((g) => g.id === t.job_id)) {
              const inputUrl = getImageUrl(t.input_image)
              const outputUrl = getImageUrl(t.output_image)
              if (outputUrl) {
                handleResult({ output_image_url: outputUrl, metrics: t.metrics }, inputUrl, t.input_image?.split(/[/\\]/).pop() || t.job_id, t.job_id, batchNo)
              }
            }
          })

          const allDone = taskList.length > 0 && taskList.every((t: any) => isTerminalStatus(t.status))
          if (['done', 'partial_error'].includes(info.status) || allDone) {
            progressText.value = info.status === 'partial_error' ? '批量处理完成(部分失败)' : '批量处理完成'
            pushLog(`批量任务结束: ${batchNo}`)
            busy.value = false
            return
          }
        }
      } catch (e) {
        console.error('轮询批次失败', e)
      }
      setTimeout(pollBatch, 2000)
    }

    pollBatch()
  }

  const startQueue = async () => {
    if (!files.value.length) return
    busy.value = true
    try {
      progressText.value = '正在提交任务...'
      if (files.value.length === 1) {
        await startSingleQueue(files.value[0])
      } else {
        await startBatchQueue()
      }
    } catch (error: any) {
      const errorMsg = error?.data?.message || error?.message || '请求异常'
      progressText.value = error?.statusCode === 401 ? '认证失败，请重新登录' : errorMsg
      pushLog(`任务提交异常: ${errorMsg}`)
      busy.value = false
    }
  }

  const fetchHistory = async (page: number = 1, limit: number = 10, type: 'single' | 'batch' | 'all' = 'all') => {
    historyLoading.value = true
    try {
      const res = await $fetch<any>(`${getCorrosionApiBase()}/history`, {
        method: 'GET',
        params: { page, limit, type },
        headers: getAuthHeaders(),
        credentials: 'include',
      })

      if (res?.success && res?.data) {
        historyList.value = (res.data.list || res.data.items || res.data.records || []).map(normalizeHistoryItem)
        void primeImageList(
          historyList.value.flatMap((item: any) => {
            if (item.type === 'batch') {
              return (item.thumbnail_urls || []).map((src: string) => getImageUrl(src))
            }
            return [getImageUrl(item.input_image), getImageUrl(item.output_image)]
          })
        )
        historyPage.value = res.data.page || page
        historyTotal.value = res.data.total || 0
        historyType.value = type
        pushLog(`历史记录加载成功: 第 ${page} 页，共 ${res.data.total} 条`)
      } else {
        pushLog('历史记录加载失败')
      }
    } catch (error: any) {
      const errorMsg = error?.data?.message || error?.message || '请求异常'
      pushLog(`历史记录请求异常: ${errorMsg}`)
    } finally {
      historyLoading.value = false
    }
  }

  const fetchBatchDetails = async (batchNo: string, statusFilter?: string) => {
    batchDetailsLoading.value = true
    try {
      const res = await $fetch<any>(`${getCorrosionApiBase()}/history/batches/${batchNo}`, {
        method: 'GET',
        params: statusFilter ? { status: statusFilter } : {},
        headers: getAuthHeaders(),
        credentials: 'include',
      })

      if (res?.success && res?.data) {
        batchDetails.value = normalizeBatchDetails(res.data)
        void primeImageList(
          batchDetails.value.tasks.flatMap((task: any) => [
            getImageUrl(task.input_image),
            getImageUrl(task.output_image)
          ])
        )
        pushLog(`批次详情加载成功: ${batchNo}`)
      } else {
        pushLog('批次详情加载失败')
      }
    } catch (error: any) {
      const errorMsg = error?.data?.message || error?.message || '请求异常'
      pushLog(`批次详情请求异常: ${errorMsg}`)
    } finally {
      batchDetailsLoading.value = false
    }
  }

  return {
    files,
    setFiles,
    busy,
    metrics,
    previewSrc,
    inputPreviewSrc,
    progressText,
    gallery,
    tasks,
    logs,
    currentBatchId,
    historyList,
    historyPage,
    historyTotal,
    historyLoading,
    historyType,
    batchDetails,
    batchDetailsLoading,
    fetchModels,
    startDetect,
    startQueue,
    fetchHistory,
    fetchBatchDetails,
  }
}
