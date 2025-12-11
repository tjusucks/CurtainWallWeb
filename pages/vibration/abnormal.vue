<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 顶部导航 -->
    <div class="bg-white shadow-sm">
      <div class="container mx-auto px-4 py-4 flex justify-between items-center">
        <h1 class="text-xl font-semibold">异常监控与统计</h1>
        <div class="flex items-center space-x-4">
          <el-tooltip content="X/Y/Z轴及CH1/CH2通道异常数据监控" placement="bottom">
            <el-icon><InfoFilled /></el-icon>
          </el-tooltip>
          <el-button type="primary" @click="router.push('/')">返回主页</el-button>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="container mx-auto px-4 py-6">
      <!-- 筛选条件 -->
      <div class="bg-white rounded p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <!-- 设备选择 -->
          <div>
            <label class="block mb-2">设备选择</label>
            <el-cascader
              v-model="params.device"
              :options="cascaderDevices"
              :props="cascaderProps"
              placeholder="请选择设备"
              class="w-full"
              :disabled="loading"
              @change="handleDeviceChange"
            >
              <template #default="{ node, data }">
                <span>
                  <span
                    class="inline-block h-2 w-2 flex-shrink-0 rounded-full mr-2 bg-green-400"
                    aria-hidden="true"
                    v-if="data.children"
                  />
                  <span
                    class="inline-block h-2 w-2 flex-shrink-0 rounded-full mr-2"
                    :class="{'bg-green-400': !data.children && data.online, 'bg-gray-400': !data.children && !data.online}"
                    aria-hidden="true"
                    v-else
                  />
                  {{ data.label }}
                  <span v-if="!data.children" class="ml-1 text-xs text-gray-500">(在线)</span>
                </span>
              </template>
            </el-cascader>
          </div>

          <!-- 方向选择 -->
          <div>
            <label class="block mb-2">异常方向</label>
            <el-cascader
              v-model="params.direction"
              :options="filteredDirectionOptions"
              :props="directionProps"
              placeholder="请选择方向"
              class="w-full"
              :disabled="loading"
              @change="handleDirectionChange"
            >
              <template #default="{ node, data }">
                <span>{{ data.label }}</span>
              </template>
            </el-cascader>
          </div>

          <!-- 时间选择 -->
          <div class="md:col-span-2">
            <label class="block mb-2">时间范围</label>
            <div class="flex items-center space-x-2">
              <el-date-picker
                v-model="params.start_time"
                type="datetime"
                placeholder="开始时间"
                value-format="YYYY-MM-DD HH:mm:ss"
                class="!w-[220px]"
                :disabled="loading"
                :disabledDate="disabledStartDate"
                :shortcuts="startDateShortcuts"
              />
              <span class="text-gray-500">至</span>
              <el-date-picker
                v-model="params.end_time"
                type="datetime"
                placeholder="结束时间"
                value-format="YYYY-MM-DD HH:mm:ss"
                class="!w-[220px]"
                :disabled="loading"
                :disabledDate="disabledEndDate"
                :shortcuts="endDateShortcuts"
              />
            </div>
          </div>
        </div>

        <!-- 查询按钮 -->
        <div class="flex justify-end mt-4 space-x-4">
          <el-button
            type="primary"
            @click="handleSearch"
            :loading="loading"
            :disabled="!params.device || !params.start_time || !params.end_time || !params.direction"
          >
            查询
          </el-button>
          <el-button
            type="primary"
            @click="downloadData"
            :loading="loading"
            :disabled="!params.device || !params.start_time || !params.end_time || !params.direction"
          >
            导出数据
          </el-button>
        </div>
      </div>

      <!-- 数据显示区域 -->
      <div class="bg-white rounded p-4">
        <!-- 添加 flex 容器使表格居中 -->
        <div class="flex justify-center w-full">
          <div v-if="loading" class="h-[500px] flex items-center justify-center">
            <el-icon class="is-loading"><Loading /></el-icon>
          </div>
          <div v-else-if="chartData && chartData.length > 0" class="table-container w-[90%]">
            <el-table
              :data="chartData"
              border
              style="width: 100%"
              height="500"
              :max-height="500"
            >
              <el-table-column prop="device_id" label="设备ID" min-width="120" fixed />
              <el-table-column prop="device_name" label="设备名称" min-width="120" fixed />
              <el-table-column prop="time" label="时间" min-width="180" />
              <el-table-column prop="data" label="数据值" min-width="120" />
              <el-table-column prop="direction" label="方向" min-width="150">
                <template #default="scope">
                  {{ getDirectionLabel(scope.row.direction) }}
                </template>
              </el-table-column>
              <el-table-column prop="min" label="最小阈值" min-width="120" />
              <el-table-column prop="max" label="最大阈值" min-width="120" />
            </el-table>
          </div>
          <el-empty v-else description="暂无数据" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { sub } from 'date-fns'
import { useFetch } from '@vueuse/core'
import { Loading, InfoFilled } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'

const router = useRouter()

// API服务器配置 - 修改为只使用远程服务器
const apiServerUrl = 'http://8.153.161.229:8009' // 远程服务器地址

// 获取API服务器的基础URL
const getApiBaseUrl = () => {
  return apiServerUrl;
};

// 基础数据初始化
const loading = ref(false)
const deviceOnlineStatus = ref<Record<string, boolean>>({}) // 设备在线状态记录
const deviceList = ref([
  // 安楼设备 - 使用最新设备ID
  { device_id: '14B0F67E', device_name: '安楼外幕墙1C' }, // 更新自29FA1867
  { device_id: '55DA00B5', device_name: '安楼外幕墙2D' }, // 更新自A77C5238
  { device_id: '87C3D4E4', device_name: '安楼外幕墙1A' }, // 更新自350E6EFF
  { device_id: '9A0D1958', device_name: '安楼外幕墙2E' }, // 更新自332F78D
  { device_id: '1A193E69', device_name: '安楼外幕墙1B' }, // 更新自E43AC643
  { device_id: 'F853ED49', device_name: '安楼外幕墙2F' }, // 保持不变

  // 综合楼(衷和楼)设备 - 使用最新设备ID
  { device_id: '4787BE3A', device_name: '衷和楼测点7' }, // 保持不变
  { device_id: '612B04ED', device_name: '衷和楼#1H' },   // 更新自7749E4D9
  { device_id: '8361D7CD', device_name: '衷和楼#2I' },   // 更新自7A6BA8C9
  { device_id: '8850A7D7', device_name: '衷和楼#2J' },   // 保持不变
  { device_id: 'E884C99D', device_name: '衷和楼#1G' },   // 保持不变

  // 应力计设备
  { device_id: '0002', device_name: '安楼外幕墙2Y' },
  { device_id: '0020', device_name: '衷和楼#2Y' }
])
const chartData = ref<any[]>([])

// 方向选项
const directions = [
  { value: 'x_above_max', label: 'X轴超过最大值' },
  { value: 'x_below_min', label: 'X轴低于最小值' },
  { value: 'y_above_max', label: 'Y轴超过最大值' },
  { value: 'y_below_min', label: 'Y轴低于最小值' },
  { value: 'z_above_max', label: 'Z轴超过最大值' },
  { value: 'z_below_min', label: 'Z轴低于最小值' },
  { value: 'ch1_above_max', label: 'CH1超过最大值' },
  { value: 'ch1_below_min', label: 'CH1低于最小值' },
  { value: 'ch2_above_max', label: 'CH2超过最大值' },
  { value: 'ch2_below_min', label: 'CH2低于最小值' }
]

// 定义级联选择器的属性
const cascaderProps = {
  expandTrigger: 'hover' as const,
  value: 'value',
  label: 'label',
  children: 'children',
  multiple: false,
  checkStrictly: false
}

// 定义级联选择器的选项
const cascaderDevices = computed(() => {
  // 辨识应力计设备ID
  const strainDeviceIds = ['0002', '0020'];

  // 按建筑物类型分组设备
  const anlouDevices = deviceList.value
    .filter(d => d.device_name.includes('安楼') && !strainDeviceIds.includes(d.device_id))
    .map(d => ({
      label: d.device_name,
      value: d.device_id,
      online: deviceOnlineStatus.value[d.device_id] !== undefined ? deviceOnlineStatus.value[d.device_id] : true // 使用状态或默认为在线
    }));

  const zhongheDevices = deviceList.value
    .filter(d => (d.device_name.includes('衷和楼') || d.device_name.includes('综合楼')) && !strainDeviceIds.includes(d.device_id))
    .map(d => ({
      label: d.device_name,
      value: d.device_id,
      online: deviceOnlineStatus.value[d.device_id] !== undefined ? deviceOnlineStatus.value[d.device_id] : true // 使用状态或默认为在线
    }));

  const strainDevices = deviceList.value
    .filter(d => strainDeviceIds.includes(d.device_id))
    .map(d => ({
      label: d.device_name,
      value: d.device_id,
      online: deviceOnlineStatus.value[d.device_id] !== undefined ? deviceOnlineStatus.value[d.device_id] : true // 使用状态或默认为在线
    }));

  return [
    {
      label: '安楼设备',
      value: '安楼设备',
      children: anlouDevices
    },
    {
      label: '衷和楼设备',
      value: '衷和楼设备',
      children: zhongheDevices
    },
    {
      label: '应力计设备',
      value: '应力计设备',
      children: strainDevices
    }
  ].filter(group => group.children && group.children.length > 0);
});

// 方向选项 - 级联选择器格式
const directionProps = {
  expandTrigger: 'hover' as const,
  value: 'value',
  label: 'label',
  children: 'children',
  multiple: false,
  checkStrictly: false
}

const directionOptions = [
  {
    label: 'X轴',
    value: 'x',
    type: 'vibration', // 振动传感器类型
    children: [
      { label: '超过最大值', value: 'x_above_max' },
      { label: '低于最小值', value: 'x_below_min' }
    ]
  },
  {
    label: 'Y轴',
    value: 'y',
    type: 'vibration', // 振动传感器类型
    children: [
      { label: '超过最大值', value: 'y_above_max' },
      { label: '低于最小值', value: 'y_below_min' }
    ]
  },
  {
    label: 'Z轴',
    value: 'z',
    type: 'vibration', // 振动传感器类型
    children: [
      { label: '超过最大值', value: 'z_above_max' },
      { label: '低于最小值', value: 'z_below_min' }
    ]
  },
  {
    label: 'CH1',
    value: 'ch1',
    type: 'strain', // 应力计类型
    children: [
      { label: '超过最大值', value: 'ch1_above_max' },
      { label: '低于最小值', value: 'ch1_below_min' }
    ]
  },
  {
    label: 'CH2',
    value: 'ch2',
    type: 'strain', // 应力计类型
    children: [
      { label: '超过最大值', value: 'ch2_above_max' },
      { label: '低于最小值', value: 'ch2_below_min' }
    ]
  }
]

// 请求数初始化
const params = reactive({
  device: [] as string[], // 修改为字符串数组类型，适配级联选择器
  direction: [] as string[], // 修改为字符串数组类型，适配级联选择器
  start_time: '',
  end_time: ''
})

// 根据当前选择的设备类型过滤方向选项
const filteredDirectionOptions = computed(() => {
  // 获取当前选择的设备ID
  const deviceId = getDeviceId(params.device);

  // 如果未选择设备，返回所有方向
  if (!deviceId) return directionOptions;

  // 判断设备类型
  const isStrainDevice = deviceId === '0002' || deviceId === '0020';

  // 根据设备类型返回不同的方向选项
  if (isStrainDevice) {
    // 应力计设备只显示CH1和CH2
    return directionOptions.filter(option => option.type === 'strain');
  } else {
    // 其他设备(振动传感器)只显示XYZ轴
    return directionOptions.filter(option => option.type === 'vibration');
  }
});

// 监听设备选择变化，重置方向选择
watch(() => params.device, (newDevice) => {
  // 获取当前选择的设备ID
  const deviceId = getDeviceId(newDevice);

  // 如果未选择设备，不做任何操作
  if (!deviceId) return;

  // 判断设备类型
  const isStrainDevice = deviceId === '0002' || deviceId === '0020';

  // 获取当前选择的方向值
  const directionValue = getDirectionValue(params.direction);

  // 检查当前方向是否适用于当前设备类型
  if (directionValue) {
    const isStrainDirection = directionValue.startsWith('ch');

    // 如果设备类型和方向类型不匹配，重置方向选择
    if ((isStrainDevice && !isStrainDirection) || (!isStrainDevice && isStrainDirection)) {
      // 重置为对应设备类型的默认方向
      if (isStrainDevice) {
        params.direction = ['ch1', 'ch1_above_max'];
      } else {
        params.direction = ['y', 'y_above_max'];
      }
    }
  }
});

// 更新方向标签转换函数
const getDirectionLabel = (direction: string): string => {
  const directionMap: Record<string, string> = {
    'x_above_max': 'X轴超过最大值',
    'x_below_min': 'X轴低于最小值',
    'y_above_max': 'Y轴超过最大值',
    'y_below_min': 'Y轴低于最小值',
    'z_above_max': 'Z轴超过最大值',
    'z_below_min': 'Z轴低于最小值',
    'ch1_above_max': 'CH1超过最大值',
    'ch1_below_min': 'CH1低于最小值',
    'ch2_above_max': 'CH2超过最大值',
    'ch2_below_min': 'CH2低于最小值'
  }
  return directionMap[direction] || direction
}

// 获取设备ID的辅助函数
const getDeviceId = (deviceValue: any): string => {
  if (!deviceValue) return '';

  // 如果是数组，取第二个元素（实际的设备ID）
  if (Array.isArray(deviceValue) && deviceValue.length > 1) {
    return deviceValue[1];
  }

  // 如果不是数组或是单元素数组，直接返回
  return Array.isArray(deviceValue) ? deviceValue[0] : deviceValue;
}

// 获取方向值的辅助函数
const getDirectionValue = (directionValue: any): string => {
  if (!directionValue) return '';

  // 如果是数组，取最后一个元素
  if (Array.isArray(directionValue)) {
    return directionValue[directionValue.length - 1];
  }

  // 如果不是数组，直接返回
  return directionValue;
}

// 获取图表数据
const fetchData = async () => {
  loading.value = true;
  chartData.value = []; // 清空之前的数据

  try {
    // 从级联选择器获取设备ID和方向
    const deviceId = getDeviceId(params.device);
    const directionValue = getDirectionValue(params.direction);

    if (!deviceId) {
      throw new Error('无效的设备ID');
    }

    if (!directionValue) {
      throw new Error('无效的方向值');
    }

    console.log('使用设备ID:', deviceId);
    console.log('使用方向:', directionValue);

    // 使用设备名称而不是设备ID
    const deviceName = deviceList.value.find(device => device.device_id === deviceId)?.device_name;

    if (!deviceName) {
      throw new Error('未找到设备名称');
    }

    const queryParams = {
      device: deviceName, // 使用设备名称
      direction: directionValue,
      start_time: params.start_time,
      end_time: params.end_time
    };

    // 使用远程服务器地址
    const baseUrl = getApiBaseUrl();
    console.log('使用API服务器:', baseUrl);

    // 使用正确的URL路径 - 优先使用/data前缀
    const apiUrl = `${baseUrl}/data/get_abnormal_data`;
    console.log('请求URL:', apiUrl);
    console.log('请求参数:', queryParams);

    const url = `${apiUrl}?${new URLSearchParams(queryParams).toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('响应结果:', result);

    if (result.status === 'success' && Array.isArray(result.data)) {
      if (result.data.length > 0) {
        // 确保每条记录都有device_id和device_name字段
        chartData.value = result.data.map(item => {
          const record = { ...item };

          // 如果后端返回的数据没有device_id，但有device_name
          if (!record.device_id && record.device_name) {
            // 尝试根据device_name找到对应的device_id
            const deviceInfo = deviceList.value.find(d => d.device_name === record.device_name);
            if (deviceInfo) {
              record.device_id = deviceInfo.device_id;
            } else {
              // 如果找不到对应的device_id，使用device_name作为fallback
              record.device_id = record.device_name;
            }
          }

          return record;
        });
        console.log('获取到数据:', chartData.value);
      } else {
        ElMessage.info('查询结果为空，未找到符合条件的数据');
      }
    } else {
      if (result.status === 'error') {
        ElMessage.error(result.message || '获取数据失败');
      } else {
        ElMessage.warning('未获取到数据');
      }
    }
  } catch (err) {
    console.error('请求失败:', err);
    ElMessage.error(err instanceof Error ? err.message : '获取数据失败');
  } finally {
    loading.value = false;
  }
}

// 查询按钮点击处理
const handleSearch = async () => {
  if (!params.device || !params.direction || !params.start_time || !params.end_time) {
    let message = '请选择完整的查询条件';
    if (!params.device) message = '请选择设备';
    else if (!params.direction) message = '请选择异常方向';
    else if (!params.start_time) message = '请选择开始时间';
    else if (!params.end_time) message = '请选择结束时间';

    ElMessage.warning(message);
    return;
  }

  if (new Date(params.start_time) > new Date(params.end_time)) {
    ElMessage.warning('开始时间不能晚于结束时间');
    return;
  }

  console.log('开始查询，参数:', params);
  console.log('使用API服务器:', getApiBaseUrl());
  await fetchData();
}

// 不再在参数改变时立即触发查询
const handleDeviceChange = (val: any) => {
  // 级联选择器返回的是数组，需要取最后一个值（设备ID）
  if (Array.isArray(val)) {
    console.log('选择的设备路径:', val);
    // 设备ID是级联选择器返回数组的最后一个元素
    params.device = val;
  } else {
    params.device = val;
  }
}

const handleDirectionChange = (val: any) => {
  // 级联选择器返回的是数组，需要取最后一个值（具体方向）
  if (Array.isArray(val)) {
    console.log('选择的方向路径:', val);
    params.direction = val;
  } else {
    params.direction = val;
  }
}

// 下载数据
const downloadData = async () => {
  if (!params.device || !params.direction || !params.start_time || !params.end_time) {
    let message = '请选择完整的查询条件';
    if (!params.device) message = '请选择设备';
    else if (!params.direction) message = '请选择异常方向';
    else if (!params.start_time) message = '请选择开始时间';
    else if (!params.end_time) message = '请选择结束时间';

    ElMessage.warning(message);
    return;
  }

  if (new Date(params.start_time) > new Date(params.end_time)) {
    ElMessage.warning('开始时间不能晚于结束时间');
    return;
  }

  loading.value = true;
  try {
    // 从级联选择器获取设备ID和方向
    const deviceId = getDeviceId(params.device);
    const directionValue = getDirectionValue(params.direction);

    if (!deviceId) {
      throw new Error('无效的设备ID');
    }

    if (!directionValue) {
      throw new Error('无效的方向值');
    }

    console.log('下载数据 - 使用设备ID:', deviceId);
    console.log('下载数据 - 使用方向:', directionValue);

    const queryParams = {
      device: deviceId,
      direction: directionValue,
      start_time: params.start_time,
      end_time: params.end_time
    };

    // 使用远程服务器地址
    const baseUrl = getApiBaseUrl();
    console.log('使用API服务器(下载):', baseUrl);

    // 使用正确的URL路径
    const downloadUrl = `${baseUrl}/data/download_abnormal_data?${new URLSearchParams(queryParams).toString()}`;
    console.log('下载URL:', downloadUrl);

    // 创建下载链接
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `异常数据_${deviceId}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    ElMessage.success('下载请求已发送，请检查您的下载内容');
  } catch (err) {
    console.error('下载失败:', err);
    ElMessage.error(err instanceof Error ? err.message : '下载失败');
  } finally {
    loading.value = false;
  }
}

// 处理窗口大小变化
const handleResize = () => {
  if (chart) {
    chart.resize()
  }
}

// 添加设备名称查找函数
const getDeviceName = (deviceId: string): string => {
  const device = deviceList.value.find(item => item.device_id === deviceId)
  return device ? device.device_name : deviceId
}

// 定义图表实例变量
let chart: echarts.ECharts | null = null;

// 更新设备在线状态
const updateDeviceOnlineStatus = () => {
  // 默认所有设备在线
  deviceList.value.forEach(device => {
    deviceOnlineStatus.value[device.device_id] = true
  })

  // 可以在这里添加实际的设备状态检查逻辑
  // 例如通过API获取设备在线状态
}

// 初始化
onMounted(() => {
  // 设置默认设备 - 级联选择器需要数组格式
  // 初始选择安楼外幕墙2D (原A77C5238，现在是55DA00B5)
  const defaultDeviceId = '55DA00B5';
  const defaultDevice = deviceList.value.find(d => d.device_id === defaultDeviceId);

  if (defaultDevice) {
    // 根据设备名称确定所属分组
    if (defaultDevice.device_name.includes('安楼')) {
      params.device = ['安楼设备', defaultDeviceId];
    } else if (defaultDevice.device_name.includes('衷和楼') || defaultDevice.device_name.includes('综合楼')) {
      params.device = ['衷和楼设备', defaultDeviceId];
    } else {
      params.device = ['应力计设备', defaultDeviceId];
    }
  } else {
    // 如果找不到默认设备，寻找任何安楼设备
    const anlouDevice = deviceList.value.find(d => d.device_name.includes('安楼'));
    if (anlouDevice) {
      params.device = ['安楼设备', anlouDevice.device_id];
    } else {
      params.device = ['安楼设备', deviceList.value[0].device_id];
    }
  }

  // 设置默认方向 - 使用y_above_max作为默认方向
  params.direction = ['y', 'y_above_max'];

  // 设置默认时间范围 - 过去7天到现在
  const end = new Date();
  const start = sub(end, { days: 7 });

  params.start_time = start.toISOString().slice(0, 19).replace('T', ' ');
  params.end_time = end.toISOString().slice(0, 19).replace('T', ' ');

  console.log('初始化完成:', params);

  // 添加窗口大小变化监听
  window.addEventListener('resize', handleResize);

  // 初始化设备在线状态
  updateDeviceOnlineStatus()
})

onUnmounted(() => {
  if (chart) {
    chart.dispose()
    chart = null
  }
  window.removeEventListener('resize', handleResize)
})

// 开始日期的快捷选项
const startDateShortcuts = [
  {
    text: '一个月前',
    value: () => {
      const date = new Date();
      date.setMonth(date.getMonth() - 1);
      return date;
    }
  },
  {
    text: '一周前',
    value: () => {
      const date = new Date();
      date.setTime(date.getTime() - 3600 * 1000 * 24 * 7);
      return date;
    }
  },
  {
    text: '昨天',
    value: () => {
      const date = new Date();
      date.setTime(date.getTime() - 3600 * 1000 * 24);
      return date;
    }
  },
  {
    text: '2023年1月1日',
    value: () => {
      return new Date('2023-01-01T00:00:00');
    }
  }
];

// 结束日期的快捷选项
const endDateShortcuts = [
  {
    text: '现在',
    value: () => {
      const date = new Date();
      date.setHours(date.getHours() - 1); // 当前时间减1小时
      return date;
    }
  },
  {
    text: '昨天',
    value: () => {
      const date = new Date();
      date.setTime(date.getTime() - 3600 * 1000 * 24);
      return date;
    }
  },
  {
    text: '一周前',
    value: () => {
      const date = new Date();
      date.setTime(date.getTime() - 3600 * 1000 * 24 * 7);
      return date;
    }
  }
];

// 限制开始时间选择范围（不早于2023-01-01）
const disabledStartDate = (time: Date) => {
  // 设置最早可选时间为2023年1月1日
  const earliestDate = new Date('2023-01-01T00:00:00');

  // 最晚不能超过当前时间减去1小时
  const latestDate = new Date();
  latestDate.setHours(latestDate.getHours() - 1);

  // 验证时间是否在允许范围内
  return time.getTime() < earliestDate.getTime() || time.getTime() > latestDate.getTime();
};

// 限制结束时间选择范围（不早于开始时间，不晚于当前时间减1小时）
const disabledEndDate = (time: Date) => {
  // 最早的结束时间应该是开始时间
  let earliestDate = new Date('2023-01-01T00:00:00');
  if (params.start_time) {
    earliestDate = new Date(params.start_time);
  }

  // 最晚不能超过当前时间减去1小时
  const latestDate = new Date();
  latestDate.setHours(latestDate.getHours() - 1);

  // 验证时间是否在允许范围内
  return time.getTime() < earliestDate.getTime() || time.getTime() > latestDate.getTime();
};
</script>

<style scoped>
.el-date-editor.el-input,
.el-date-editor.el-input__wrapper {
  width: 100%;
}

/* 表格容器样式 */
.table-container {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  margin: 0 auto;
  width: 90%;
}

/* 确保表格本身占满容器 */
:deep(.el-table) {
  width: 100% !important;
}

/* 表格样式优化 */
.el-table {
  margin-top: 1rem;
}

.el-table th {
  background-color: #f5f7fa;
  color: #606266;
  font-weight: 500;
  text-align: center;
}

.el-table td {
  padding: 8px 0;
  text-align: center;
}

/* 设置滚动条样式 */
:deep(.el-table__body-wrapper::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb) {
  background: #dcdfe6;
  border-radius: 4px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-track) {
  background: #f5f7fa;
}

/* 确保表格内容居中 */
:deep(.el-table .cell) {
  text-align: center;
}
</style>
