<!--
组件名称：CorrosionPanel
功能说明：锈蚀检测前端界面（上传、任务提交、结果展示），调用锈蚀检测后端。
-->
<template>
  <div class="stack">
    <div class="page-card" style="background: var(--card);">
      <h3 class="card-title">上传</h3>
      <p class="card-sub">选择图片后使用后端默认模型与默认参数检测。</p>
      <div class="upload-panel">
        <div class="upload-actions">
          <label class="btn">
            <input type="file" accept="image/*" multiple hidden @change="onFilesChange" />
            选择图像
          </label>
          <div class="progress-text">{{ progressText }}</div>
          <div class="action-row">
            <button class="btn" :disabled="busy || !files.length" @click="startDetect">同步检测</button>
            <button class="btn secondary" :disabled="busy || !files.length" @click="startQueue">
              {{ files.length > 1 ? '批量入队' : '单图入队' }}
            </button>
            <button class="ghost-btn" @click="goHistory">历史记录</button>
            <button class="ghost-btn" @click="goLogs">日志</button>
            <span v-if="busy" class="muted">处理中...</span>
          </div>
        </div>
        <div class="thumb-row" v-if="visibleGallery.length || inputPreviewSrc">
          <div class="thumb current" :class="{ active: !visibleGallery.length }" v-if="inputPreviewSrc">
            <CachedImage :src="inputPreviewSrc" alt="输入预览" />
            <div class="thumb-label">当前输入</div>
          </div>
          <div v-for="item in visibleGallery" :key="item.id" class="thumb" @click="selectThumb(item)">
            <CachedImage :src="item.output" :alt="item.filename" />
            <div class="thumb-label">{{ item.filename }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="page-card" style="background: var(--card);">
      <div class="results-header">
        <div>
          <h3 class="card-title">结果预览</h3>
          <p class="card-sub">输入/输出对比与统计指标。</p>
        </div>
        <div class="link-row">
          <button type="button" class="ghost-btn" @click="handleExport" :disabled="!canExport">导出报告</button>
          <button type="button" class="ghost-btn" @click="goHistory">历史记录</button>
          <button type="button" class="ghost-btn" @click="goLogs">日志</button>
        </div>
      </div>
      <div class="preview-pair">
        <div class="preview-box">
          <div class="preview-title">输入图</div>
          <div class="preview-content">
            <CachedImage v-if="inputPreviewSrc" :src="inputPreviewSrc" alt="输入图" />
            <div v-else class="placeholder-box">等待选择图片</div>
          </div>
        </div>
        <div class="preview-box">
          <div class="preview-title">输出（标注结果）</div>
          <div class="preview-content">
            <CachedImage v-if="previewSrc" :src="previewSrc" alt="检测结果" />
            <div v-else class="placeholder-box">等待检测结果</div>
          </div>
        </div>
      </div>
      <div class="metrics-grid">
        <div class="placeholder-box">锈蚀数量: {{ metrics.corrosion_count ?? '-' }}</div>
        <div class="placeholder-box">锈斑数量: {{ metrics.rust_spots_count ?? '-' }}</div>
        <div class="placeholder-box">总数量: {{ metrics.total_count ?? metrics.count ?? '-' }}</div>
        <div class="placeholder-box">锈蚀面积占比: {{ formatRatio(metrics.corrosion_area_ratio) }}</div>
        <div class="placeholder-box">锈斑面积占比: {{ formatRatio(metrics.rust_spots_area_ratio) }}</div>
        <div class="placeholder-box">整体面积占比: {{ formatRatio(metrics.total_area_ratio ?? metrics.area_ratio) }}</div>
        <div class="placeholder-box">锈蚀平均置信度: {{ formatConf(metrics.corrosion_avg_conf) }}</div>
        <div class="placeholder-box">锈斑平均置信度: {{ formatConf(metrics.rust_spots_avg_conf) }}</div>
        <div class="placeholder-box">整体平均置信度: {{ formatConf(metrics.total_avg_conf ?? metrics.avg_conf) }}</div>
      </div>
      <div class="area-breakdown" v-if="hasAreaBreakdown">
        <div class="area-breakdown-header">
          <span class="area-breakdown-title">当前图片面积占比分布</span>
          <span class="area-breakdown-total">总异常: {{ formatRatio(areaBreakdown.totalAbnormal) }}</span>
        </div>
        <div class="area-breakdown-bar" aria-label="面积占比分布">
          <div
            v-for="segment in areaBreakdown.segments"
            :key="segment.key"
            class="area-breakdown-segment"
            :class="`segment-${segment.key}`"
            :style="{ width: `${segment.ratio * 100}%` }"
          />
        </div>
        <div class="area-breakdown-legend">
          <div v-for="segment in areaBreakdown.segments" :key="segment.key" class="legend-item">
            <span class="legend-dot" :class="`segment-${segment.key}`" />
            <span class="legend-label">{{ segment.label }}</span>
            <span class="legend-value">{{ formatRatio(segment.ratio) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="visibleGallery.length > 1"
      class="page-card"
      style="background: var(--card);"
    >
      <h3 class="card-title">数据分析</h3>
      <p class="card-sub">基于当前检测结果的统计图表。</p>
      <CorrosionDetectionCorrosionCharts
        ref="chartsRef"
        :items="visibleGallery"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCorrosion } from '~/composables/useCorrosion'
import { primeImageList } from '~/composables/useImageCache'
import { generatePDFReport } from '~/utils/pdfExport'

const chartsRef = ref<any>(null)

const {
  files,
  setFiles,
  busy,
  metrics,
  previewSrc,
  inputPreviewSrc,
  progressText,
  gallery,
  startDetect,
  startQueue,
  currentBatchId
} = useCorrosion()

const router = useRouter()
const goHistory = () => router.push('/corrosion/history')
const goLogs = () => router.push('/corrosion/logs')

const canExport = computed(() => {
  return visibleGallery.value.length > 0 || (!!inputPreviewSrc.value && !!previewSrc.value)
})

const handleExport = async () => {
  if (!canExport.value) return
  let chartImages = undefined
  if (visibleGallery.value.length > 1 && chartsRef.value) {
    chartImages = chartsRef.value.getChartImages()
  }

  const reportItems = visibleGallery.value.length
    ? visibleGallery.value
    : [{
        id: 'current-preview',
        input: inputPreviewSrc.value,
        output: previewSrc.value,
        metrics: metrics.value,
        filename: files.value[0]?.name || 'current-result.png'
      }]

  await generatePDFReport(reportItems, chartImages)
}

const onFilesChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files) {
    setFiles(Array.from(input.files))
  }
}

const latestBatchId = computed(() => {
  if (currentBatchId.value) return currentBatchId.value
  const first = gallery.value[0]
  if (first?.batchId) return first.batchId
  return gallery.value.length ? '__legacy__' : ''
})

const visibleGallery = computed(() => {
  const bid = latestBatchId.value
  if (!bid) return []
  if (bid === '__legacy__') return gallery.value
  return gallery.value.filter((g) => g.batchId === bid)
})

watch(
  [visibleGallery, inputPreviewSrc, previewSrc],
  ([list, inputSrc, outputSrc]) => {
    const sources = [
      inputSrc,
      outputSrc,
      ...list.flatMap((item) => [item.input, item.output])
    ]
    void primeImageList(sources)
  },
  { immediate: true }
)

const areaBreakdown = computed(() => {
  const corrosion = clampRatio(metrics.value.corrosion_area_ratio)
  const rustSpots = clampRatio(metrics.value.rust_spots_area_ratio)
  const totalAbnormal = clampRatio(metrics.value.total_area_ratio ?? metrics.value.area_ratio)
  const normal = clampRatio(1 - totalAbnormal)

  return {
    totalAbnormal,
    segments: [
      { key: 'corrosion', label: '锈蚀', ratio: corrosion },
      { key: 'rust-spots', label: '锈斑', ratio: rustSpots },
      { key: 'normal', label: '正常', ratio: normal }
    ]
  }
})

const hasAreaBreakdown = computed(() => {
  return areaBreakdown.value.segments.some((segment) => segment.ratio > 0)
})

const selectThumb = (item: typeof gallery.value[number]) => {
  if (!item) return
  previewSrc.value = item.output
  inputPreviewSrc.value = item.input
  metrics.value = item.metrics
  if (item.batchId) currentBatchId.value = item.batchId
}

const clampRatio = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}

const formatRatio = (v?: number) => (typeof v === 'number' ? `${(v * 100).toFixed(2)}%` : '-')
const formatConf = (v?: number) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '-')
</script>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.top-row {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 12px;
}
.upload-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.upload-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.action-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.progress-text {
  color: var(--muted);
  font-size: 13px;
}
.text-link {
  color: var(--accent);
  font-size: 13px;
}
.ghost-btn {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
}
.ghost-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.muted {
  color: var(--muted);
  font-size: 13px;
}
.thumb-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}
.thumb {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--card);
  cursor: pointer;
}
.thumb.current {
  border: 2px solid var(--accent);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.08);
}
.thumb img {
  width: 100%;
  height: 110px;
  object-fit: cover;
  display: block;
}
.thumb-label {
  position: absolute;
  left: 8px;
  bottom: 6px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 6px;
}
.thumb.active {
  outline: 2px solid var(--accent);
}
.preview-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.preview-box {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px;
  background: var(--card);
}
.preview-title {
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 6px;
}
.preview-content {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.preview-content img {
  width: 100%;
  max-height: 480px;
  object-fit: contain;
}
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(160px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.area-breakdown {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.28);
}
.area-breakdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.area-breakdown-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.area-breakdown-total {
  font-size: 12px;
  color: var(--muted);
}
.area-breakdown-bar {
  width: 100%;
  height: 18px;
  display: flex;
  overflow: hidden;
  border-radius: 999px;
  background: #e8edf8;
  border: 1px solid var(--border);
}
.area-breakdown-segment {
  height: 100%;
  min-width: 0;
}
.segment-corrosion {
  background: linear-gradient(90deg, #b45309, #d97706);
}
.segment-rust-spots {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}
.segment-normal {
  background: linear-gradient(90deg, #cbd5e1, #e2e8f0);
}
.area-breakdown-legend {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.35);
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex-shrink: 0;
}
.legend-label {
  font-size: 13px;
  color: var(--text);
}
.legend-value {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}
.classification-result {
  background: linear-gradient(135deg, rgba(25, 118, 210, 0.1), rgba(25, 118, 210, 0.05));
  border: 2px solid rgba(25, 118, 210, 0.3);
  font-weight: 600;
}
.classification-conf {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05));
  border: 2px solid rgba(76, 175, 80, 0.3);
  font-weight: 600;
}
.param-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}
.param-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.param-block.full {
  grid-column: 1 / -1;
}
.param-label {
  color: var(--muted);
  font-size: 13px;
}
.param-input {
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
}
@media (max-width: 960px) {
  .top-row {
    grid-template-columns: 1fr;
  }
  .preview-pair {
    grid-template-columns: 1fr;
  }
  .metrics-grid {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }
  .area-breakdown-legend {
    grid-template-columns: 1fr;
  }
}
</style>
