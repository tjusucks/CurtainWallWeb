<template>
  <div class="page-shell">
    <div class="top-action">
      <el-button type="primary" @click="backToMain">返回主页</el-button>
    </div>

    <UForm :state="formState" class="page-body">
      <!-- 一键预警阈值设置面板 -->
      <section class="panel weather-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow weather-eyebrow">气象驱动</p>
            <h2>一键预警阈值设置</h2>
          </div>
          <div class="status-chip weather-status-chip">
            定时任务状态
            <strong>{{ schedulerConfig.isRunning ? '运行中' : '未运行' }}</strong>
          </div>
        </div>

        <!-- ── Wind Visual Panel ── -->
        <div class="wind-visual-grid">
          <!-- Wind Speed Gauge -->
          <div class="wind-gauge-card">
            <p class="gauge-eyebrow">实时风速</p>
            <div ref="windGaugeRef" class="gauge-canvas"></div>
            <div class="gauge-badge-row">
              <span
                class="beaufort-badge"
                :style="{
                  background: windBeaufort.color + '22',
                  color: windBeaufort.color,
                  border: `1px solid ${windBeaufort.color}55`
                }"
              >
                蒲福 {{ windBeaufort.level }} 级 · {{ windBeaufort.label }}
              </span>
            </div>
          </div>

          <!-- Wind Info Stack -->
          <div class="wind-info-stack">
            <div class="wind-info-row">
              <span>数据来源</span>
              <strong>NASA 小时级风速数据</strong>
            </div>
            <div class="wind-info-row">
              <span>当前风速</span>
              <strong :style="{ color: windBeaufort.color }">
                {{ weatherData.wind_speed_ms !== null ? weatherData.wind_speed_ms + ' m/s' : '--' }}
              </strong>
            </div>
            <div class="wind-info-row">
              <span>所属风速区间</span>
              <strong>{{ weatherData.wind_bin || '未识别' }}</strong>
            </div>
            <div class="wind-info-row">
              <span>蒲福风力等级</span>
              <strong>{{ windBeaufort.level }} 级（{{ windBeaufort.label }}）</strong>
            </div>
          </div>
        </div>

        <div class="note-card weather-note-card">
          执行“一键刷新预警阈值”时，系统将按后端规则文件和当前气象数据自动更新各设备预警阈值，定时任务将同一流程自动化。
        </div>

        <div class="weather-action-layout">
          <div class="weather-action-card">
            <h3>立即执行</h3>
            <p>手动触发一次阈值刷新，执行结果以接口返回为准。</p>
            <el-button type="primary" size="large" @click="applyWeatherRulesNow" :loading="isApplying">
              <div class="i-heroicons-bolt mr-2 w-5 h-5"></div> 一键刷新预警阈值
            </el-button>
          </div>
          
          <div class="schedule-card">
            <h3>定时任务配置</h3>
            <el-radio-group v-model="schedulerConfig.type">
              <el-radio label="interval">间隔定时任务</el-radio>
              <el-radio label="cron">每日定时任务</el-radio>
            </el-radio-group>

            <div v-if="schedulerConfig.type === 'interval'" class="schedule-row">
              <span>每隔</span>
              <el-input-number v-model="schedulerConfig.minutes" :min="10" :max="1440" />
              <span>分钟执行一次预警阈值刷新。</span>
            </div>
            
            <div v-if="schedulerConfig.type === 'cron'" class="schedule-row">
              <span>每天</span>
              <el-time-picker v-model="schedulerConfig.cronTime" format="HH:mm" placeholder="选择时间" />
              <span>执行一次预警阈值刷新。</span>
            </div>

            <div class="schedule-actions">
              <el-button type="success" @click="saveSchedule">保存并启动定时任务</el-button>
              <el-button type="danger" @click="stopSchedule" v-if="schedulerConfig.isRunning">停止定时任务</el-button>
            </div>
          </div>
        </div>
      </section>

      <!-- 全传感器阈值总览 -->
      <section class="panel overview-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow overview-eyebrow">阈值总览</p>
            <h2>全传感器阈值总览</h2>
          </div>
          <div class="overview-header-right">
            <span class="overview-loaded-tag" :class="{ 'all-loaded': overviewLoadedCount === deviceOptions.length }">
              已加载 {{ overviewLoadedCount }} / {{ deviceOptions.length }}
            </span>
            <UButton size="sm" color="primary" :loading="loadingOverview" @click="fetchAllThresholds">
              加载全部传感器阈值
            </UButton>
          </div>
        </div>

        <div class="overview-legend">
          <span class="legend-dot" style="background:#3b82f6"></span><span>衷和楼·加速度计</span>
          <span class="legend-dot" style="background:#f59e0b"></span><span>衷和楼·应变计</span>
          <span class="legend-dot" style="background:#10b981"></span><span>安楼·加速度计</span>
          <span class="legend-dot" style="background:#8b5cf6"></span><span>安楼·应变计</span>
        </div>

        <div v-if="overviewLoadedCount === 0 && !loadingOverview" class="overview-empty">
          <p>点击「加载全部传感器阈值」后，图表将展示所有传感器各通道的上下限范围，竖线为中心偏移量。</p>
        </div>
        <div v-if="loadingOverview && overviewLoadedCount === 0" class="overview-loading">
          <span>加载中，正在批量拉取各传感器阈值……</span>
        </div>

        <div v-if="overviewLoadedCount > 0" ref="overviewChartRef" class="overview-chart-canvas"></div>

        <div class="overview-status-grid" v-if="overviewLoadedCount > 0 || loadingOverview">
          <div
            v-for="device in deviceOptions"
            :key="device.value"
            class="overview-status-item"
            :class="{
              'st-loaded':  overviewSnapshots[device.value]?.loaded,
              'st-error':   overviewSnapshots[device.value]?.error,
              'st-loading': overviewSnapshots[device.value]?.loading,
            }"
          >
            <span class="st-dot"></span>
            <span>{{ device.label }}</span>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">设备选择</p>
            <h1>人工上下限设置</h1>
          </div>
          <div class="status-chip">
            当前生效来源
            <strong>人工配置</strong>
          </div>
        </div>

        <div class="building-grid">
          <article v-for="building in buildingNames" :key="building" class="building-card">
            <h2>{{ building }}</h2>
            <div class="device-grid">
              <button
                v-for="device in devicesByBuilding(building)"
                :key="device.value"
                type="button"
                class="device-button"
                :class="{
                  active: selectedDevice.value === device.value,
                  strain: device.type === 'strainGauge',
                }"
                @click="selectDevice(device)"
              >
                <span>{{ device.label }}</span>
                <small>{{ device.type === 'accelerometer' ? '加速度计' : '应变计' }}</small>
              </button>
            </div>
          </article>
        </div>

        <div class="summary-card">
          <div>
            <p class="summary-label">当前设备</p>
            <h2>{{ selectedDevice.label }}</h2>
            <p class="summary-text">{{ currentStatusText }}</p>
          </div>
          <div class="summary-meta">
            <div>
              <span>设备类型</span>
              <strong>{{ selectedDevice.type === "accelerometer" ? "加速度计" : "应变计" }}</strong>
            </div>
            <div>
              <span>数据来源</span>
              <strong>{{ currentDataSource }}</strong>
            </div>
            <div>
              <span>最后同步</span>
              <strong>{{ lastSyncedAt }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">人工设定阈值</p>
            <h2>查询与保存人工上下限</h2>
          </div>
        </div>

        <div class="note-card">
          本页仅维护业务侧展示的上限与下限。保存时自动换算为后端字段：
          <strong>offset = (上限 + 下限) / 2</strong>，<strong>limit = (上限 - 下限) / 2</strong>。
        </div>

        <div v-for="channel in visibleChannels" :key="channel.key" class="channel-card">
          <div class="channel-header">
            <div>
              <h3>{{ channel.label }}</h3>
              <p>{{ channel.description }}</p>
            </div>
              <span class="channel-tag">上下限展示</span>
          </div>

          <div class="limit-grid">
            <article class="limit-panel current-panel">
              <div class="panel-title">
                <h4>当前值</h4>
                <span>接口返回结果</span>
              </div>
              <div class="metric-row">
                <span>上限</span>
                <strong>{{ formatValue(currentLimits[channel.key].upper) }}</strong>
              </div>
              <div class="metric-row">
                <span>下限</span>
                <strong>{{ formatValue(currentLimits[channel.key].lower) }}</strong>
              </div>
              <div class="metric-row sub-row">
                <span>offset</span>
                <span>{{ formatValue(currentLimits[channel.key].offset) }}</span>
              </div>
              <div class="metric-row sub-row">
                <span>limit</span>
                <span>{{ formatValue(currentLimits[channel.key].threshold) }}</span>
              </div>
            </article>

            <article class="limit-panel edit-panel">
              <div class="panel-title">
                <h4>人工设置</h4>
                <span>提交至后端</span>
              </div>

              <label class="field-row">
                <span>上限</span>
                <UInput v-model="manualLimits[channel.key].upper" type="number" />
              </label>
              <label class="field-row">
                <span>下限</span>
                <UInput v-model="manualLimits[channel.key].lower" type="number" />
              </label>

              <div class="metric-row sub-row">
                <span>换算 offset</span>
                <span>{{ formatValue(getManualCalibrationPreview(channel.key)?.offset) }}</span>
              </div>
              <div class="metric-row sub-row">
                <span>换算 limit</span>
                <span>{{ formatValue(getManualCalibrationPreview(channel.key)?.threshold) }}</span>
              </div>
            </article>

          </div>

          <!-- Threshold zone visualization -->
          <div v-if="currentLimits[channel.key].threshold > 0" class="threshold-zone-section">
            <div class="tz-header">
              <span class="tz-title">阈值区间可视化</span>
              <span class="tz-note">直接展示当前原始阈值范围，绿色为阈值内，红色为超限区</span>
            </div>
            <div class="tz-bar-outer">
              <div class="tz-bar">
                <div class="tz-seg tz-over" title="低于下限，属于超限区"><span>超限</span></div>
                <div
                  class="tz-seg tz-safe tz-safe-range"
                  :title="`原始阈值范围：${formatThresholdRange(currentLimits[channel.key].lower, currentLimits[channel.key].upper)}`"
                >
                  <span>{{ formatThresholdRange(currentLimits[channel.key].lower, currentLimits[channel.key].upper) }}</span>
                </div>
                <div class="tz-seg tz-over" title="高于上限，属于超限区"><span>超限</span></div>
              </div>
              <div class="tz-markers">
                <div class="tz-mark" style="left: 11.54%">
                  <div class="tz-mark-line"></div>
                  <div class="tz-mark-val">{{ formatValue(currentLimits[channel.key].lower) }}</div>
                  <div class="tz-mark-sub">下限</div>
                </div>
                <div class="tz-mark tz-mark-mid" style="left: 50%">
                  <div class="tz-mark-line"></div>
                  <div class="tz-mark-val">{{ formatValue(currentLimits[channel.key].offset) }}</div>
                  <div class="tz-mark-sub">中心</div>
                </div>
                <div class="tz-mark" style="left: 88.46%">
                  <div class="tz-mark-line"></div>
                  <div class="tz-mark-val">{{ formatValue(currentLimits[channel.key].upper) }}</div>
                  <div class="tz-mark-sub">上限</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="action-bar">
          <UButton color="gray" variant="soft" :loading="loadingFetch" @click="fetchThresholds">
            重新查询当前上下限
          </UButton>
          <UButton color="primary" :loading="loadingCalibration" @click="applyManualLimits">
            保存人工上下限
          </UButton>
        </div>
      </section>

      
    </UForm>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";
import * as echarts from 'echarts';
import { ElMessage } from "element-plus";

const API_BASE_URL = "http://8.153.161.229:8009";
const router = useRouter();
const formState = reactive({});

type DeviceType = "accelerometer" | "strainGauge";
type ChannelKey = "x" | "y" | "z" | "ch1" | "ch2";

interface DeviceOption {
  value: string;
  label: string;
  building: string;
  type: DeviceType;
}

interface ChannelDefinition {
  key: ChannelKey;
  label: string;
  description: string;
}

interface LimitState {
  upper: number;
  lower: number;
  offset: number;
  threshold: number;
}

interface ManualLimitState {
  upper: number | string;
  lower: number | string;
}

const deviceOptions: DeviceOption[] = [
  { value: "衷和楼#1G", label: "衷和楼#1G", building: "衷和楼", type: "accelerometer" },
  { value: "衷和楼#1H", label: "衷和楼#1H", building: "衷和楼", type: "accelerometer" },
  { value: "衷和楼#2I", label: "衷和楼#2I", building: "衷和楼", type: "accelerometer" },
  { value: "衷和楼#2J", label: "衷和楼#2J", building: "衷和楼", type: "accelerometer" },
  { value: "衷和楼测点7", label: "衷和楼测点7", building: "衷和楼", type: "accelerometer" },
  { value: "衷和楼#2Y", label: "衷和楼#2Y", building: "衷和楼", type: "strainGauge" },
  { value: "安楼外幕墙1A", label: "安楼外幕墙1A", building: "安楼", type: "accelerometer" },
  { value: "安楼外幕墙1B", label: "安楼外幕墙1B", building: "安楼", type: "accelerometer" },
  { value: "安楼外幕墙1C", label: "安楼外幕墙1C", building: "安楼", type: "accelerometer" },
  { value: "安楼外幕墙2D", label: "安楼外幕墙2D", building: "安楼", type: "accelerometer" },
  { value: "安楼外幕墙2E", label: "安楼外幕墙2E", building: "安楼", type: "accelerometer" },
  { value: "安楼外幕墙2F", label: "安楼外幕墙2F", building: "安楼", type: "accelerometer" },
  { value: "安楼外幕墙2Y", label: "安楼外幕墙2Y", building: "安楼", type: "strainGauge" },
];

const channelDefinitions: Record<ChannelKey, ChannelDefinition> = {
  x: { key: "x", label: "X 轴", description: "加速度计 X 轴通道的当前上下限与人工设置。" },
  y: { key: "y", label: "Y 轴", description: "加速度计 Y 轴通道的当前上下限与人工设置。" },
  z: { key: "z", label: "Z 轴", description: "加速度计 Z 轴通道的当前上下限与人工设置。" },
  ch1: { key: "ch1", label: "Ch1", description: "应变计 Channel 1 的当前上下限与人工设置。" },
  ch2: { key: "ch2", label: "Ch2", description: "应变计 Channel 2 的当前上下限与人工设置。" },
};

const buildingNames = ["衷和楼", "安楼"];
const selectedDevice = ref<DeviceOption>(deviceOptions[0]);
const loadingFetch = ref(false);
const loadingCalibration = ref(false);

const currentDataSource = ref("/data/get_threshold_or_offset");
const lastSyncedAt = ref("尚未同步");
const currentStatusText = ref("请选择设备并查询当前上下限。");

const createLimitMap = () => ({
  x: { upper: 0, lower: 0, offset: 0, threshold: 0 },
  y: { upper: 0, lower: 0, offset: 0, threshold: 0 },
  z: { upper: 0, lower: 0, offset: 0, threshold: 0 },
  ch1: { upper: 0, lower: 0, offset: 0, threshold: 0 },
  ch2: { upper: 0, lower: 0, offset: 0, threshold: 0 },
});

const createManualLimitMap = () => ({
  x: { upper: 0, lower: 0 },
  y: { upper: 0, lower: 0 },
  z: { upper: 0, lower: 0 },
  ch1: { upper: 0, lower: 0 },
  ch2: { upper: 0, lower: 0 },
});

const currentLimits = reactive<Record<ChannelKey, LimitState>>(createLimitMap());
const manualLimits = reactive<Record<ChannelKey, ManualLimitState>>(createManualLimitMap());

const visibleChannels = computed(() =>
  selectedDevice.value.type === "accelerometer"
    ? [channelDefinitions.x, channelDefinitions.y, channelDefinitions.z]
    : [channelDefinitions.ch1, channelDefinitions.ch2]
);

const devicesByBuilding = (buildingName: string) =>
  deviceOptions.filter((device) => device.building === buildingName);

const roundValue = (value: number, digits = 6) => Number(value.toFixed(digits));

const formatValue = (value: number | string | null | undefined, digits = 6) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(digits);
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(digits) : value;
  }

  return "--";
};

const formatThresholdRange = (lower: number, upper: number) =>
  `${formatValue(lower, 3)} ~ ${formatValue(upper, 3)}`;

const formatTimestamp = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;

const backToMain = () => {
  router.push("/");
};

const setCurrentChannel = (key: ChannelKey, offset: number, threshold: number) => {
  const normalizedOffset = roundValue(Number(offset) || 0);
  const normalizedThreshold = roundValue(Math.abs(Number(threshold) || 0));

  currentLimits[key].offset = normalizedOffset;
  currentLimits[key].threshold = normalizedThreshold;
  currentLimits[key].upper = roundValue(normalizedOffset + normalizedThreshold);
  currentLimits[key].lower = roundValue(normalizedOffset - normalizedThreshold);
};

const syncManualChannelFromCurrent = (key: ChannelKey) => {
  manualLimits[key].upper = currentLimits[key].upper;
  manualLimits[key].lower = currentLimits[key].lower;
};

const resetAllChannels = () => {
  (Object.keys(currentLimits) as ChannelKey[]).forEach((key) => {
    setCurrentChannel(key, 0, 0);
    syncManualChannelFromCurrent(key);
  });
};

const parseManualCalibration = (key: ChannelKey) => {
  const upper = Number(manualLimits[key].upper);
  const lower = Number(manualLimits[key].lower);

  if (!Number.isFinite(upper) || !Number.isFinite(lower) || upper <= lower) {
    return null;
  }

  return {
    upper: roundValue(upper),
    lower: roundValue(lower),
    offset: roundValue((upper + lower) / 2),
    threshold: roundValue(Math.abs(upper - lower) / 2),
  };
};

const getManualCalibrationPreview = (key: ChannelKey) => parseManualCalibration(key);

const fetchThresholds = async () => {
  loadingFetch.value = true;
  currentStatusText.value = `正在查询 ${selectedDevice.value.label} 的当前上下限...`;

  try {
    const response = await axios.get(`${API_BASE_URL}/data/get_threshold_or_offset`, {
      params: {
        device_name: selectedDevice.value.value,
        device_type: selectedDevice.value.type,
      },
    });

    if (response.data.status !== "success") {
      currentStatusText.value = "接口已响应，但没有返回有效的上下限信息。";
      ElMessage.error("获取上下限失败");
      return;
    }

    const data = response.data.data ?? {};
    resetAllChannels();

    if (selectedDevice.value.type === "accelerometer") {
      setCurrentChannel("x", Number(data.x_offset ?? 0), Number(data.x_limit ?? 0));
      setCurrentChannel("y", Number(data.y_offset ?? 0), Number(data.y_limit ?? 0));
      setCurrentChannel("z", Number(data.z_offset ?? 0), Number(data.z_limit ?? 0));
      syncManualChannelFromCurrent("x");
      syncManualChannelFromCurrent("y");
      syncManualChannelFromCurrent("z");
    } else {
      setCurrentChannel("ch1", Number(data.ch1_offset ?? 0), Number(data.ch1_limit ?? 0));
      setCurrentChannel("ch2", Number(data.ch2_offset ?? 0), Number(data.ch2_limit ?? 0));
      syncManualChannelFromCurrent("ch1");
      syncManualChannelFromCurrent("ch2");
    }

    currentDataSource.value = "/data/get_threshold_or_offset";
    lastSyncedAt.value = formatTimestamp(new Date());
    currentStatusText.value = `${selectedDevice.value.label} 的当前上下限已同步，可以继续人工调整，并查看原始阈值范围。`;
  } catch (error) {
    console.error("获取上下限失败:", error);
    currentDataSource.value = "接口获取失败";
    lastSyncedAt.value = formatTimestamp(new Date());
    currentStatusText.value = "当前上下限获取失败，页面保留本地编辑值。";
    ElMessage.error("获取上下限失败");
  } finally {
    loadingFetch.value = false;
  }
};

const updateSingle = async (item: {
  device_name: string;
  type: string;
  value: number | string;
}) => {
  const response = await fetch(
    `${API_BASE_URL}/data/update_threshold_or_offset?device_name=${encodeURIComponent(
      item.device_name
    )}&type=${encodeURIComponent(item.type)}&value=${encodeURIComponent(item.value)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );

  return response.ok;
};

const applyManualLimits = async () => {
  loadingCalibration.value = true;

  try {
    const channelCalibrations = visibleChannels.value.map((channel) => {
      const parsed = parseManualCalibration(channel.key);
      if (!parsed) {
        throw new Error(`${channel.label} 的上下限输入无效，请确认上限必须大于下限。`);
      }

      return {
        key: channel.key,
        ...parsed,
      };
    });

    const updates = channelCalibrations.flatMap((item) => [
      { device_name: selectedDevice.value.value, type: `${item.key}_offset`, value: item.offset },
      { device_name: selectedDevice.value.value, type: `${item.key}_limit`, value: item.threshold },
    ]);

    const results = await Promise.all(updates.map(updateSingle));

    if (!results.every(Boolean)) {
      ElMessage.warning("部分上下限更新失败，请检查网络连接。");
      return;
    }

    channelCalibrations.forEach((item) => {
      setCurrentChannel(item.key, item.offset, item.threshold);
      syncManualChannelFromCurrent(item.key);
    });

    currentDataSource.value = "人工设置已提交到现有接口";
    lastSyncedAt.value = formatTimestamp(new Date());
    currentStatusText.value = `${selectedDevice.value.label} 的人工上下限已保存。`;
    ElMessage.success(`${selectedDevice.value.label} 的人工上下限已保存`);
  } catch (error) {
    console.error("保存人工上下限失败:", error);
    ElMessage.error(error instanceof Error ? error.message : "保存人工上下限失败");
  } finally {
    loadingCalibration.value = false;
  }
};

const selectDevice = async (device: DeviceOption) => {
  selectedDevice.value = device;
  resetAllChannels();
  currentDataSource.value = "/data/get_threshold_or_offset";
  lastSyncedAt.value = "查询中";
  currentStatusText.value = `已切换到 ${device.label}，正在查询当前上下限。`;
  ElMessage.info(`已选择 ${device.label}`);
  await fetchThresholds();
};

const weatherData = reactive<{
  wind_speed_ms: number | null;
  wind_bin: string;
}>({
  wind_speed_ms: null,
  wind_bin: '',
});

const windGaugeRef = ref<HTMLDivElement | null>(null);
let windGaugeChart: echarts.ECharts | null = null;

const BEAUFORT_SCALE = [
  { max: 0.3,      level: 0,  label: '静风',   color: '#10b981' },
  { max: 1.6,      level: 1,  label: '软风',   color: '#22c55e' },
  { max: 3.4,      level: 2,  label: '轻风',   color: '#4ade80' },
  { max: 5.5,      level: 3,  label: '微风',   color: '#84cc16' },
  { max: 8.0,      level: 4,  label: '和风',   color: '#84cc16' },
  { max: 10.8,     level: 5,  label: '清劲风', color: '#eab308' },
  { max: 13.9,     level: 6,  label: '强风',   color: '#f97316' },
  { max: 17.2,     level: 7,  label: '疾风',   color: '#fb923c' },
  { max: 20.8,     level: 8,  label: '大风',   color: '#ef4444' },
  { max: 24.5,     level: 9,  label: '烈风',   color: '#dc2626' },
  { max: 28.5,     level: 10, label: '狂风',   color: '#b91c1c' },
  { max: 32.7,     level: 11, label: '暴风',   color: '#7c3aed' },
  { max: Infinity, level: 12, label: '台风',   color: '#6d28d9' },
];

const windBeaufort = computed(() => {
  const ms = weatherData.wind_speed_ms;
  if (ms === null) return { level: '--' as string | number, label: '未知', color: '#94a3b8' };
  return BEAUFORT_SCALE.find(b => ms < b.max) ?? BEAUFORT_SCALE[BEAUFORT_SCALE.length - 1];
});

const buildWindGaugeOption = (speed: number | null): any => {
  const s = speed ?? 0;
  return {
    backgroundColor: 'transparent',
    series: [{
      type: 'gauge',
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max: 30,
      splitNumber: 6,
      radius: '85%',
      center: ['50%', '58%'],
      axisLine: {
        lineStyle: {
          width: 14,
          color: [
            [0.167, '#22c55e'],
            [0.333, '#84cc16'],
            [0.5,   '#eab308'],
            [0.667, '#f97316'],
            [0.833, '#ef4444'],
            [1.0,   '#7c3aed'],
          ]
        }
      },
      axisTick: { show: false },
      splitLine: {
        length: 10,
        lineStyle: { color: 'rgba(0,0,0,0.15)', width: 2 }
      },
      axisLabel: {
        color: '#475569',
        fontSize: 10,
        distance: 16,
        formatter: (v: number) => `${v}`,
      },
      pointer: {
        length: '62%',
        width: 5,
        itemStyle: { color: 'auto' }
      },
      detail: {
        valueAnimation: true,
        formatter: (v: number) => speed !== null ? `${v} m/s` : '--',
        color: '#0f172a',
        fontSize: 18,
        fontWeight: 700,
        offsetCenter: [0, '45%'],
      },
      data: [{ value: s }]
    }]
  };
};

const initWindGauge = () => {
  if (!windGaugeRef.value) return;
  windGaugeChart?.dispose();
  windGaugeChart = echarts.init(windGaugeRef.value, null, { renderer: 'svg' });
  windGaugeChart.setOption(buildWindGaugeOption(weatherData.wind_speed_ms));
};

watch(
  () => weatherData.wind_speed_ms,
  (ms: number | null) => windGaugeChart?.setOption(buildWindGaugeOption(ms))
);

onUnmounted(() => {
  windGaugeChart?.dispose();
  windGaugeChart = null;
  overviewChart?.dispose();
  overviewChart = null;
});

const schedulerConfig = reactive({
  type: 'interval',
  minutes: 60,
  cronTime: new Date(new Date().setHours(2, 0, 0, 0)), // 默认凌晨2点
  isRunning: false
});

const isApplying = ref(false);

const fetchWeatherData = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/agent/weather-status`);
    if (res.data.status === 'success') {
      weatherData.wind_speed_ms = res.data.wind_speed_ms ?? null;
      weatherData.wind_bin = res.data.wind_bin ?? '';
    }
  } catch (error) {
    console.error("读取气象失败", error);
  }
};

const applyWeatherRulesNow = async () => {
  try {
    isApplying.value = true;
    const res = await axios.post(`${API_BASE_URL}/agent/execute-now`);
    ElMessage.success(res.data.msg);
  } catch (error) {
    ElMessage.error("一键设置失败");
  } finally {
    isApplying.value = false;
  }
};

const syncScheduleConfigFromBackend = (config: any) => {
  schedulerConfig.isRunning = Boolean(config?.isRunning);

  if (config?.type === 'cron') {
    schedulerConfig.type = 'cron';
    const hour = Number.isFinite(Number(config.hour)) ? Number(config.hour) : 0;
    const minute = Number.isFinite(Number(config.minute)) ? Number(config.minute) : 0;
    schedulerConfig.cronTime = new Date(new Date().setHours(hour, minute, 0, 0));
    return;
  }

  schedulerConfig.type = 'interval';
  if (Number.isFinite(Number(config?.minutes))) {
    schedulerConfig.minutes = Number(config.minutes);
  }
};

const fetchScheduleConfig = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/agent/schedule-config`);
    if (res.data.status === 'success') {
      syncScheduleConfigFromBackend(res.data.data ?? {});
    }
  } catch (error) {
    console.error("读取定时任务配置失败", error);
  }
};

const saveSchedule = async () => {
  try {
    const payload = {
      type: schedulerConfig.type,
      minutes: schedulerConfig.minutes,
      hour: schedulerConfig.cronTime ? schedulerConfig.cronTime.getHours() : 0,
      minute: schedulerConfig.cronTime ? schedulerConfig.cronTime.getMinutes() : 0
    };
    const res = await axios.post(`${API_BASE_URL}/agent/set-schedule`, payload);
    schedulerConfig.isRunning = true;
    await fetchScheduleConfig();
    ElMessage.success(res.data.msg);
  } catch (error) {
    ElMessage.error("定时任务设置失败");
  }
};

const stopSchedule = async () => {
  try {
    const payload = { type: 'stop' };
    const res = await axios.post(`${API_BASE_URL}/agent/set-schedule`, payload);
    schedulerConfig.isRunning = false;
    await fetchScheduleConfig();
    ElMessage.success(res.data.msg);
  } catch (error) {
    ElMessage.error("停止任务失败");
  }
};


// ── All-Device Threshold Overview ──
interface OverviewChannelData {
  lower: number;
  upper: number;
  offset: number;
  threshold: number;
}
interface DeviceOverviewState {
  loaded: boolean;
  loading: boolean;
  error: boolean;
  channels: Partial<Record<ChannelKey, OverviewChannelData>>;
}
const overviewSnapshots = reactive<Record<string, DeviceOverviewState>>(
  Object.fromEntries(deviceOptions.map(d => [d.value, { loaded: false, loading: false, error: false, channels: {} }]))
);
const overviewChartRef = ref<HTMLDivElement | null>(null);
let overviewChart: echarts.ECharts | null = null;
const loadingOverview = ref(false);

const overviewLoadedCount = computed(() =>
  deviceOptions.filter(d => overviewSnapshots[d.value]?.loaded).length
);

interface OverviewRow {
  label: string;
  lower: number;
  upper: number;
  offset: number;
  color: string;
}

const OVERVIEW_ROW_HEIGHT = 22;
const OVERVIEW_BAR_WIDTH = 12;
const OVERVIEW_CHART_PADDING = 44;

const OVERVIEW_COLORS: Record<string, string> = {
  '衷和楼-accelerometer': '#3b82f6',
  '衷和楼-strainGauge':   '#f59e0b',
  '安楼-accelerometer':   '#10b981',
  '安楼-strainGauge':     '#8b5cf6',
};

const overviewChartRows = computed<OverviewRow[]>(() => {
  const rows: OverviewRow[] = [];
  const chLabels: Record<ChannelKey, string> = { x: 'X', y: 'Y', z: 'Z', ch1: 'Ch1', ch2: 'Ch2' };
  for (const device of deviceOptions) {
    const snap = overviewSnapshots[device.value];
    if (!snap?.loaded) continue;
    const channels: ChannelKey[] = device.type === 'accelerometer' ? ['x', 'y', 'z'] : ['ch1', 'ch2'];
    const color = OVERVIEW_COLORS[`${device.building}-${device.type}`] ?? '#64748b';
    for (const ch of channels) {
      const d = snap.channels[ch];
      if (!d) continue;
      rows.push({ label: `${device.label} · ${chLabels[ch]}`, lower: d.lower, upper: d.upper, offset: d.offset, color });
    }
  }
  return rows;
});

const buildOverviewChartOption = (rows: OverviewRow[]): any => {
  if (rows.length === 0) return {};
  const allVals = rows.flatMap(r => [r.lower, r.upper]);
  const xMin = Math.min(...allVals);
  const xMax = Math.max(...allVals);
  const xPad = Math.max((xMax - xMin) * 0.08, 0.0001);

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const idx = params.dataIndex ?? 0;
        const row = rows[idx];
        if (!row) return '';
        return `<b>${row.label}</b><br/>上限：${row.upper.toFixed(6)}<br/>下限：${row.lower.toFixed(6)}<br/>中心：${row.offset.toFixed(6)}<br/>范围幅：${(row.upper - row.lower).toFixed(6)}`;
      },
    },
    animation: false,
    grid: { left: 8, right: 20, top: 4, bottom: 20, containLabel: true },
    xAxis: {
      type: 'value',
      min: xMin - xPad,
      max: xMax + xPad,
      axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => v.toFixed(3) },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    yAxis: {
      type: 'category',
      data: rows.map(r => r.label),
      axisLabel: { color: '#334155', fontSize: 11 },
      inverse: true,
    },
    series: [
      {
        type: 'custom',
        coordinateSystem: 'cartesian2d',
        data: rows.map(r => [r.lower, r.upper, r.offset]),
        renderItem: (params: any, api: any) => {
          const lower = Number(api.value(0));
          const upper = Number(api.value(1));
          const offset = Number(api.value(2));
          const y = api.coord([0, params.dataIndex])[1];
          const lowerPoint = api.coord([lower, params.dataIndex]);
          const upperPoint = api.coord([upper, params.dataIndex]);
          const centerPoint = api.coord([offset, params.dataIndex]);
          const left = Math.min(lowerPoint[0], upperPoint[0]);
          const width = Math.max(2, Math.abs(upperPoint[0] - lowerPoint[0]));
          const barHeight = Math.max(OVERVIEW_BAR_WIDTH, api.size([0, 1])[1] * 0.48);
          const color = rows[params.dataIndex]?.color ?? '#64748b';

          return {
            type: 'group',
            children: [
              {
                type: 'rect',
                shape: {
                  x: left,
                  y: y - barHeight / 2,
                  width,
                  height: barHeight,
                  r: 3,
                },
                style: {
                  fill: color,
                  opacity: 0.78,
                },
              },
              {
                type: 'line',
                shape: {
                  x1: centerPoint[0],
                  y1: y - barHeight / 2 - 2,
                  x2: centerPoint[0],
                  y2: y + barHeight / 2 + 2,
                },
                style: {
                  stroke: '#0f172a',
                  lineWidth: 2,
                  opacity: 0.85,
                },
              },
            ],
          };
        },
      },
    ],
  };
};

const initOverviewChart = () => {
  if (!overviewChartRef.value) return;
  overviewChart?.dispose();
  overviewChart = echarts.init(overviewChartRef.value);
};

const updateOverviewChart = async () => {
  if (!overviewChart) return;
  const rows = overviewChartRows.value;
  if (rows.length === 0) return;
  const h = Math.max(240, rows.length * OVERVIEW_ROW_HEIGHT + OVERVIEW_CHART_PADDING);
  if (overviewChartRef.value) overviewChartRef.value.style.height = `${h}px`;
  // 等 DOM 应用新高度后再 resize，否则 ECharts 仍按旧尺寸布局留下空白
  await nextTick();
  overviewChart.resize({ height: h });
  overviewChart.setOption(buildOverviewChartOption(rows), true);
};

// 当容器被 v-if 真正挂载后再初始化；之后数据刷新时也保持更新
watch(overviewChartRef, async (el) => {
  if (el) { await nextTick(); initOverviewChart(); await updateOverviewChart(); }
  else { overviewChart?.dispose(); overviewChart = null; }
});

watch(overviewChartRows, () => {
  if (overviewChart) nextTick(updateOverviewChart);
}, { deep: true });

const fetchAllThresholds = async () => {
  loadingOverview.value = true;
  deviceOptions.forEach(d => {
    overviewSnapshots[d.value].loading = true;
    overviewSnapshots[d.value].error   = false;
  });
  await Promise.allSettled(deviceOptions.map(async (device) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/data/get_threshold_or_offset`, {
        params: { device_name: device.value, device_type: device.type },
      });
      const data = res.data?.data ?? {};
      const chs: Partial<Record<ChannelKey, OverviewChannelData>> = {};
      const keys: ChannelKey[] = device.type === 'accelerometer' ? ['x', 'y', 'z'] : ['ch1', 'ch2'];
      for (const ch of keys) {
        const off = roundValue(Number(data[`${ch}_offset`] ?? 0));
        const lim = roundValue(Math.abs(Number(data[`${ch}_limit`] ?? 0)));
        chs[ch] = { offset: off, threshold: lim, upper: roundValue(off + lim), lower: roundValue(off - lim) };
      }
      overviewSnapshots[device.value] = { loaded: true, loading: false, error: false, channels: chs };
    } catch {
      overviewSnapshots[device.value].loading = false;
      overviewSnapshots[device.value].error   = true;
    }
  }));
  loadingOverview.value = false;
};

onMounted(async () => {
  await fetchWeatherData();
  initWindGauge();
  await fetchScheduleConfig();
  await fetchThresholds();
});
</script>

<style scoped>
.page-shell {
  /* 在振动中心布局内由父级 overflow-y-auto 承载滚动，此处不锁死 100vh，便于滚轮滑完整页 */
  min-height: min-content;
  background:
    radial-gradient(circle at top right, rgba(22, 163, 74, 0.1), transparent 26%),
    linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
  padding: 56px 16px 32px;
}

.top-action {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 10;
}

.page-body {
  max-width: 1160px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.panel {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 20px;
  padding: 22px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}

.panel-heading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.panel-heading h1,
.panel-heading h2 {
  margin: 4px 0 0;
  font-size: 24px;
  color: #0f172a;
}

.eyebrow {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #16a34a;
  text-transform: uppercase;
}

.status-chip {
  min-width: 180px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 16px;
  padding: 12px 14px;
  color: #166534;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-chip strong {
  font-size: 18px;
}

.weather-panel {
  border: 2px solid #bfdbfe;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%);
}

.weather-panel .panel-heading h2 {
  color: #1e40af;
}

.weather-eyebrow {
  color: #2563eb;
}

.weather-status-chip {
  background: #dbeafe;
  border-color: #bfdbfe;
  color: #1e40af;
}

.weather-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.weather-summary-card,
.weather-action-card,
.schedule-card {
  background: #fff;
  border: 1px solid #bfdbfe;
  border-radius: 16px;
  padding: 16px;
}

.weather-summary-card span {
  display: block;
  color: #64748b;
  font-size: 13px;
  margin-bottom: 8px;
}

.weather-summary-card strong {
  color: #1e3a8a;
  font-size: 17px;
}

.weather-note-card {
  background: #fff;
  border-left: 4px solid #3b82f6;
}

.weather-note-card p {
  margin: 0;
}

.weather-note-card p + p {
  margin-top: 8px;
}

.weather-action-layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.2fr);
  gap: 16px;
}

.weather-action-card h3,
.schedule-card h3 {
  margin: 0 0 10px;
  font-size: 17px;
  color: #1e3a8a;
}

.weather-action-card p {
  margin: 0 0 14px;
  color: #475569;
  line-height: 1.6;
}

.schedule-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  color: #4b5563;
  font-size: 14px;
}

.schedule-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.building-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.building-card {
  border: 1px solid #dbeafe;
  border-radius: 16px;
  padding: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.building-card h2 {
  margin: 0 0 12px;
  font-size: 18px;
  color: #0f172a;
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.device-button {
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  background: #fff;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: 0.2s ease;
}

.device-button span {
  font-weight: 700;
  color: #0f172a;
}

.device-button small {
  color: #64748b;
}

.device-button.active {
  border-color: #16a34a;
  box-shadow: 0 10px 20px rgba(22, 163, 74, 0.14);
  transform: translateY(-1px);
}

.device-button.strain.active {
  border-color: #d97706;
  box-shadow: 0 10px 20px rgba(217, 119, 6, 0.16);
}

.summary-card {
  margin-top: 18px;
  border-radius: 18px;
  padding: 18px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: #f8fafc;
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
  gap: 18px;
}

.summary-card h2 {
  margin: 6px 0 8px;
  font-size: 28px;
}

.summary-label {
  margin: 0;
  color: #94a3b8;
}

.summary-text {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.6;
}

.summary-meta {
  display: grid;
  gap: 12px;
}

.summary-meta div {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 12px 14px;
}

.summary-meta span {
  display: block;
  color: #94a3b8;
  font-size: 13px;
  margin-bottom: 6px;
}

.summary-meta strong {
  color: #f8fafc;
}

.note-card {
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid #dbeafe;
  padding: 14px 16px;
  color: #334155;
  line-height: 1.7;
  margin-bottom: 18px;
}

.channel-card + .channel-card {
  margin-top: 18px;
}

.channel-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.channel-header h3 {
  margin: 0 0 6px;
  color: #0f172a;
}

.channel-header p {
  margin: 0;
  color: #64748b;
}

.channel-tag {
  background: #dcfce7;
  color: #166534;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
}

.limit-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.limit-panel {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 16px;
  background: #fff;
}

.current-panel {
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
}

.edit-panel {
  background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);
}

.panel-title {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}

.panel-title h4 {
  margin: 0;
  color: #0f172a;
}

.panel-title span {
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}

.metric-row,
.field-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.metric-row + .metric-row,
.field-row + .field-row {
  margin-top: 12px;
}

.metric-row strong {
  color: #0f172a;
}

.sub-row {
  color: #64748b;
  font-size: 14px;
}

.field-row span {
  min-width: 48px;
  color: #334155;
}

.action-bar {
  margin-top: 18px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 960px) {
  .building-grid,
  .summary-card,
  .weather-summary-grid,
  .wind-visual-grid,
  .weather-action-layout,
  .limit-grid {
    grid-template-columns: 1fr;
  }

  .panel-heading,
  .channel-header {
    flex-direction: column;
  }
}

/* ── Wind Visual Panel ─────────────────────────────────────────────── */

.wind-visual-grid {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 16px;
  margin-bottom: 16px;
  align-items: start;
}

.wind-gauge-card {
  background: #fff;
  border: 1px solid #bfdbfe;
  border-radius: 16px;
  padding: 14px 12px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.gauge-eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  color: #2563eb;
  text-transform: uppercase;
  align-self: flex-start;
}

.gauge-canvas {
  width: 100%;
  height: 175px;
}

.gauge-badge-row {
  margin-top: 4px;
}

.beaufort-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.wind-info-stack {
  background: #fff;
  border: 1px solid #bfdbfe;
  border-radius: 16px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
  min-height: 100%;
}

.wind-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 12px;
  background: rgba(239, 246, 255, 0.65);
  border-radius: 10px;
}

.wind-info-row span {
  color: #64748b;
  font-size: 13px;
}

.wind-info-row strong {
  color: #1e3a8a;
  font-size: 14px;
  font-weight: 700;
}

/* ── Threshold Zone Visualization ──────────────────────────────────── */

.threshold-zone-section {
  margin-top: 16px;
  padding: 14px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.tz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tz-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.tz-note {
  font-size: 11px;
  color: #64748b;
}

.tz-bar-outer {
  position: relative;
  padding-bottom: 44px;
}

.tz-bar {
  display: flex;
  height: 32px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.08);
}

.tz-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  white-space: nowrap;
}

.tz-seg span {
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.tz-over { flex: 0.35; }
.tz-safe { flex: 1.3; }

.tz-over {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.tz-safe {
  background: linear-gradient(90deg, #16a34a, #22c55e, #16a34a);
}

.tz-safe-range span {
  padding: 0 10px;
  font-size: 9px;
  letter-spacing: 0.01em;
  font-variant-numeric: tabular-nums;
}

.tz-markers {
  position: relative;
  height: 44px;
}

.tz-mark {
  position: absolute;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  top: 0;
}

.tz-mark-line {
  width: 1.5px;
  height: 10px;
  background: #475569;
}

.tz-mark-val {
  font-size: 10px;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  margin-top: 2px;
}

.tz-mark-sub {
  font-size: 9px;
  color: #64748b;
  white-space: nowrap;
}

.tz-mark-mid .tz-mark-line {
  background: #15803d;
}

.tz-mark-mid .tz-mark-val {
  color: #15803d;
}

/* ── Overview Panel ── */
.overview-eyebrow { color: #7c3aed; }

.overview-panel .panel-heading { align-items: flex-start; }

.overview-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.overview-loaded-tag {
  font-size: 12px;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 2px 10px;
  white-space: nowrap;
}
.overview-loaded-tag.all-loaded {
  color: #16a34a;
  background: #dcfce7;
  border-color: #86efac;
}

.overview-legend {
  display: flex;
  align-items: center;
  gap: 6px 14px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  font-size: 12px;
  color: #64748b;
}
.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

.overview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 0;
  color: #94a3b8;
  font-size: 14px;
  text-align: center;
}
.overview-loading {
  padding: 16px 0;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.overview-chart-canvas {
  width: 100%;
  min-height: 240px;
  transition: height 0.3s ease;
}

.overview-status-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}
.overview-status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #94a3b8;
}
.st-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e2e8f0;
  flex-shrink: 0;
}
.overview-status-item.st-loaded .st-dot  { background: #22c55e; }
.overview-status-item.st-loaded          { color: #374151; }
.overview-status-item.st-error  .st-dot  { background: #ef4444; }
.overview-status-item.st-error           { color: #dc2626; }
.overview-status-item.st-loading .st-dot { background: #f59e0b; animation: pulse-dot 1s infinite; }
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

</style>
