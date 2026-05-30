<template>
  <div v-if="hasMulti" class="charts-container">
    <div class="chart-card">
      <div class="chart-header">
        <div>
          <h4>{{ activeMetric.label }} Top 5</h4>
          <p class="chart-subtitle">按当前批次图片的面积占比降序展示，悬浮可查看缩略图和详细数据。</p>
        </div>
        <div class="metric-switcher" role="tablist" aria-label="批次分析指标切换">
          <button
            v-for="option in metricOptions"
            :key="option.key"
            type="button"
            class="metric-btn"
            :class="{ active: selectedMetric === option.key }"
            @click="selectedMetric = option.key"
          >
            {{ option.shortLabel }}
          </button>
        </div>
      </div>

      <div class="chart-stage">
        <div class="chart-wrapper">
          <Bar ref="barChartRef" v-if="topItems.length" :data="barData" :options="barOptions" />
          <div v-else class="no-data">暂无可分析的批次数据</div>
        </div>

        <div class="tooltip-panel" :class="{ active: tooltipState.visible && tooltipState.item }">
          <template v-if="tooltipState.item">
            <img
              v-if="tooltipImageSrc"
              class="tooltip-image"
              :src="tooltipImageSrc"
              :alt="tooltipState.item.filename"
            />
            <div v-else class="tooltip-image placeholder">图片缓存中</div>
            <div class="tooltip-content">
              <div class="tooltip-title">{{ tooltipState.item.filename }}</div>
              <div class="tooltip-row">{{ activeMetric.label }}: {{ formatRatio(getMetricValue(tooltipState.item, selectedMetric)) }}</div>
              <div class="tooltip-row">锈蚀面积占比: {{ formatRatio(tooltipState.item.metrics?.corrosion_area_ratio) }}</div>
              <div class="tooltip-row">锈斑面积占比: {{ formatRatio(tooltipState.item.metrics?.rust_spots_area_ratio) }}</div>
              <div class="tooltip-row">整体面积占比: {{ formatRatio(tooltipState.item.metrics?.total_area_ratio ?? tooltipState.item.metrics?.area_ratio) }}</div>
            </div>
          </template>
          <div v-else class="tooltip-empty">将鼠标移动到条形上查看图片和具体数据</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip
} from 'chart.js'
import type { ChartOptions, TooltipModel } from 'chart.js'
import { Bar } from 'vue-chartjs'
import { getCachedImageSrc, primeImageCache, primeImageList } from '~/composables/useImageCache'

interface ChartItemMetrics {
  corrosion_area_ratio?: number
  rust_spots_area_ratio?: number
  total_area_ratio?: number
  area_ratio?: number
}

interface ChartItem {
  id?: string
  filename: string
  input?: string
  output?: string
  metrics?: ChartItemMetrics
}

type MetricKey = 'corrosion' | 'rust_spots' | 'total'

const props = defineProps<{ items: ChartItem[] }>()

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const barChartRef = ref<any>(null)
const selectedMetric = ref<MetricKey>('total')

const metricOptions: Array<{ key: MetricKey; label: string; shortLabel: string; color: string }> = [
  { key: 'corrosion', label: '锈蚀面积占比', shortLabel: '锈蚀', color: '#e45757' },
  { key: 'rust_spots', label: '锈斑面积占比', shortLabel: '锈斑', color: '#f59e0b' },
  { key: 'total', label: '整体面积占比', shortLabel: '总面积', color: '#3467eb' }
]

const tooltipState = reactive<{
  visible: boolean
  item: ChartItem | null
}>({
  visible: false,
  item: null
})

const items = computed(() => props.items || [])
const hasMulti = computed(() => items.value.length > 1)
const activeMetric = computed(() => metricOptions.find((option) => option.key === selectedMetric.value) || metricOptions[2])

const formatRatio = (value?: number) => (typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : '-')

const getMetricValue = (item: ChartItem, metric: MetricKey) => {
  if (metric === 'corrosion') return item.metrics?.corrosion_area_ratio ?? 0
  if (metric === 'rust_spots') return item.metrics?.rust_spots_area_ratio ?? 0
  return item.metrics?.total_area_ratio ?? item.metrics?.area_ratio ?? 0
}

const getTooltipSource = (item?: ChartItem | null) => {
  if (!item) return ''
  return item.output || item.input || ''
}

const topItems = computed(() => {
  return [...items.value]
    .sort((a, b) => getMetricValue(b, selectedMetric.value) - getMetricValue(a, selectedMetric.value))
    .slice(0, 5)
})

const tooltipImageSrc = computed(() => {
  const src = getTooltipSource(tooltipState.item)
  return src ? getCachedImageSrc(src) : ''
})

watch(
  () => items.value,
  (list) => {
    void primeImageList(list.flatMap((item) => [item.output, item.input]))
  },
  { immediate: true, deep: true }
)

watch(topItems, (list) => {
  void primeImageList(list.flatMap((item) => [item.output, item.input]))
}, { immediate: true })

defineExpose({
  getChartImages: () => {
    return {
      pie: undefined,
      bar: barChartRef.value?.chart?.toBase64Image()
    }
  }
})

const barData = computed(() => ({
  labels: topItems.value.map((item, index) => {
    const name = item.filename || `图片 ${index + 1}`
    return name.length > 20 ? `${name.slice(0, 20)}...` : name
  }),
  datasets: [
    {
      label: activeMetric.value.label,
      backgroundColor: activeMetric.value.color,
      borderRadius: 10,
      borderSkipped: false,
      maxBarThickness: 26,
      data: topItems.value.map((item) => Number((getMetricValue(item, selectedMetric.value) * 100).toFixed(2)))
    }
  ]
}))

const setTooltipState = (tooltip: TooltipModel<'bar'>) => {
  if (!tooltip.opacity || !tooltip.dataPoints?.length) {
    tooltipState.visible = false
    tooltipState.item = null
    return
  }

  const dataIndex = tooltip.dataPoints[0]?.dataIndex ?? -1
  const item = topItems.value[dataIndex]
  if (!item) {
    tooltipState.visible = false
    tooltipState.item = null
    return
  }

  tooltipState.visible = true
  tooltipState.item = item
  void primeImageCache(getTooltipSource(item))
}

const barOptions = computed<ChartOptions<'bar'>>(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 280
  },
  interaction: {
    mode: 'nearest',
    intersect: true
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      enabled: false,
      external: ({ tooltip }) => setTooltipState(tooltip)
    }
  },
  scales: {
    x: {
      beginAtZero: true,
      max: 100,
      grid: {
        color: 'rgba(148, 163, 184, 0.18)'
      },
      ticks: {
        callback: (value) => `${value}%`
      },
      title: {
        display: true,
        text: '面积占比'
      }
    },
    y: {
      grid: {
        display: false
      }
    }
  }
}))
</script>

<style scoped>
.charts-container {
  margin-top: 1rem;
}

.chart-card {
  background: var(--card);
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 420px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.chart-card h4 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--text-main);
}

.chart-subtitle {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
  font-size: 0.92rem;
}

.metric-switcher {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.metric-btn {
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-main);
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.18s ease;
}

.metric-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.chart-wrapper {
  flex: 1 1 auto;
  position: relative;
  min-height: 320px;
}

.chart-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 1rem;
  align-items: stretch;
  flex: 1;
  min-height: 320px;
}

.tooltip-panel {
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 14px;
  background: rgba(17, 24, 39, 0.9);
  color: #f8fafc;
  padding: 0.75rem;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.24);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 320px;
}

.tooltip-panel.active {
  border-color: rgba(96, 165, 250, 0.45);
}

.tooltip-image {
  width: 100%;
  height: 148px;
  border-radius: 10px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.08);
  margin-bottom: 0.75rem;
}

.tooltip-image.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(248, 250, 252, 0.72);
  font-size: 0.9rem;
}

.tooltip-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tooltip-title {
  font-size: 0.88rem;
  font-weight: 600;
  word-break: break-all;
}

.tooltip-row {
  font-size: 0.8rem;
  line-height: 1.35;
  color: rgba(248, 250, 252, 0.9);
}

.tooltip-empty {
  color: rgba(248, 250, 252, 0.72);
  font-size: 0.92rem;
  line-height: 1.5;
}

.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 0.95rem;
}

@media (max-width: 768px) {
  .chart-card {
    min-height: 480px;
  }

  .chart-stage {
    grid-template-columns: 1fr;
  }

  .tooltip-panel {
    min-height: auto;
  }
}
</style>
