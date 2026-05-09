<script setup lang="ts">
import ImageNamingDialog from './components/ImageNamingDialog.vue'
import PendingQueuePanelImproved from './components/PendingQueuePanelImproved.vue'
import { usePendingQueue } from '../../composables/usePendingQueue'
import { createDetectionTask, getDetectionTask, getDetectionSignedUrl } from '../../api/detections'
import type { DetectionTaskItem } from '../../types/detection'

const { queue, addToQueue, updateQueueItem, removeFromQueue, clearCompletedItems } = usePendingQueue()

const namingDialogVisible = ref(false)
const currentFile = ref<File | null>(null)
const currentFilePreview = ref<string>('')
const uploadFileListRef = ref<any>(null)
const batchUploadLoading = ref(false)

function handleFileSelect(files: FileList | null) {
  if (!files || files.length === 0) return
  const validFiles: File[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file.type.startsWith('image/')) {
      ElMessage.warning(`${file.name} 不是有效的图像文件，已跳过`)
      continue
    }
    if (file.size > 50 * 1024 * 1024) {
      ElMessage.warning(`${file.name} 文件过大，已跳过`)
      continue
    }
    validFiles.push(file)
  }
  if (validFiles.length === 0) {
    ElMessage.warning('没有有效的图像文件')
    return
  }
  // 仅处理第一张，用户可以多次添加
  const file = validFiles[0]
  const reader = new FileReader()
  reader.onload = (e) => {
    currentFile.value = file
    currentFilePreview.value = (e.target?.result as string) || ''
    namingDialogVisible.value = true
  }
  reader.readAsDataURL(file)
}

function handleDrop(e: DragEvent) { e.preventDefault(); e.stopPropagation(); handleFileSelect(e.dataTransfer?.files || null) }
function handleDragOver(e: DragEvent) { e.preventDefault(); e.stopPropagation() }

function handleNamingConfirm(data: { customName: string; formData: any }) {
  if (!currentFile.value) return
  const queueItem = {
    file: currentFile.value,
    customName: data.customName,
    imagePreview: currentFilePreview.value,
    formData: { ...data.formData, inferenceMode: 'local' }
  }
  addToQueue(queueItem as any)
  ElMessage.success('已添加到待检测列表')
  currentFile.value = null
  currentFilePreview.value = ''
  if (uploadFileListRef.value) uploadFileListRef.value.value = ''
}

async function uploadQueueItem(item: any) {
  if (!item.file) {
    updateQueueItem(item.id, { status: 'failed', errorMessage: '文件已失效' })
    ElMessage.warning(`${item.customName} 文件已失效`)
    return
  }
  updateQueueItem(item.id, { status: 'uploading' })
  try {
    const task = await createDetectionTask(item.file, item.formData, (p: number) => {
      updateQueueItem(item.id, { uploadProgress: p })
    })
    const taskId = task.data?.id ?? task.id ?? String(task)
    updateQueueItem(item.id, { status: 'done', uploadProgress: 100, taskId: String(taskId), errorMessage: undefined })

    // fetch task detail and signed url
    try {
      const detail = await getDetectionTask(taskId)
      const signed = await getDetectionSignedUrl(taskId)
      const current: DetectionTaskItem = detail.data ?? detail
      if (signed.data) {
        current.imageSignedUrl = signed.data.imageSignedUrl || signed.data.imageSignedUrl
        current.processedImageSignedUrl = signed.data.imageSignedUrl || current.processedImageSignedUrl
      }
      // show success message
      ElMessage.success(`${item.customName} 已提交并返回任务 ${taskId}`)
    } catch (e) {
      // 忽略细节请求失败
      console.warn('fetch detail failed', e)
    }
  } catch (error) {
    const message = (error as Error).message || '上传失败'
    updateQueueItem(item.id, { status: 'failed', errorMessage: message })
    ElMessage.error(`${item.customName} ${message}`)
  }
}

async function uploadAll() {
  const pendingItems = queue.value.filter(item => item.status === 'pending')
  if (pendingItems.length === 0) { ElMessage.info('没有待上传的项'); return }
  batchUploadLoading.value = true
  try {
    for (let i = 0; i < pendingItems.length; i++) {
      await uploadQueueItem(pendingItems[i])
      await new Promise(r => setTimeout(r, 200))
    }
    ElMessage.success('批量上传完成')
  } finally {
    batchUploadLoading.value = false
  }
}

function handleRemoveQueueItem(id: string) { removeFromQueue(id) }

function handleViewResult(taskId: string) {
  // 跳转或打开任务详情页，如果需要可以实现
  ElMessage.info(`查看任务 ${taskId}`)
}

</script>

<template>
  <section class="detection-page">
    <ImageNamingDialog v-model="namingDialogVisible" :file="currentFile" :image-preview="currentFilePreview" @confirm="handleNamingConfirm" />

    <div class="detection-container">
      <div class="left-panel">
        <el-card shadow="never" class="upload-card">
          <template #header>
            <div class="card-header"><h3>上传图片（迁移版）</h3></div>
          </template>
          <div class="upload-area" @drop="handleDrop" @dragover="handleDragOver">
            <p>拖拽图片至此或点击上传</p>
            <input ref="uploadFileListRef" type="file" multiple accept="image/*" style="display:none" @change="(e) => handleFileSelect((e.target as HTMLInputElement).files)" />
            <el-button type="primary" @click="uploadFileListRef?.click()">选择图片</el-button>
          </div>
          <p class="format-hint">支持 JPG、PNG，单个文件不超过50MB</p>
        </el-card>

        <el-card shadow="never" class="queue-card">
          <template #header><div class="card-header"><h3>待检测列表</h3><span class="queue-count">{{ queue.length }}</span></div></template>
          <PendingQueuePanelImproved :queue="queue" :isProcessing="batchUploadLoading" @uploadItem="uploadQueueItem" @removeItem="handleRemoveQueueItem" @uploadAll="uploadAll" @clearCompleted="clearCompletedItems" @viewResult="handleViewResult" />
        </el-card>
      </div>

      <div class="right-panel">
        <el-card shadow="never" class="result-card">
          <template #header><div class="card-header"><h3>当前任务（选择后显示）</h3></div></template>
          <div class="result-content">
            <el-empty description="请在左侧选择或上传图片并上传以查看结果" />
          </div>
        </el-card>
      </div>
    </div>
  </section>
</template>

<style scoped>
.detection-container { display:grid; grid-template-columns:2fr 3fr; gap:20px; max-width:1200px; margin:0 auto }
.upload-card, .queue-card, .result-card { border-radius:12px; overflow:hidden }
.upload-area { border:2px dashed var(--el-border-color-light); border-radius:12px; padding:20px; text-align:center }
.format-hint { margin-top:12px; font-size:12px; color:#9ca3af }
.queue-count { margin-left:auto; padding:4px 12px; background-color:var(--el-color-primary); color:#fff; border-radius:12px }

</style>
