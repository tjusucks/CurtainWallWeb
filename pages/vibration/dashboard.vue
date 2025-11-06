<template>
  <div class="dashboard-container">
    <!-- 顶部导航 -->
    <div class="header-nav">
      <h1 class="page-title">设备监控仪表盘</h1>
      <el-button type="primary" @click="backToMain" class="back-btn">返回主页</el-button>
    </div>

    <!-- 上半部分：秒级数据展示 -->
    <div class="top-section">
      <!-- 左侧：秒级数据图表 (占3/4) -->
      <div class="chart-section">
        <div class="section-header">
          <h2>实时监控数据（一小时内）</h2>
          <div class="device-selector">
            <el-select v-model="selectedCategory" placeholder="选择设备地点" @change="fetchDevices">
              <el-option label="安楼外幕墙1" value="安楼外幕墙1"></el-option>
              <el-option label="安楼外幕墙2" value="安楼外幕墙2"></el-option>
              <el-option label="衷和楼" value="衷和楼"></el-option>
            </el-select>
            <el-select v-model="selectedDevice" placeholder="选择设备" class="ml-4" @change="onDeviceChange">
              <el-option
                v-for="device in filteredDevices"
                :key="device.device_name"
                :label="device.device_name"
                :value="device.device_name"
              />
            </el-select>
          </div>
        </div>
        
        <!-- 实时数据多图表卡片 -->
        <div class="chart-tabs">
          <!-- 标签页导航 -->
          <div class="tab-nav">
            <!-- 加速度计标签页 -->
            <template v-if="currentDeviceInfo.type === 'accelerometer'">
              <button 
                v-for="tab in accelerometerTabs" 
                :key="tab.key"
                :class="['tab-button', { active: activeRealtimeTab === tab.key }]"
                @click="switchRealtimeTab(tab.key)"
              >
                {{ tab.label }}
              </button>
            </template>
            
            <!-- 应变计标签页 -->
            <template v-if="currentDeviceInfo.type === 'strainGauge'">
              <button 
                v-for="tab in strainGaugeTabs" 
                :key="tab.key"
                :class="['tab-button', { active: activeRealtimeTab === tab.key }]"
                @click="switchRealtimeTab(tab.key)"
              >
                {{ tab.label }}
              </button>
            </template>
          </div>
          
          <!-- 图表容器 -->
          <div class="tab-content">
            <!-- 加速度计图表 -->
            <template v-if="currentDeviceInfo.type === 'accelerometer'">
              <div v-show="activeRealtimeTab === 'x'" id="realtime-chart-x" class="chart-container"></div>
              <div v-show="activeRealtimeTab === 'y'" id="realtime-chart-y" class="chart-container"></div>
              <div v-show="activeRealtimeTab === 'z'" id="realtime-chart-z" class="chart-container"></div>
              <div v-show="activeRealtimeTab === 'all'" id="realtime-chart-all" class="chart-container"></div>
            </template>
            
            <!-- 应变计图表 -->
            <template v-if="currentDeviceInfo.type === 'strainGauge'">
              <div v-show="activeRealtimeTab === 'ch1'" id="realtime-chart-ch1" class="chart-container"></div>
              <div v-show="activeRealtimeTab === 'ch2'" id="realtime-chart-ch2" class="chart-container"></div>
              <div v-show="activeRealtimeTab === 'all'" id="realtime-chart-strain-all" class="chart-container"></div>
            </template>
          </div>
        </div>
      </div>

      <!-- 右侧：设备详细信息 (占1/4) -->
      <div class="info-section">
        <div class="info-card">
          <h3>设备信息</h3>
          <div class="info-content">
            <div class="info-item">
              <span class="info-label">设备名称：</span>
              <span class="info-value">{{ currentDeviceInfo.name }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">设备位置：</span>
              <span class="info-value">{{ currentDeviceInfo.location }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">传感器类型：</span>
              <span class="info-value">
                <el-tag :type="currentDeviceInfo.type === 'accelerometer' ? 'primary' : 'warning'">
                  {{ currentDeviceInfo.typeLabel }}
                </el-tag>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">设备状态：</span>
              <span class="info-value">
                <el-tag :type="deviceStatus.online ? 'success' : 'danger'">
                  {{ deviceStatus.online ? '在线' : '离线' }}
                </el-tag>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">最后更新：</span>
              <span class="info-value">{{ deviceStatus.lastUpdate }}</span>
            </div>
          </div>
          
          <!-- 阈值信息 -->
          <h3 class="mt-4">阈值信息</h3>
          <div class="threshold-info">
            <!-- 加速度计阈值显示 -->
            <div v-if="currentDeviceInfo.type === 'accelerometer'">
              <div class="threshold-group">
                <h4>加速度阈值</h4>
                <div class="threshold-item">
                  <span class="threshold-label">X轴阈值：</span>
                  <span class="threshold-value">{{ thresholds.x_limit }}</span>
                </div>
                <div class="threshold-item">
                  <span class="threshold-label">Y轴阈值：</span>
                  <span class="threshold-value">{{ thresholds.y_limit }}</span>
                </div>
                <div class="threshold-item">
                  <span class="threshold-label">Z轴阈值：</span>
                  <span class="threshold-value">{{ thresholds.z_limit }}</span>
                </div>
              </div>
            </div>
            
            <!-- 应变计阈值显示 -->
            <div v-else-if="currentDeviceInfo.type === 'strainGauge'">
              <div class="threshold-group">
                <h4>应变阈值</h4>
                <div class="threshold-item">
                  <span class="threshold-label">Ch1阈值：</span>
                  <span class="threshold-value">{{ thresholds.ch1_limit }}</span>
                </div>
                <div class="threshold-item">
                  <span class="threshold-label">Ch2阈值：</span>
                  <span class="threshold-value">{{ thresholds.ch2_limit }}</span>
                </div>
              </div>
            </div>
            
            <!-- 通用告警阈值 -->
            <div class="threshold-group">
              <h4>告警阈值</h4>
              <div class="threshold-item">
                <span class="threshold-label">邮件告警：</span>
                <span class="threshold-value">{{ thresholds.email_limit }}</span>
              </div>
              <div class="threshold-item">
                <span class="threshold-label">短信告警：</span>
                <span class="threshold-value">{{ thresholds.message_limit }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 下半部分：月级数据和异常记录 -->
    <div class="bottom-section">
      <!-- 左侧：月级数据图表 -->
      <div class="chart-section">
        <div class="section-header">
          <h2>历史趋势数据（月级）</h2>
          <el-date-picker
            v-model="monthRange"
            type="monthrange"
            range-separator="至"
            start-placeholder="开始月份"
            end-placeholder="结束月份"
            @change="onMonthRangeChange"
          />
        </div>
        
        <!-- 月级数据多图表卡片 -->
        <div class="chart-tabs">
          <!-- 标签页导航 -->
          <div class="tab-nav">
            <!-- 加速度计标签页 -->
            <template v-if="currentDeviceInfo.type === 'accelerometer'">
              <button 
                v-for="tab in accelerometerTabs" 
                :key="tab.key"
                :class="['tab-button', { active: activeMonthlyTab === tab.key }]"
                @click="switchMonthlyTab(tab.key)"
              >
                {{ tab.label }}
              </button>
            </template>
            
            <!-- 应变计标签页 -->
            <template v-if="currentDeviceInfo.type === 'strainGauge'">
              <button 
                v-for="tab in strainGaugeTabs" 
                :key="tab.key"
                :class="['tab-button', { active: activeMonthlyTab === tab.key }]"
                @click="switchMonthlyTab(tab.key)"
              >
                {{ tab.label }}
              </button>
            </template>
          </div>
          
          <!-- 图表容器 -->
          <div class="tab-content">
            <!-- 加速度计图表 -->
            <template v-if="currentDeviceInfo.type === 'accelerometer'">
              <div v-show="activeMonthlyTab === 'x'" id="monthly-chart-x" class="chart-container"></div>
              <div v-show="activeMonthlyTab === 'y'" id="monthly-chart-y" class="chart-container"></div>
              <div v-show="activeMonthlyTab === 'z'" id="monthly-chart-z" class="chart-container"></div>
              <div v-show="activeMonthlyTab === 'all'" id="monthly-chart-all" class="chart-container"></div>
            </template>
            
            <!-- 应变计图表 -->
            <template v-if="currentDeviceInfo.type === 'strainGauge'">
              <div v-show="activeMonthlyTab === 'ch1'" id="monthly-chart-ch1" class="chart-container"></div>
              <div v-show="activeMonthlyTab === 'ch2'" id="monthly-chart-ch2" class="chart-container"></div>
              <div v-show="activeMonthlyTab === 'all'" id="monthly-chart-strain-all" class="chart-container"></div>
            </template>
          </div>
        </div>
      </div>

      <!-- 右侧：异常数据记录 -->
      <div class="abnormal-section">
        <div class="abnormal-card">
          <h3>异常数据记录</h3>
          <div class="abnormal-filter">
            <el-select v-model="abnormalFilter.direction" placeholder="选择方向" size="small" @change="fetchAbnormalData">
              <el-option label="全部" value="all" />
              <!-- 动态显示选项根据传感器类型 -->
              <template v-if="currentDeviceInfo.type === 'accelerometer'">
                <el-option label="X轴超过最大值" value="x_above_max" />
                <el-option label="X轴低于最小值" value="x_below_min" />
                <el-option label="Y轴超过最大值" value="y_above_max" />
                <el-option label="Y轴低于最小值" value="y_below_min" />
                <el-option label="Z轴超过最大值" value="z_above_max" />
                <el-option label="Z轴低于最小值" value="z_below_min" />
              </template>
              <template v-else-if="currentDeviceInfo.type === 'strainGauge'">
                <el-option label="Ch1超过最大值" value="ch1_above_max" />
                <el-option label="Ch1低于最小值" value="ch1_below_min" />
                <el-option label="Ch2超过最大值" value="ch2_above_max" />
                <el-option label="Ch2低于最小值" value="ch2_below_min" />
              </template>
            </el-select>
          </div>
          
          <div class="abnormal-list" v-loading="abnormalLoading">
            <el-scrollbar height="300px">
              <div v-if="abnormalData.length === 0" class="no-data">
                <el-empty description="暂无异常数据" />
              </div>
              <div v-else>
                <div 
                  v-for="(item, index) in abnormalData" 
                  :key="index" 
                  :class="getAbnormalItemClass(item)"
                >
                  <div class="abnormal-header">
                    <span class="abnormal-time">{{ formatTime(item.time) }}</span>
                    <div class="abnormal-tags">
                      <!-- 警告级别标签 -->
                      <el-tag 
                        :type="getAlarmLevelTagType(item)" 
                        size="small"
                        class="alarm-level-tag"
                      >
                        {{ getAlarmLevelLabel(item) }}
                      </el-tag>
                      <!-- 方向标签 -->
                      <el-tag :type="getDirectionTagType(item.direction)" size="small">
                        {{ getDirectionLabel(item.direction) }}
                      </el-tag>
                    </div>
                  </div>
                  <div class="abnormal-content">
                    <span class="data-value">{{ item.data.toFixed(6) }}</span>
                    <span class="threshold-range">
                      (阈值: {{ item.min }} ~ {{ item.max }})
                    </span>
                  </div>
                </div>
              </div>
            </el-scrollbar>
          </div>
          
          <div class="abnormal-footer">
            <el-button type="text" size="small" @click="goToAbnormalPage">
              查看更多 <el-icon><ArrowRight /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { ArrowRight } from '@element-plus/icons-vue'
import axios from 'axios'

const router = useRouter()
const API_BASE_URL = 'http://110.42.214.164:8009'

// 标签页相关
const activeRealtimeTab = ref('all') // 实时数据标签页
const activeMonthlyTab = ref('all')  // 月级数据标签页

// 定义标签页配置
const accelerometerTabs = [
  { key: 'all', label: '全部(XYZ)' },
  { key: 'x', label: 'X轴' },
  { key: 'y', label: 'Y轴' },
  { key: 'z', label: 'Z轴' }
]

const strainGaugeTabs = [
  { key: 'all', label: '全部(Ch1+Ch2)' },
  { key: 'ch1', label: 'Channel 1' },
  { key: 'ch2', label: 'Channel 2' }
]

// 存储多个图表实例
const realtimeCharts = ref<{ [key: string]: echarts.ECharts | null }>({})
const monthlyCharts = ref<{ [key: string]: echarts.ECharts | null }>({})

// 设备列表和选择
const devices = ref<{ device_name: string; category: string }[]>([])
const selectedCategory = ref('安楼外幕墙1')
const selectedDevice = ref('')

// 当前设备信息
const currentDeviceInfo = computed(() => {
  if (!selectedDevice.value) {
    return {
      name: '未选择',
      location: '未知',
      type: 'unknown',
      typeLabel: '未知'
    }
  }

  const deviceName = selectedDevice.value
  const location = selectedCategory.value
  const isStrainGauge = deviceName.includes('Y')
  const type = isStrainGauge ? 'strainGauge' : 'accelerometer'
  const typeLabel = isStrainGauge ? '应变计' : '加速度计'
  
  return {
    name: deviceName,
    location: location,
    type: type,
    typeLabel: typeLabel
  }
})

// 筛选符合条件的设备
const filteredDevices = computed(() => {
  return devices.value.filter(device => 
    device.category === selectedCategory.value && 
    device.device_name.includes(selectedCategory.value)
  )
})

// 观察设备与筛选结果，输出诊断日志
watch([devices, selectedCategory], () => {
  try {
    console.log('[诊断] 设备原始数量:', devices.value.length, '当前地点:', selectedCategory.value)
    const sample = filteredDevices.value.slice(0, 5).map((d: { device_name: string }) => d.device_name)
    console.log('[诊断] 过滤后设备数量:', filteredDevices.value.length, '示例:', sample)
  } catch (e) {
    console.warn('[诊断] 统计过滤设备时出错:', e)
  }
}, { immediate: true })

// 设备状态
const deviceStatus = reactive({
  online: true,
  lastUpdate: new Date().toLocaleString()
})

// 阈值信息
const thresholds = reactive({
  // 加速度计阈值
  x_limit: 0,
  y_limit: 0,
  z_limit: 0,
  // 应变计阈值
  ch1_limit: 0,
  ch2_limit: 0,
  // 通用告警阈值
  email_limit: 0,
  message_limit: 0
})

// 月份范围选择
const monthRange = ref<[Date, Date]>([
  new Date(new Date().getFullYear(), new Date().getMonth() - 6, 1),
  new Date()
])

// 异常数据相关
const abnormalData = ref<Array<{
  time: string;
  direction: string;
  data: number;
  min: number;
  max: number;
  type?: string; // 添加type字段
}>>([])
const abnormalLoading = ref(false)
const abnormalFilter = reactive({
  direction: 'all'
})

// 实时数据轮询
let realtimeInterval: NodeJS.Timeout | null = null

// 存储当前数据
const currentRealtimeData = ref<{
  x?: Array<[string, number]>;
  y?: Array<[string, number]>;
  z?: Array<[string, number]>;
  ch1?: Array<[string, number]>;
  ch2?: Array<[string, number]>;
} | null>(null)
const currentMonthlyData = ref<{
  x?: Array<[string, number]>;
  y?: Array<[string, number]>;
  z?: Array<[string, number]>;
  ch1?: Array<[string, number]>;
  ch2?: Array<[string, number]>;
} | null>(null)

// 存储预处理的图表配置
const chartOptions = ref<{ [key: string]: any }>({})

// 获取异常级别类型
const getAlarmType = (item: any): 'alarm' | 'warning' => {
  // 优先使用API返回的type字段
  if (item.type) {
    const alarmType = item.type === 'alarm' ? 'alarm' : 'warning'
    console.log(`[预警调试] 使用API type字段: ${item.type} -> ${alarmType}, 数据: ${item.data}, 方向: ${item.direction}`)
    return alarmType
  }
  
  // 根据方向获取对应的阈值
  const dataValue = Math.abs(item.data)
  let threshold = 0
  
  // 根据direction确定要比较的阈值
  switch (item.direction) {
    case 'x_above_max':
    case 'x_below_min':
      threshold = thresholds.x_limit
      break
    case 'y_above_max':
    case 'y_below_min':
      threshold = thresholds.y_limit
      break
    case 'z_above_max':
    case 'z_below_min':
      threshold = thresholds.z_limit
      break
    case 'ch1_above_max':
    case 'ch1_below_min':
      threshold = thresholds.ch1_limit
      break
    case 'ch2_above_max':
    case 'ch2_below_min':
      threshold = thresholds.ch2_limit
      break
    default:
      threshold = thresholds.message_limit // 默认使用短信阈值
  }
  
  // 分级判断：如果超过email_limit但不超过message_limit为warning，超过message_limit为alarm
  let alarmType: 'alarm' | 'warning'
  if (dataValue >= thresholds.message_limit) {
    alarmType = 'alarm'
  } else if (dataValue >= thresholds.email_limit) {
    alarmType = 'warning'
  } else {
    alarmType = 'warning' // 默认warning
  }
  
  console.log(`[预警调试] 异常检测 - 数据值: ${item.data}, 绝对值: ${dataValue}, 方向: ${item.direction}, 对应阈值: ${threshold}, email阈值: ${thresholds.email_limit}, 短信阈值: ${thresholds.message_limit}, 判断结果: ${alarmType}`)
  
  return alarmType
}

// 判断是否为警告级别（alarm）
const isAlarmLevel = (item: any): boolean => {
  return getAlarmType(item) === 'alarm'
}

// 获取警告级别标签
const getAlarmLevelLabel = (item: any): string => {
  const type = getAlarmType(item)
  return type === 'alarm' ? '警告' : '预警'
}

// 获取警告级别标签类型
const getAlarmLevelTagType = (item: any): "success" | "warning" | "info" | "primary" | "danger" => {
  const type = getAlarmType(item)
  return type === 'alarm' ? 'danger' : 'warning'
}

// 获取异常项的CSS类
const getAbnormalItemClass = (item: any): string => {
  const type = getAlarmType(item)
  return type === 'alarm' ? 'abnormal-item alarm-level' : 'abnormal-item warning-level'
}

// 初始化实时图表
const initializeRealtimeCharts = () => {
  nextTick(() => {
    try {
      // 销毁现有图表
      Object.values(realtimeCharts.value).forEach(chart => {
        if (chart) {
          chart.dispose()
        }
      })
      realtimeCharts.value = {}

      // 加速度计图表
      const chartX = document.getElementById('realtime-chart-x')
      const chartY = document.getElementById('realtime-chart-y')
      const chartZ = document.getElementById('realtime-chart-z')
      const chartAll = document.getElementById('realtime-chart-all')
      console.log('[诊断] 实时容器存在性(accelerometer):', {
        x: !!chartX, y: !!chartY, z: !!chartZ, all: !!chartAll
      })
      
      if (chartX) realtimeCharts.value['x'] = echarts.init(chartX)
      if (chartY) realtimeCharts.value['y'] = echarts.init(chartY)
      if (chartZ) realtimeCharts.value['z'] = echarts.init(chartZ)
      if (chartAll) realtimeCharts.value['all'] = echarts.init(chartAll)
      
      // 应变计图表
      const chartCh1 = document.getElementById('realtime-chart-ch1')
      const chartCh2 = document.getElementById('realtime-chart-ch2')
      const chartStrainAll = document.getElementById('realtime-chart-strain-all')
      console.log('[诊断] 实时容器存在性(strainGauge):', {
        ch1: !!chartCh1, ch2: !!chartCh2, all: !!chartStrainAll
      })
      
      if (chartCh1) realtimeCharts.value['ch1'] = echarts.init(chartCh1)
      if (chartCh2) realtimeCharts.value['ch2'] = echarts.init(chartCh2)
      if (chartStrainAll) realtimeCharts.value['strain-all'] = echarts.init(chartStrainAll)

      console.log('实时图表初始化完成:', Object.keys(realtimeCharts.value))
    } catch (error) {
      console.error('初始化实时图表失败:', error)
    }
  })
}

// 初始化月级图表
const initializeMonthlyCharts = () => {
  nextTick(() => {
    try {
      // 销毁现有图表
      Object.values(monthlyCharts.value).forEach(chart => {
        if (chart) {
          chart.dispose()
        }
      })
      monthlyCharts.value = {}

      // 加速度计图表
      const chartX = document.getElementById('monthly-chart-x')
      const chartY = document.getElementById('monthly-chart-y')
      const chartZ = document.getElementById('monthly-chart-z')
      const chartAll = document.getElementById('monthly-chart-all')
      console.log('[诊断] 月级容器存在性(accelerometer):', {
        x: !!chartX, y: !!chartY, z: !!chartZ, all: !!chartAll
      })
      
      if (chartX) monthlyCharts.value['x'] = echarts.init(chartX)
      if (chartY) monthlyCharts.value['y'] = echarts.init(chartY)
      if (chartZ) monthlyCharts.value['z'] = echarts.init(chartZ)
      if (chartAll) monthlyCharts.value['all'] = echarts.init(chartAll)
      
      // 应变计图表
      const chartCh1 = document.getElementById('monthly-chart-ch1')
      const chartCh2 = document.getElementById('monthly-chart-ch2')
      const chartStrainAll = document.getElementById('monthly-chart-strain-all')
      console.log('[诊断] 月级容器存在性(strainGauge):', {
        ch1: !!chartCh1, ch2: !!chartCh2, all: !!chartStrainAll
      })
      
      if (chartCh1) monthlyCharts.value['ch1'] = echarts.init(chartCh1)
      if (chartCh2) monthlyCharts.value['ch2'] = echarts.init(chartCh2)
      if (chartStrainAll) monthlyCharts.value['strain-all'] = echarts.init(chartStrainAll)

      console.log('月级图表初始化完成:', Object.keys(monthlyCharts.value))
    } catch (error) {
      console.error('初始化月级图表失败:', error)
    }
  })
}

// 标签页切换函数
const switchRealtimeTab = (tabKey: string) => {
  activeRealtimeTab.value = tabKey
  
  nextTick(() => {
    const chartKey = tabKey === 'all' && currentDeviceInfo.value.type === 'strainGauge' ? 'strain-all' : tabKey
    if (realtimeCharts.value[chartKey]) {
      realtimeCharts.value[chartKey]?.resize()
      
      // 如果已有预处理的配置，直接使用
      if (chartOptions.value[`realtime-${chartKey}`]) {
        realtimeCharts.value[chartKey]?.setOption(chartOptions.value[`realtime-${chartKey}`], true)
      } else {
        drawSpecificRealtimeChart(tabKey)
      }
    }
  })
}

// 月级标签页切换
const switchMonthlyTab = (tabKey: string) => {
  activeMonthlyTab.value = tabKey
  
  nextTick(() => {
    const chartKey = tabKey === 'all' && currentDeviceInfo.value.type === 'strainGauge' ? 'strain-all' : tabKey
    if (monthlyCharts.value[chartKey]) {
      monthlyCharts.value[chartKey]?.resize()
      
      // 如果已有预处理的配置，直接使用
      if (chartOptions.value[`monthly-${chartKey}`]) {
        monthlyCharts.value[chartKey]?.setOption(chartOptions.value[`monthly-${chartKey}`], true)
      } else {
        drawSpecificMonthlyChart(tabKey)
      }
    }
  })
}

// 绘制特定实时图表
const drawSpecificRealtimeChart = (chartType: string) => {
  if (!currentRealtimeData.value) {
    console.warn('[诊断] 绘制实时图表早退: currentRealtimeData 为空, chartType=', chartType)
    return
  }
  
  if (currentDeviceInfo.value.type === 'accelerometer') {
    drawRealtimeAccelerometerChart(chartType)
  } else if (currentDeviceInfo.value.type === 'strainGauge') {
    drawRealtimeStrainGaugeChart(chartType)
  }
}

// 绘制特定月级图表
const drawSpecificMonthlyChart = (chartType: string) => {
  if (!currentMonthlyData.value) {
    console.warn('[诊断] 绘制月级图表早退: currentMonthlyData 为空, chartType=', chartType)
    return
  }
  
  if (currentDeviceInfo.value.type === 'accelerometer') {
    drawMonthlyAccelerometerChart(chartType)
  } else if (currentDeviceInfo.value.type === 'strainGauge') {
    drawMonthlyStrainGaugeChart(chartType)
  }
}

// 绘制实时加速度计图表
const drawRealtimeAccelerometerChart = (chartType: string) => {
  const chart = realtimeCharts.value[chartType]
  if (!chart || !currentRealtimeData.value) return
  
  chart.clear()
  
  let series: any[] = []
  let title = ''
  const xAxisData = currentRealtimeData.value.x?.map((item: [string, number]) => item[0]) || []
  
  switch (chartType) {
    case 'x':
      title = 'X轴实时数据'
      series = [{
        name: 'X轴',
        type: 'line',
        data: currentRealtimeData.value.x?.map((item: [string, number]) => item[1]) || [],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2 },
        color: '#ff6b6b'
      }]
      break
      
    case 'y':
      title = 'Y轴实时数据'
      series = [{
        name: 'Y轴',
        type: 'line',
        data: currentRealtimeData.value.y?.map((item: [string, number]) => item[1]) || [],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2 },
        color: '#4ecdc4'
      }]
      break
      
    case 'z':
      title = 'Z轴实时数据'
      series = [{
        name: 'Z轴',
        type: 'line',
        data: currentRealtimeData.value.z?.map((item: [string, number]) => item[1]) || [],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2 },
        color: '#orange'
      }]
      break
      
    case 'all':
      title = 'XYZ轴实时数据'
      series = [
        {
          name: 'X轴',
          type: 'line',
          data: currentRealtimeData.value.x?.map((item: [string, number]) => item[1]) || [],
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          color: '#ff6b6b'
        },
        {
          name: 'Y轴',
          type: 'line',
          data: currentRealtimeData.value.y?.map((item: [string, number]) => item[1]) || [],
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          color: '#4ecdc4'
        },
        {
          name: 'Z轴',
          type: 'line',
          data: currentRealtimeData.value.z?.map((item: [string, number]) => item[1]) || [],
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          color: 'orange'
        }
      ]
      break
  }
  
  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      }
    },
    legend: {
      data: series.map(s => s.name),
      top: 30
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '20%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxisData,
      axisLabel: {
        formatter: (value: string) => {
          const time = new Date(value)
          return time.toLocaleTimeString()
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => value.toFixed(6) + ' gal'
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 50,
        end: 100
      },
      {
        type: 'slider',
        start: 50,
        end: 100
      }
    ],
    series: series
  }
  
  chart.setOption(option)
  // 缓存配置
  chartOptions.value[`realtime-${chartType}`] = option
}

// 绘制实时应变计图表
const drawRealtimeStrainGaugeChart = (chartType: string) => {
  const chartKey = chartType === 'all' ? 'strain-all' : chartType
  const chart = realtimeCharts.value[chartKey]
  if (!chart || !currentRealtimeData.value) return
  
  chart.clear()
  
  let series: any[] = []
  let title = ''
  const xAxisData = currentRealtimeData.value.ch1?.map((item: [string, number]) => item[0]) || []
  
  switch (chartType) {
    case 'ch1':
      title = 'Ch1实时数据'
      series = [{
        name: 'Ch1',
        type: 'line',
        data: currentRealtimeData.value.ch1?.map((item: [string, number]) => item[1]) || [],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2 },
        color: '#ff6b6b'
      }]
      break
      
    case 'ch2':
      title = 'Ch2实时数据'
      series = [{
        name: 'Ch2',
        type: 'line',
        data: currentRealtimeData.value.ch2?.map((item: [string, number]) => item[1]) || [],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2 },
        color: '#4ecdc4'
      }]
      break
      
    case 'all':
      title = 'Ch1+Ch2实时数据'
      series = [
        {
          name: 'Ch1',
          type: 'line',
          data: currentRealtimeData.value.ch1?.map((item: [string, number]) => item[1]) || [],
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          color: '#ff6b6b'
        },
        {
          name: 'Ch2',
          type: 'line',
          data: currentRealtimeData.value.ch2?.map((item: [string, number]) => item[1]) || [],
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          color: '#4ecdc4'
        }
      ]
      break
  }
  
  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      }
    },
    legend: {
      data: series.map(s => s.name),
      top: 30
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '20%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxisData,
      axisLabel: {
        formatter: (value: string) => {
          const time = new Date(value)
          return time.toLocaleTimeString()
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => value.toFixed(6) + ' με'
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 50,
        end: 100
      },
      {
        type: 'slider',
        start: 50,
        end: 100
      }
    ],
    series: series
  }
  
  chart.setOption(option)
  // 缓存配置
  chartOptions.value[`realtime-${chartKey}`] = option
}

// 绘制月级加速度计图表
const drawMonthlyAccelerometerChart = (chartType: string) => {
  const chart = monthlyCharts.value[chartType]
  if (!chart || !currentMonthlyData.value) return
  
  chart.clear()
  
  let series: any[] = []
  let title = ''
  const xAxisData = currentMonthlyData.value.x?.map((item: [string, number]) => item[0]) || []
  
  switch (chartType) {
    case 'x':
      title = 'X轴月级平均值'
      series = [{
        name: 'X轴平均值',
        type: 'bar',
        data: currentMonthlyData.value.x?.map((item: [string, number]) => item[1]) || [],
        barWidth: '60%',
        color: '#ff6b6b'
      }]
      break
      
    case 'y':
      title = 'Y轴月级平均值'
      series = [{
        name: 'Y轴平均值',
        type: 'bar',
        data: currentMonthlyData.value.y?.map((item: [string, number]) => item[1]) || [],
        barWidth: '60%',
        color: '#4ecdc4'
      }]
      break
      
    case 'z':
      title = 'Z轴月级平均值'
      series = [{
        name: 'Z轴平均值',
        type: 'bar',
        data: currentMonthlyData.value.z?.map((item: [string, number]) => item[1]) || [],
        barWidth: '60%',
        color: 'orange'
      }]
      break
      
    case 'all':
      title = 'XYZ轴月级平均值'
      series = [
        {
          name: 'X轴平均值',
          type: 'bar',
          data: currentMonthlyData.value.x?.map((item: [string, number]) => item[1]) || [],
          barWidth: '20%',
          color: '#ff6b6b'
        },
        {
          name: 'Y轴平均值',
          type: 'bar',
          data: currentMonthlyData.value.y?.map((item: [string, number]) => item[1]) || [],
          barWidth: '20%',
          color: '#4ecdc4'
        },
        {
          name: 'Z轴平均值',
          type: 'bar',
          data: currentMonthlyData.value.z?.map((item: [string, number]) => item[1]) || [],
          barWidth: '20%',
          color: 'orange'
        }
      ]
      break
  }
  
  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    legend: {
      data: series.map(s => s.name),
      top: 30
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '20%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLabel: {
        formatter: (value: string) => {
          const date = new Date(value)
          return date.toLocaleDateString()
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => value.toFixed(6) + ' gal'
      }
    },
    series: series
  }
  
  chart.setOption(option)
  // 缓存配置
  chartOptions.value[`monthly-${chartType}`] = option
}

// 绘制月级应变计图表
const drawMonthlyStrainGaugeChart = (chartType: string) => {
  const chartKey = chartType === 'all' ? 'strain-all' : chartType
  const chart = monthlyCharts.value[chartKey]
  if (!chart || !currentMonthlyData.value) return
  
  chart.clear()
  
  let series: any[] = []
  let title = ''
  const xAxisData = currentMonthlyData.value.ch1?.map((item: [string, number]) => item[0]) || []
  
  switch (chartType) {
    case 'ch1':
      title = 'Ch1月级平均值'
      series = [{
        name: 'Ch1平均值',
        type: 'bar',
        data: currentMonthlyData.value.ch1?.map((item: [string, number]) => item[1]) || [],
        barWidth: '60%',
        color: '#ff6b6b'
      }]
      break
      
    case 'ch2':
      title = 'Ch2月级平均值'
      series = [{
        name: 'Ch2平均值',
        type: 'bar',
        data: currentMonthlyData.value.ch2?.map((item: [string, number]) => item[1]) || [],
        barWidth: '60%',
        color: '#4ecdc4'
      }]
      break
      
    case 'all':
      title = 'Ch1+Ch2月级平均值'
      series = [
        {
          name: 'Ch1平均值',
          type: 'bar',
          data: currentMonthlyData.value.ch1?.map((item: [string, number]) => item[1]) || [],
          barWidth: '30%',
          color: '#ff6b6b'
        },
        {
          name: 'Ch2平均值',
          type: 'bar',
          data: currentMonthlyData.value.ch2?.map((item: [string, number]) => item[1]) || [],
          barWidth: '30%',
          color: '#4ecdc4'
        }
      ]
      break
  }
  
  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    legend: {
      data: series.map(s => s.name),
      top: 30
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '20%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLabel: {
        formatter: (value: string) => {
          const date = new Date(value)
          return date.toLocaleDateString()
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => value.toFixed(6) + ' με'
      }
    },
    series: series
  }
  
  chart.setOption(option)
  // 缓存配置
  chartOptions.value[`monthly-${chartKey}`] = option
}

// 预处理所有图表配置
const preprocessChartOptions = (data: any, isRealtime: boolean = true) => {
  if (!data) return
  
  const deviceType = currentDeviceInfo.value.type
  const prefix = isRealtime ? 'realtime' : 'monthly'
  try {
    const keys = Object.keys(data)
    console.log('[诊断] 预处理图表配置: deviceType=', deviceType, 'isRealtime=', isRealtime, 'data keys=', keys)
  } catch {}
  
  if (deviceType === 'accelerometer') {
    const xAxisData = data.x?.map((item: [string, number]) => item[0]) || []
    
    // 预处理各个轴的配置
    ['x', 'y', 'z', 'all'].forEach(chartType => {
      const option = generateAccelerometerOption(data, chartType, xAxisData, isRealtime)
      chartOptions.value[`${prefix}-${chartType}`] = option
    })
  } else if (deviceType === 'strainGauge') {
    const xAxisData = data.ch1?.map((item: [string, number]) => item[0]) || []
    
    // 预处理各个通道的配置
    ['ch1', 'ch2', 'all'].forEach(chartType => {
      const option = generateStrainGaugeOption(data, chartType, xAxisData, isRealtime)
      const key = chartType === 'all' ? 'strain-all' : chartType
      chartOptions.value[`${prefix}-${key}`] = option
    })
  }
}

// 生成加速度计图表配置
const generateAccelerometerOption = (data: any, chartType: string, xAxisData: string[], isRealtime: boolean) => {
  let series: any[] = []
  let title = ''
  
  switch (chartType) {
    case 'x':
      title = isRealtime ? 'X轴实时数据' : 'X轴月级平均值'
      series = [{
        name: isRealtime ? 'X轴' : 'X轴平均值',
        type: isRealtime ? 'line' : 'bar',
        data: data.x?.map((item: [string, number]) => item[1]) || [],
        smooth: isRealtime,
        symbol: isRealtime ? 'none' : undefined,
        lineStyle: isRealtime ? { width: 2 } : undefined,
        barWidth: isRealtime ? undefined : '60%',
        color: '#ff6b6b'
      }]
      break
      
    case 'y':
      title = isRealtime ? 'Y轴实时数据' : 'Y轴月级平均值'
      series = [{
        name: isRealtime ? 'Y轴' : 'Y轴平均值',
        type: isRealtime ? 'line' : 'bar',
        data: data.y?.map((item: [string, number]) => item[1]) || [],
        smooth: isRealtime,
        symbol: isRealtime ? 'none' : undefined,
        lineStyle: isRealtime ? { width: 2 } : undefined,
        barWidth: isRealtime ? undefined : '60%',
        color: '#4ecdc4'
      }]
      break
      
    case 'z':
      title = isRealtime ? 'Z轴实时数据' : 'Z轴月级平均值'
      series = [{
        name: isRealtime ? 'Z轴' : 'Z轴平均值',
        type: isRealtime ? 'line' : 'bar',
        data: data.z?.map((item: [string, number]) => item[1]) || [],
        smooth: isRealtime,
        symbol: isRealtime ? 'none' : undefined,
        lineStyle: isRealtime ? { width: 2 } : undefined,
        barWidth: isRealtime ? undefined : '60%',
        color: '#45b7d1'
      }]
      break
      
    case 'all':
      title = isRealtime ? 'XYZ轴实时数据' : 'XYZ轴月级平均值'
      series = [
        {
          name: isRealtime ? 'X轴' : 'X轴平均值',
          type: isRealtime ? 'line' : 'bar',
          data: data.x?.map((item: [string, number]) => item[1]) || [],
          smooth: isRealtime,
          symbol: isRealtime ? 'none' : undefined,
          lineStyle: isRealtime ? { width: 2 } : undefined,
          barWidth: isRealtime ? undefined : '20%',
          color: '#ff6b6b'
        },
        {
          name: isRealtime ? 'Y轴' : 'Y轴平均值',
          type: isRealtime ? 'line' : 'bar',
          data: data.y?.map((item: [string, number]) => item[1]) || [],
          smooth: isRealtime,
          symbol: isRealtime ? 'none' : undefined,
          lineStyle: isRealtime ? { width: 2 } : undefined,
          barWidth: isRealtime ? undefined : '20%',
          color: '#4ecdc4'
        },
        {
          name: isRealtime ? 'Z轴' : 'Z轴平均值',
          type: isRealtime ? 'line' : 'bar',
          data: data.z?.map((item: [string, number]) => item[1]) || [],
          smooth: isRealtime,
          symbol: isRealtime ? 'none' : undefined,
          lineStyle: isRealtime ? { width: 2 } : undefined,
          barWidth: isRealtime ? undefined : '20%',
          color: '#45b7d1'
        }
      ]
      break
  }
  
  return {
    title: {
      text: title,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: isRealtime ? 'cross' : 'shadow'
      }
    },
    legend: {
      data: series.map(s => s.name),
      top: 30
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: isRealtime ? '15%' : '10%',
      top: '20%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: isRealtime ? false : true,
      data: xAxisData,
      axisLabel: {
        formatter: (value: string) => {
          const time = new Date(value)
          return isRealtime ? time.toLocaleTimeString() : time.toLocaleDateString()
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => value.toFixed(6) + ' gal'
      }
    },
    dataZoom: isRealtime ? [
      {
        type: 'inside',
        start: 50,
        end: 100
      },
      {
        type: 'slider',
        start: 50,
        end: 100
      }
    ] : undefined,
    series: series
  }
}

// 生成应变计图表配置
const generateStrainGaugeOption = (data: any, chartType: string, xAxisData: string[], isRealtime: boolean) => {
  let series: any[] = []
  let title = ''
  
  switch (chartType) {
    case 'ch1':
      title = isRealtime ? 'Ch1实时数据' : 'Ch1月级平均值'
      series = [{
        name: isRealtime ? 'Ch1' : 'Ch1平均值',
        type: isRealtime ? 'line' : 'bar',
        data: data.ch1?.map((item: [string, number]) => item[1]) || [],
        smooth: isRealtime,
        symbol: isRealtime ? 'none' : undefined,
        lineStyle: isRealtime ? { width: 2 } : undefined,
        barWidth: isRealtime ? undefined : '60%',
        color: '#ff6b6b'
      }]
      break
      
    case 'ch2':
      title = isRealtime ? 'Ch2实时数据' : 'Ch2月级平均值'
      series = [{
        name: isRealtime ? 'Ch2' : 'Ch2平均值',
        type: isRealtime ? 'line' : 'bar',
        data: data.ch2?.map((item: [string, number]) => item[1]) || [],
        smooth: isRealtime,
        symbol: isRealtime ? 'none' : undefined,
        lineStyle: isRealtime ? { width: 2 } : undefined,
        barWidth: isRealtime ? undefined : '60%',
        color: '#4ecdc4'
      }]
      break
      
    case 'all':
      title = isRealtime ? 'Ch1+Ch2实时数据' : 'Ch1+Ch2月级平均值'
      series = [
        {
          name: isRealtime ? 'Ch1' : 'Ch1平均值',
          type: isRealtime ? 'line' : 'bar',
          data: data.ch1?.map((item: [string, number]) => item[1]) || [],
          smooth: isRealtime,
          symbol: isRealtime ? 'none' : undefined,
          lineStyle: isRealtime ? { width: 2 } : undefined,
          barWidth: isRealtime ? undefined : '30%',
          color: '#ff6b6b'
        },
        {
          name: isRealtime ? 'Ch2' : 'Ch2平均值',
          type: isRealtime ? 'line' : 'bar',
          data: data.ch2?.map((item: [string, number]) => item[1]) || [],
          smooth: isRealtime,
          symbol: isRealtime ? 'none' : undefined,
          lineStyle: isRealtime ? { width: 2 } : undefined,
          barWidth: isRealtime ? undefined : '30%',
          color: '#4ecdc4'
        }
      ]
      break
  }
  
  return {
    title: {
      text: title,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: isRealtime ? 'cross' : 'shadow'
      }
    },
    legend: {
      data: series.map(s => s.name),
      top: 30
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: isRealtime ? '15%' : '10%',
      top: '20%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: isRealtime ? false : true,
      data: xAxisData,
      axisLabel: {
        formatter: (value: string) => {
          const time = new Date(value)
          return isRealtime ? time.toLocaleTimeString() : time.toLocaleDateString()
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => value.toFixed(6) + ' με'
      }
    },
    dataZoom: isRealtime ? [
      {
        type: 'inside',
        start: 50,
        end: 100
      },
      {
        type: 'slider',
        start: 50,
        end: 100
      }
    ] : undefined,
    series: series
  }
}

// 返回主页
const backToMain = () => {
  router.push('/')
}

// 跳转到异常数据页面
const goToAbnormalPage = () => {
  router.push('/abnormal')
}

// 格式化时间
const formatTime = (timeStr: string) => {
  try {
    return new Date(timeStr).toLocaleString()
  } catch {
    return timeStr
  }
}

// 获取方向标签
const getDirectionLabel = (direction: string): string => {
  const directionMap: Record<string, string> = {
    'x_above_max': 'X轴超过最大值',
    'x_below_min': 'X轴低于最小值',
    'y_above_max': 'Y轴超过最大值',
    'y_below_min': 'Y轴低于最小值',
    'z_above_max': 'Z轴超过最大值',
    'z_below_min': 'Z轴低于最小值',
    'ch1_above_max': 'Ch1超过最大值',
    'ch1_below_min': 'Ch1低于最小值',
    'ch2_above_max': 'Ch2超过最大值',
    'ch2_below_min': 'Ch2低于最小值'
  }
  return directionMap[direction] || direction
}

// 获取方向标签类型
const getDirectionTagType = (direction: string): "success" | "warning" | "info" | "primary" | "danger" => {
  if (direction.includes('above_max')) return 'danger'
  if (direction.includes('below_min')) return 'warning'
  return 'info'
}

// 获取设备列表
const fetchDevices = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/data/get_new_device`)
    if (response.data.status === 'success') {
      console.log('[诊断] 获取设备列表成功, 原始条数:', Array.isArray(response.data.data) ? response.data.data.length : 'N/A')
      try {
        const names = (response.data.data || []).slice(0, 10).map((d: any) => d.device_name)
        console.log('[诊断] 设备名称样本(前10):', names)
      } catch {}
      devices.value = response.data.data.map((device: { device_name: string }) => ({
        device_name: device.device_name,
        category: selectedCategory.value
      }))
      console.log('[诊断] 设备入库后条数:', devices.value.length)
    } else {
      ElMessage.error('获取设备列表失败')
    }
  } catch (error) {
    console.error('获取设备列表时出错:', error)
    ElMessage.error('获取设备列表失败')
  }
}

// 获取阈值
const fetchThresholds = async () => {
  if (!selectedDevice.value) return
  
  try {
    const deviceType = currentDeviceInfo.value.type
    
    const response = await axios.get(`${API_BASE_URL}/data/get_threshold_or_offset`, {
      params: {
        device_name: selectedDevice.value,
        device_type: deviceType
      }
    })
    console.log('[诊断] 获取阈值 /data/get_threshold_or_offset response=', response.data)
    
    if (response.data.status === 'success') {
      const data = response.data.data
      
      // 重置所有阈值
      Object.keys(thresholds).forEach(key => {
        thresholds[key as keyof typeof thresholds] = 0
      })
      console.log('[诊断] 重置阈值:', JSON.stringify(thresholds))
      
      // 根据设备类型设置对应阈值
      if (deviceType === 'accelerometer') {
        thresholds.x_limit = data.x_limit || 0
        thresholds.y_limit = data.y_limit || 0
        thresholds.z_limit = data.z_limit || 0
      } else if (deviceType === 'strainGauge') {
        thresholds.ch1_limit = data.ch1_limit || 0
        thresholds.ch2_limit = data.ch2_limit || 0
        }
      else {
        console.warn('未知设备类型, 无法设置特定阈值:', deviceType)
        
      }
      
      // 设置通用告警阈值
      thresholds.email_limit = data.email_limit || 25
      thresholds.message_limit = data.message_limit || 35
    }
  } catch (error) {
    console.error('获取阈值失败:', error)
  }
}

// 获取秒级数据
const fetchRealtimeData = async () => {
  if (!selectedDevice.value) return
  
  try {
    const params = {
      device_name: selectedDevice.value,
      num: 60000*12 // 获取最近5分钟的秒级数据(当前表达式值为: ' + (60000*12) + ')
    }
    console.log('[诊断] 请求秒级数据 /data/get_second_data params=', params)
    const response = await axios.get(`${API_BASE_URL}/data/get_second_data`, { params })
    
    if (response.data.status === 'success' && response.data.data) {
      currentRealtimeData.value = response.data.data
      deviceStatus.lastUpdate = new Date().toLocaleString()
      deviceStatus.online = true
      
      console.log('获取实时数据成功:', currentRealtimeData.value)
      try {
        const keys = Object.keys(currentRealtimeData.value || {})
        console.log('[诊断] 实时数据包含键:', keys)
        keys.forEach(k => {
          const arr = (currentRealtimeData.value as any)[k]
          if (Array.isArray(arr)) {
            console.log(`[诊断] ${k} 点数:`, arr.length)
          }
        })
      } catch {}
      
      // 预处理实时图表配置
      preprocessChartOptions(response.data.data, true)
      
      // 确保激活的是all标签页
      activeRealtimeTab.value = 'all'
      
      // 等待DOM更新后重新绘制当前显示的图表
      await nextTick()
      drawSpecificRealtimeChart(activeRealtimeTab.value)
    }
  } catch (error) {
    console.error('获取实时数据失败:', error)
    deviceStatus.online = false
  }
}

// 获取月级数据
const fetchMonthlyData = async () => {
  if (!selectedDevice.value) return
  
  try {
    const params = {
      device_name: selectedDevice.value,
      num: 12 // 获取12个月的数据
    }
    console.log('[诊断] 请求月级数据 /data/get_monthly_data params=', params)
    const response = await axios.get(`${API_BASE_URL}/data/get_monthly_data`, { params })
    
    if (response.data.status === 'success' && response.data.data) {
      currentMonthlyData.value = response.data.data
      
      console.log('获取月级数据成功:', currentMonthlyData.value)
      try {
        const keys = Object.keys(currentMonthlyData.value || {})
        console.log('[诊断] 月级数据包含键:', keys)
        keys.forEach(k => {
          const arr = (currentMonthlyData.value as any)[k]
          if (Array.isArray(arr)) {
            console.log(`[诊断] 月级 ${k} 点数:`, arr.length)
          }
        })
      } catch {}
      
      // 预处理月级图表配置
      preprocessChartOptions(response.data.data, false)
      
      // 确保激活的是all标签页
      activeMonthlyTab.value = 'all'
      
      // 等待DOM更新后重新绘制当前显示的图表
      await nextTick()
      drawSpecificMonthlyChart(activeMonthlyTab.value)
    }
  } catch (error) {
    console.error('获取月级数据失败:', error)
  }
}

// 获取异常数据
const fetchAbnormalData = async () => {
  if (!selectedDevice.value) return
  
  abnormalLoading.value = true
  try {
    // 设置查询时间范围为最近7天
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    const formatDate = (date: Date) => {
      const pad = (num: number) => String(num).padStart(2, '0')
      const year = date.getFullYear()
      const month = pad(date.getMonth() + 1)
      const day = pad(date.getDate())
      const hours = pad(date.getHours())
      const minutes = pad(date.getMinutes())
      const seconds = pad(date.getSeconds())
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }
    
    const params: Record<string, string> = {
      device: selectedDevice.value,
      start_time: formatDate(startTime),
      end_time: formatDate(endTime),
      direction: abnormalFilter.direction
    }
    
    console.log('[诊断] 请求异常数据 /data/get_abnormal_data_with_type params=', params)
    const response = await axios.get(`${API_BASE_URL}/data/get_abnormal_data_with_type`, { params })
    
    if (response.data.status === 'success' && Array.isArray(response.data.data)) {
      abnormalData.value = response.data.data.slice(0, 20) // 只显示最近20条
      console.log('[诊断] 异常数据返回条数:', response.data.data.length, '展示条数:', abnormalData.value.length)
    } else {
      abnormalData.value = []
      console.log('[诊断] 异常数据为空或格式不符')
    }
  } catch (error) {
    console.error('获取异常数据失败:', error)
    abnormalData.value = []
  } finally {
    abnormalLoading.value = false
  }
}

// 设备切换处理
const onDeviceChange = async () => {
  if (!selectedDevice.value) return
  
  console.log('设备切换:', selectedDevice.value)
  
  // 停止当前轮询
  if (realtimeInterval) {
    clearInterval(realtimeInterval)
  }
  
  // 重置标签页为all
  activeRealtimeTab.value = 'all'
  activeMonthlyTab.value = 'all'
  console.log('[诊断] 已重置标签页为 all, all')
  
  // 清空图表配置缓存
  chartOptions.value = {}
  console.log('[诊断] 已清空 chartOptions 缓存')
  
  // 等待设备类型计算完成后重新初始化图表
  await nextTick()
  initializeRealtimeCharts()
  initializeMonthlyCharts()
  console.log('[诊断] 重新初始化图表完成, 当前设备类型:', currentDeviceInfo.value.type)
  
  // 重新获取数据
  await fetchThresholds()
  await fetchRealtimeData()
  await fetchMonthlyData()
  await fetchAbnormalData()
  
  // 重新开始轮询
  startRealtimePolling()
  console.log('[诊断] 已重新开始实时轮询')
}

// 月份范围改变处理
const onMonthRangeChange = () => {
  fetchMonthlyData()
}

// 开始实时数据轮询
const startRealtimePolling = () => {
  if (realtimeInterval) {
    clearInterval(realtimeInterval)
  }
  realtimeInterval = setInterval(fetchRealtimeData, 5000) // 每5秒更新一次
}

// 窗口大小改变处理
const handleResize = () => {
  Object.values(realtimeCharts.value).forEach(chart => {
    if (chart) {
      chart.resize()
    }
  })
  Object.values(monthlyCharts.value).forEach(chart => {
    if (chart) {
      chart.resize()
    }
  })
}

// 监听设备类型变化
watch(() => currentDeviceInfo.value.type, (newType) => {
  console.log('设备类型变化:', newType)
  
  // 重置标签页
  activeRealtimeTab.value = 'all'
  activeMonthlyTab.value = 'all'
  
  // 重新初始化图表
  nextTick(() => {
    initializeRealtimeCharts()
    initializeMonthlyCharts()
  })
})

// 组件挂载
onMounted(() => {
  // 初始化图表
  initializeRealtimeCharts()
  initializeMonthlyCharts()
  
  // 获取设备列表
  fetchDevices()
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
  console.log('[诊断] 挂载完成: 初始选中地点=', selectedCategory.value, '初始设备=', selectedDevice.value, '初始设备类型=', currentDeviceInfo.value.type)
})

// 组件卸载
onUnmounted(() => {
  // 停止轮询
  if (realtimeInterval) {
    clearInterval(realtimeInterval)
  }
  
  // 销毁图表
  Object.values(realtimeCharts.value).forEach(chart => {
    if (chart) {
      chart.dispose()
    }
  })
  Object.values(monthlyCharts.value).forEach(chart => {
    if (chart) {
      chart.dispose()
    }
  })
  
  // 移除事件监听
  window.removeEventListener('resize', handleResize)
})

// 监听设备选择变化
watch(selectedDevice, (newDevice) => {
  if (newDevice) {
    onDeviceChange()
  }
})
</script>

<style scoped>
.dashboard-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
  overflow: hidden;
}

/* 顶部导航 */
.header-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.back-btn {
  margin-left: auto;
}

/* 上半部分 */
.top-section {
  display: flex;
  height: 50%;
  padding: 16px;
  gap: 16px;
}

/* 下半部分 */
.bottom-section {
  display: flex;
  height: 50%;
  padding: 0 16px 16px;
  gap: 16px;
}

/* 图表区域 */
.chart-section {
  flex: 3;
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 18px;
  font-weight: 500;
  margin: 0;
}

.device-selector {
  display: flex;
  gap: 12px;
}

/* 多图表卡片样式 */
.chart-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.tab-nav {
  display: flex;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 16px;
  background-color: #f8fafc;
  border-radius: 8px 8px 0 0;
  padding: 4px;
}

.tab-button {
  padding: 8px 16px;
  border: none;
  background-color: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
  border-radius: 6px;
  margin-right: 4px;
  font-size: 12px;
}

.tab-button:hover {
  background-color: #e2e8f0;
  color: #374151;
}

.tab-button.active {
  background-color: #3b82f6;
  color: white;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.tab-content {
  flex: 1;
  position: relative;
}

.chart-container {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background-color: #fff;
}

/* 设备信息区域 */
.info-section {
  flex: 1;
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow-y: auto;
}

.info-card h3 {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 12px 0;
  color: #303133;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.info-label {
  color: #606266;
  min-width: 80px;
}

.info-value {
  color: #303133;
  font-weight: 500;
}

/* 阈值信息 */
.threshold-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.threshold-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.threshold-group:not(:last-child) {
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 12px;
}

.threshold-group h4 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #409eff;
}

.threshold-item {
  display: flex;
  align-items: center;
  font-size: 13px;
}

.threshold-label {
  color: #606266;
  min-width: 80px;
}

.threshold-value {
  color: #409eff;
  font-weight: 500;
}

/* 异常数据区域 */
.abnormal-section {
  flex: 1;
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
}

.abnormal-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.abnormal-card h3 {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 12px 0;
  color: #303133;
}

.abnormal-filter {
  margin-bottom: 12px;
}

.abnormal-list {
  flex: 1;
  min-height: 0;
}

.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.abnormal-item {
  padding: 12px;
  border-bottom: 1px solid #ebeef5;
  transition: all 0.3s ease;
  border-radius: 4px;
  margin-bottom: 8px;
}

.abnormal-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 警告级别样式 - 红色 */
.abnormal-item.alarm-level {
  background: linear-gradient(135deg, #fef2f2 0%, #fef5f5 100%);
  border-left: 4px solid #f56565;
}

.abnormal-item.alarm-level:hover {
  background: linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%);
}

.abnormal-item.alarm-level .data-value {
  color: #c53030;
  font-weight: 700;
}

/* 预警级别样式 - 黄色 */
.abnormal-item.warning-level {
  background: linear-gradient(135deg, #fffef0 0%, #fefcbf 100%);
  border-left: 4px solid #ecc94b;
}

.abnormal-item.warning-level:hover {
  background: linear-gradient(135deg, #faf089 0%, #f6e05e 100%);
}

.abnormal-item.warning-level .data-value {
  color: #b7791f;
  font-weight: 700;
}

.abnormal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.abnormal-time {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

.abnormal-tags {
  display: flex;
  gap: 4px;
}

.alarm-level-tag {
  font-weight: 600;
}

.abnormal-content {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.threshold-range {
  font-size: 12px;
  color: #909399;
}

.abnormal-footer {
  padding: 12px 0 0;
  border-top: 1px solid #ebeef5;
  text-align: center;
}

.ml-4 {
  margin-left: 16px;
}

.mt-4 {
  margin-top: 16px;
}
</style>