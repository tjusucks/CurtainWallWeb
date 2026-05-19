<template>
  <div class="page-shell detail-shell">
    <div class="detail-topbar">
      <UButton color="gray" variant="ghost" @click="backToList">返回设备列表</UButton>
      <el-button type="primary" @click="backToMain">返回主页</el-button>
    </div>

    <div class="page-body">
      <section v-if="selectedDevice" class="panel hero-panel">
        <p class="hero-breadcrumb">阈值设置 / 二级工作区 / {{ selectedDevice.label }}</p>
        <div class="hero-layout">
          <div>
            <p class="eyebrow hero-eyebrow">设备工作区</p>
            <h1>{{ selectedDevice.label }}</h1>
            <p class="hero-text">
              当前页面只针对该设备进行阈值查看与编辑。设备名称会固定显示，避免跨设备误设置。
            </p>
          </div>

          <div class="hero-command-bar">
            <UButton color="gray" variant="soft" :loading="loadingFetch" @click="fetchThresholds">
              重新查询当前上下限
            </UButton>
            <UButton color="primary" :loading="loadingCalibration" @click="applyManualLimits">
              保存人工上下限
            </UButton>
          </div>
        </div>

        <div class="hero-meta-grid">
          <div class="hero-meta-card">
            <span>所属楼栋</span>
            <strong>{{ selectedDevice.building }}</strong>
          </div>
          <div class="hero-meta-card">
            <span>设备类型</span>
            <strong>{{ selectedDevice.type === "accelerometer" ? "加速度计" : "应变计" }}</strong>
          </div>
          <div class="hero-meta-card">
            <span>数据来源</span>
            <strong>{{ currentDataSource }}</strong>
          </div>
          <div class="hero-meta-card">
            <span>最后同步</span>
            <strong>{{ lastSyncedAt }}</strong>
          </div>
        </div>
      </section>

      <section v-if="selectedDevice" class="panel detail-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">人工设定阈值</p>
            <h2>查询与保存人工上下限</h2>
          </div>
          <div class="workspace-lock-chip">
            当前编辑设备
            <strong>{{ selectedDevice.label }}</strong>
          </div>
        </div>

        <div class="note-card detail-note-card">
          本页仅维护该设备的业务侧展示上限与下限。保存时自动换算为后端字段：
          <strong>offset = (上限 + 下限) / 2</strong>，<strong>limit = (上限 - 下限) / 2</strong>。
        </div>

        <div v-for="channel in visibleChannels" :key="channel.key" class="channel-card">
          <div class="channel-header">
            <div>
              <h3>{{ channel.label }}</h3>
              <p>{{ channel.description }}</p>
            </div>
            <span class="channel-tag">{{ selectedDevice.label }}</span>
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

      <section v-else class="panel empty-state-panel">
        <p class="eyebrow">设备未找到</p>
        <h2>请从设备列表重新进入阈值工作区</h2>
        <p>当前链接没有携带有效设备信息，无法判断要编辑哪一台设备。</p>
        <div class="empty-actions">
          <UButton color="primary" @click="backToList">返回设备列表</UButton>
          <el-button @click="backToMain">返回主页</el-button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import { ElMessage } from "element-plus";

const API_BASE_URL = "http://8.153.161.229:8009";
const router = useRouter();
const route = useRoute();

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

const loadingFetch = ref(false);
const loadingCalibration = ref(false);
const currentDataSource = ref("/data/get_threshold_or_offset");
const lastSyncedAt = ref("尚未同步");

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

const routeDeviceValue = computed(() => {
  const raw = route.query.device;
  return Array.isArray(raw) ? raw[0] : raw;
});

const selectedDevice = computed<DeviceOption | null>(() => {
  if (typeof routeDeviceValue.value !== "string" || !routeDeviceValue.value) {
    return null;
  }
  return deviceOptions.find((device) => device.value === routeDeviceValue.value) ?? null;
});

const visibleChannels = computed(() => {
  if (!selectedDevice.value) {
    return [] as ChannelDefinition[];
  }

  return selectedDevice.value.type === "accelerometer"
    ? [channelDefinitions.x, channelDefinitions.y, channelDefinitions.z]
    : [channelDefinitions.ch1, channelDefinitions.ch2];
});

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

const backToList = () => {
  router.push("/vibration/parameter");
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
  if (!selectedDevice.value) {
    return;
  }

  loadingFetch.value = true;

  try {
    const response = await axios.get(`${API_BASE_URL}/data/get_threshold_or_offset`, {
      params: {
        device_name: selectedDevice.value.value,
        device_type: selectedDevice.value.type,
      },
    });

    if (response.data.status !== "success") {
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
  } catch (error) {
    console.error("获取上下限失败:", error);
    currentDataSource.value = "接口获取失败";
    lastSyncedAt.value = formatTimestamp(new Date());
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
  if (!selectedDevice.value) {
    return;
  }

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
      { device_name: selectedDevice.value!.value, type: `${item.key}_offset`, value: item.offset },
      { device_name: selectedDevice.value!.value, type: `${item.key}_limit`, value: item.threshold },
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
    ElMessage.success(`${selectedDevice.value.label} 的人工上下限已保存`);
  } catch (error) {
    console.error("保存人工上下限失败:", error);
    ElMessage.error(error instanceof Error ? error.message : "保存人工上下限失败");
  } finally {
    loadingCalibration.value = false;
  }
};

watch(
  selectedDevice,
  async (device) => {
    resetAllChannels();
    currentDataSource.value = "/data/get_threshold_or_offset";
    lastSyncedAt.value = "尚未同步";

    if (device) {
      await fetchThresholds();
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.page-shell {
  min-height: min-content;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 28%),
    linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
  padding: 32px 16px 40px;
}

.page-body {
  max-width: 1160px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-topbar {
  max-width: 1160px;
  margin: 0 auto 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.panel {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 20px;
  padding: 22px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}

.hero-panel {
  border: 1px solid rgba(59, 130, 246, 0.18);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.92) 0%, rgba(255, 255, 255, 0.98) 100%);
}

.hero-breadcrumb {
  margin: 0 0 14px;
  color: #475569;
  font-size: 12px;
  letter-spacing: 0.04em;
}

.hero-layout {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}

.eyebrow {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #2563eb;
  text-transform: uppercase;
}

.hero-panel h1,
.panel-heading h2 {
  margin: 4px 0 0;
  font-size: 28px;
  color: #0f172a;
}

.hero-text {
  margin: 12px 0 0;
  max-width: 720px;
  color: #475569;
  line-height: 1.7;
}

.hero-command-bar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.hero-meta-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.hero-meta-card {
  border-radius: 16px;
  padding: 14px 16px;
  border: 1px solid rgba(191, 219, 254, 0.9);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(12px);
}

.hero-meta-card span {
  display: block;
  color: #64748b;
  font-size: 12px;
  margin-bottom: 6px;
}

.hero-meta-card strong {
  color: #0f172a;
  font-size: 15px;
}

.panel-heading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.workspace-lock-chip {
  min-width: 220px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 16px;
  padding: 12px 14px;
  color: #1d4ed8;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.workspace-lock-chip strong {
  font-size: 18px;
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

.detail-note-card {
  border-left: 4px solid #3b82f6;
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
  background: #dbeafe;
  color: #1d4ed8;
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
  background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
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

.tz-mark-mid .tz-mark-line,
.tz-mark-mid .tz-mark-val {
  color: #15803d;
  background: #15803d;
}

.tz-mark-mid .tz-mark-val {
  background: transparent;
}

.action-bar,
.empty-actions {
  margin-top: 18px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.empty-state-panel h2 {
  margin: 8px 0 10px;
  color: #0f172a;
}

.empty-state-panel p:not(.eyebrow) {
  margin: 0;
  color: #475569;
}

@media (max-width: 960px) {
  .hero-layout,
  .panel-heading,
  .channel-header {
    flex-direction: column;
  }

  .hero-meta-grid,
  .limit-grid {
    grid-template-columns: 1fr;
  }

  .detail-topbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>