<template>
  <div id="app" class="app-container">
    <div style="position: fixed; right: 10px; top: 15px; z-index: 1000;">
      <el-button type="primary" @click="backToMain">返回主页</el-button>
    </div>

    <!-- 主体内容 -->
    <div class="outlayer">
      <!-- 参数面板 -->
      <div class="parameter-panel">
        <UForm class="parameter-form" :state="{}">

          <div class="parameter-group">
            <h2 class="green-underline-title">台阵选择</h2>
            <hr class="divider" />

            <!-- 建筑物选择网格 -->
            <div class="building-grid">
              <div class="building-group">
                <h3>衷和楼</h3>
                <div class="device-grid">
                  <div
                    v-for="device in filteredDevices('衷和楼')"
                    :key="device.value"
                    class="device-item"
                    :class="{ 'active': selectedDevice.value === device.value,
                      'strain-gauge': device.type === 'strainGauge'
                    }"

                    @click="selectDevice(device)"
                  >
                    {{ device.label }}
                  </div>
                </div>
              </div>

              <div class="building-group">
                <h3>安楼</h3>
                <div class="device-grid">
                  <div
                    v-for="device in filteredDevices('安楼')"
                    :key="device.value"
                    class="device-item"
                    :class="{
                      'active': selectedDevice.value === device.value,
                      'strain-gauge': device.type === 'strainGauge'
                    }"
                    @click="selectDevice(device)"
                  >
                    {{ device.label }}
                  </div>
                </div>
              </div>
            </div>

            <div class="parameter-row" style="margin-top: 10px;">
              <div class="parameter-icon">
                <i class="fas fa-info-circle"></i>
              </div>
              <h1>当前选择：</h1>
              <span class="selected-device-info">{{ selectedDevice.label }}</span>
              <span class="device-type-badge" :class="selectedDevice.type === 'accelerometer' ? 'acc-badge' : 'strain-badge'">
                {{ selectedDevice.type === 'accelerometer' ? '加速度计' : '应变计' }}
              </span>
            </div>
          </div>

          <div class="parameter-group">
            <h2 class="green-underline-title">偏移与阈值</h2>
            <hr class="divider" />

            <div v-if="selectedDevice.type === 'accelerometer'">
              <div class="parameter-row">
                <div class="parameter-icon">
                  <i class="fas fa-arrows-alt-h"></i>
                </div>
                <h1>X偏移：</h1>
                <UInput v-model="xOffset" @input="updateThresholds('x', xOffset)" />
                <span>阈值:</span>
                <UInput v-model="xThreshold" @input="updateThresholds('xThreshold', $event.target.value)" />
                <i class="fas fa-exclamation-circle" title="X轴阈值"></i>
              </div>

              <div class="parameter-row">
                <div class="parameter-icon">
                  <i class="fas fa-arrows-alt-v"></i>
                </div>
                <h1>Y偏移：</h1>
                <UInput v-model="yOffset" @input="updateThresholds('y', yOffset)" />
                <span>阈值:</span>
                <UInput v-model="yThreshold" @input="updateThresholds('yThreshold', $event.target.value)" />
                <i class="fas fa-exclamation-circle" title="Y轴阈值"></i>
              </div>

              <div class="parameter-row">
                <div class="parameter-icon">
                  <i class="fas fa-cube"></i>
                </div>
                <h1>Z偏移：</h1>
                <UInput v-model="zOffset" @input="updateThresholds('z', zOffset)" />
                <span>阈值:</span>
                <UInput v-model="zThreshold" @input="updateThresholds('zThreshold', $event.target.value)" />
                <i class="fas fa-exclamation-circle" title="Z轴阈值"></i>
              </div>
            </div>

            <div v-else-if="selectedDevice.type === 'strainGauge'">
              <div class="parameter-row">
                <div class="parameter-icon">
                  <i class="fas fa-cube"></i>
                </div>
                <h1>Ch1偏移：</h1>
                <UInput v-model="ch1Offset" @input="updateThresholds('ch1', ch1Offset)" />
                <span>阈值:</span>
                <UInput v-model="ch1Threshold" @input="updateThresholds('ch1Threshold', ch1Threshold)" />
                <i class="fas fa-exclamation-circle" title="Ch1轴阈值"></i>
              </div>

              <div class="parameter-row">
                <div class="parameter-icon">
                  <i class="fas fa-cube"></i>
                </div>
                <h1>Ch2偏移：</h1>
                <UInput v-model="ch2Offset" @input="updateThresholds('ch2', ch2Offset)" />
                <span>阈值:</span>
                <UInput v-model="ch2Threshold" @input="updateThresholds('ch2Threshold', ch2Threshold)" />
                <i class="fas fa-exclamation-circle" title="Ch2轴阈值"></i>
              </div>
            </div>

            <!-- 数据校准应用按钮 -->
            <div class="parameter-row">
              <UButton type="primary" @click="applyCalibration" :loading="loadingCalibration">应用</UButton>
            </div>
          </div>

          <!-- 限值设置 -->
          <div class="parameter-group">
            <h2 class="green-underline-title">限值设置</h2>
            <hr class="divider" />
            <div class="parameter-row">
              <div class="parameter-icon">
                <i class="fas fa-envelope"></i>
              </div>
              <h1>邮箱红线设置：</h1>
              <UInput v-model="emailLimitSetting" />
            </div>

            <div class="parameter-row">
              <div class="parameter-icon">
                <i class="fas fa-sms"></i>
              </div>
              <h1>短信红线设置：</h1>
              <UInput v-model="messageLimitSetting" />
            </div>

            <!-- 限值设置应用按钮 -->
            <div class="parameter-row">
              <UButton type="primary" @click="applyLimits" :loading="loadingLimits">应用</UButton>
            </div>
          </div>

          <div class="parameter-group">
            <h2 class="green-underline-title">三级预警规则</h2>
            <hr class="divider" />
            <div class="alert-rule-note">
              当前前端按“实际值相对模型标准值的绝对差”展示三级预警。一级预警为生效阈值的
              100%，二级预警为 75%，三级预警为 50%；邮件发送频率由后端统一控制。
            </div>
            <div class="alert-rule-grid">
              <div class="alert-rule-card danger">
                <strong>一级预警</strong>
                <span>生效阈值的 100%</span>
              </div>
              <div class="alert-rule-card warning">
                <strong>二级预警</strong>
                <span>生效阈值的 75%</span>
              </div>
              <div class="alert-rule-card info">
                <strong>三级预警</strong>
                <span>生效阈值的 50%</span>
              </div>
            </div>
          </div>
        </UForm>
      </div>
    </div>

    <!-- 消息提示通过 ElMessage 函数显示，不需要模板 -->
  </div>
</template>


<script>
import {useRouter} from "vue-router";
import { ElMessage } from 'element-plus';
import axios from 'axios';

const API_BASE_URL = 'http://8.153.161.229:8009';
const backToMain = () => {
  router.push("/");
};
export default {
  name: 'DeviceControlApp',
  setup() {
    const router = useRouter();
    const backToMain = () => {
      router.push("/");
    };

    return {
      backToMain
    };
  },
  data() {
    return {
      deviceOptions: [
        { value: '安楼外幕墙1A', label: '安楼外幕墙1A', building: '安楼', type: 'accelerometer' },
        { value: '安楼外幕墙1B', label: '安楼外幕墙1B', building: '安楼', type: 'accelerometer' },
        { value: '安楼外幕墙1C', label: '安楼外幕墙1C', building: '安楼', type: 'accelerometer' },
        { value: '安楼外幕墙2D', label: '安楼外幕墙2D', building: '安楼', type: 'accelerometer' },
        { value: '安楼外幕墙2E', label: '安楼外幕墙2E', building: '安楼', type: 'accelerometer' },
        { value: '安楼外幕墙2F', label: '安楼外幕墙2F', building: '安楼', type: 'accelerometer' },
        { value: '安楼外幕墙2Y', label: '安楼外幕墙2Y', building: '安楼', type: 'strainGauge' },
        { value: '衷和楼#1G', label: '衷和楼1G', building: '衷和楼', type: 'accelerometer' },
        { value: '衷和楼#1H', label: '衷和楼1H', building: '衷和楼', type: 'accelerometer' },
        { value: '衷和楼#2I', label: '衷和楼2I', building: '衷和楼', type: 'accelerometer' },
        { value: '衷和楼#2J', label: '衷和楼2J', building: '衷和楼', type: 'accelerometer' },
        { value: '衷和楼测点7', label: '衷和楼测点7', building: '衷和楼', type: 'accelerometer' },
        { value: '衷和楼#2Y', label: '衷和楼2Y', building: '衷和楼', type: 'strainGauge' }
      ],

      selectedDevice: { value: '安楼外幕墙1A', label: '安楼外幕墙1A', type: 'accelerometer'},
      upperBound: 10,
      lowerBound: 10,
      emailLimitSetting:25,
      messageLimitSetting:35,

      xOffset: 0,  // X偏移
      yOffset: 0,  // Y偏移
      zOffset: 0,   // Z偏移

      // 加载状态
      loadingCalibration: false,
      loadingLimits: false,

      // 消息提示
      message: {
        show: false,
        type: 'success', // success, warning, info, error
        content: '',
        duration: 3000,
        onClose: null
      },
      xThreshold: 0,
      yThreshold: 0,
      zThreshold: 0,
      ch1Threshold: 0,
      ch2Threshold: 0,
      ch1Offset: 0,
      ch2Offset: 0,
      ratio_y_x: 1,
      ratio_z_y: 1,
      ratio_ch2_ch1: 1,
    };
  },
  computed: {

  },
  methods: {
    // 显示消息提示
    showMessage(type, content, duration = 3000) {
      ElMessage({
        type: type,
        message: content,
        duration: duration
      });
    },

    // 筛选指定建筑物的设备
    filteredDevices(buildingName) {
      return this.deviceOptions.filter(device => device.building === buildingName);
    },

    // 选择设备
    selectDevice(device) {
      this.selectedDevice = device;
      this.showMessage('info', `已选择: ${device.label}`, 2000);

      // 查询阈值
      this.fetchThresholds();

      // 获取比例数据
      this.getRatioData().then(ratios => {
        if (ratios) {
          this.ratio_y_x = ratios.ratio_y_x;
          this.ratio_z_y = ratios.ratio_z_y;
          this.ratio_ch2_ch1 = ratios.ratio_ch2_ch1;
        }
      });
    },

      // 台阵设置应用
    async updateSingle(item) {
      try {
        // 使用 encodeURIComponent 确保特殊字符被正确编码
        const encodedDeviceName = encodeURIComponent(item.device_name);
        const encodedType = encodeURIComponent(item.type);
        const encodedValue = encodeURIComponent(item.value);

        const url = `${API_BASE_URL}/data/update_threshold_or_offset?device_name=${encodedDeviceName}&type=${encodedType}&value=${encodedValue}`;

        console.log('请求URL:', url);

        // 添加请求超时和错误处理
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10秒超时
        })

        // 检查响应状态
        if (!response.ok) {
          console.warn(`请求失败: ${response.status} ${response.statusText}`);
          return { success: false, error: `状态码 ${response.status}` };
        }

        // 安全地解析JSON响应
        try {
          const text = await response.text();
          // 处理空响应
          if (!text || text.trim() === '') {
            return { success: true, data: {} };
          }

          // 尝试解析JSON
          const data = JSON.parse(text);
          return { success: true, data };
        } catch (parseError) {
          console.error('JSON解析错误:', parseError);
          // 如果无法解析，但请求是成功的，我们仍然认为更新成功
          return { success: true, data: {}, parseWarning: true };
        }
      } catch (error) {
        console.error('更新失败:', error);
        return { success: false, error: error.message || '网络错误' };
      }
    },

    async applyCalibration() {
      this.loadingCalibration = true;
      try {
        const updates = [];

        if (this.selectedDevice.type === 'accelerometer') {
          updates.push(
            { device_name: this.selectedDevice.value, type: 'x_offset', value: this.xOffset },
            { device_name: this.selectedDevice.value, type: 'y_offset', value: this.yOffset },
            { device_name: this.selectedDevice.value, type: 'z_offset', value: this.zOffset },
            { device_name: this.selectedDevice.value, type: 'x_limit', value: this.xThreshold },
            { device_name: this.selectedDevice.value, type: 'y_limit', value: this.yThreshold },
            { device_name: this.selectedDevice.value, type: 'z_limit', value: this.zThreshold }
          );
        } else if (this.selectedDevice.type === 'strainGauge') {
          updates.push(
            { device_name: this.selectedDevice.value, type: 'ch1_offset', value: this.ch1Offset },
            { device_name: this.selectedDevice.value, type: 'ch2_offset', value: this.ch2Offset },
            { device_name: this.selectedDevice.value, type: 'ch1_limit', value: this.ch1Threshold },
            { device_name: this.selectedDevice.value, type: 'ch2_limit', value: this.ch2Threshold }
          );
        }

        const results = await Promise.all(
          updates.map(item => this.updateSingle(item))
        );

        // 检查是否所有请求都成功
        const allSuccessful = results.every(result => result && result.success);
        const hasParseWarnings = results.some(result => result && result.parseWarning);

        if (allSuccessful) {
          if (hasParseWarnings) {
            this.showMessage('success', `${this.selectedDevice.label} 数据校准参数已更新，但服务器响应格式异常。`);
          } else {
            this.showMessage('success', `${this.selectedDevice.label} 数据校准参数已成功更新！`);
          }
        } else {
          this.showMessage('warning', `部分数据校准参数更新可能未成功，请检查网络连接。`);
        }

        console.log('批量更新结果:', results);
      } catch (error) {
        this.showMessage('error', `更新失败: ${error.message || '网络错误'}`);
        console.error('更新出错:', error);
      } finally {
        this.loadingCalibration = false;
      }
    },

    async applyLimits() {
      this.loadingLimits = true;
      try {
        const updates = [
          { device_name: this.selectedDevice.value, type: 'email_limit', value: this.emailLimitSetting },
          { device_name: this.selectedDevice.value, type: 'message_limit', value: this.messageLimitSetting },
        ]

        const results = await Promise.all(
          updates.map(item => this.updateSingle(item))
        )

        // 检查是否所有请求都成功
        const allSuccessful = results.every(result => result && result.success);
        const hasParseWarnings = results.some(result => result && result.parseWarning);

        if (allSuccessful) {
          if (hasParseWarnings) {
            this.showMessage('success', `${this.selectedDevice.label} 限值参数已更新，但服务器响应格式异常。`);
          } else {
            this.showMessage('success', `${this.selectedDevice.label} 限值参数已成功更新！`);
          }
        } else {
          this.showMessage('warning', `部分限值参数更新可能未成功，请检查网络连接。`);
        }

        console.log('批量更新结果:', results);
      } catch (error) {
        this.showMessage('error', `更新失败: ${error.message || '网络错误'}`);
        console.error('更新出错:', error);
      } finally {
        this.loadingLimits = false;
      }
    },

    async fetchThresholds() {
      try {
        const response = await axios.get(`${API_BASE_URL}/data/get_threshold_or_offset`, {
          params: {
            device_name: this.selectedDevice.value,
            device_type: this.selectedDevice.type
          }
        });

        if (response.data.status === 'success') {
          const data = response.data.data;
          this.xOffset = data.x_offset || 0;
          this.yOffset = data.y_offset || 0;
          this.zOffset = data.z_offset || 0;

          // 根据设备类型设置阈值
          if (this.selectedDevice.type === 'accelerometer') {
            this.xThreshold = data.x_limit || 0;
            this.yThreshold = data.y_limit || 0;
            this.zThreshold = data.z_limit || 0;
          } else if (this.selectedDevice.type === 'strainGauge') {
            this.ch1Threshold = data.ch1_limit || 0;
            this.ch2Threshold = data.ch2_limit || 0;
          }
        } else {
          this.showMessage('error', '获取阈值失败');
        }
      } catch (error) {
        console.error('获取阈值失败:', error);
        this.showMessage('error', '获取阈值失败');
      }
    },

    async fetchLimits() {
      try {
        const response = await axios.get(`${API_BASE_URL}/data/get_threshold_or_offset`, {
          params: {
            device_name: this.selectedDevice.value,
            device_type: this.selectedDevice.type
          }
        });

        if (response.data.status === 'success') {
          const data = response.data.data;
          this.emailLimitSetting = data.email_limit || 25;
          this.messageLimitSetting = data.message_limit || 35;
        } else {
          this.showMessage('error', '获取限值设置失败');
        }
      } catch (error) {
        console.error('获取限值设置失败:', error);
        this.showMessage('error', '获取限值设置失败');
      }
    },

    updateThresholds(type, value) {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) {
        return;
      }
      console.log(numericValue);
      if (type === 'xThreshold') {
        this.yThreshold = Math.abs((numericValue * (this.ratio_y_x)).toFixed(2));
        this.zThreshold = Math.abs((this.yThreshold * (this.ratio_z_y)).toFixed(2));
      } else if (type === 'yThreshold') {
        this.xThreshold = Math.abs((numericValue /(this.ratio_y_x)).toFixed(2));
        this.zThreshold = Math.abs((this.yThreshold * (this.ratio_z_y)).toFixed(2));
      } else if (type === 'zThreshold') {
        this.yThreshold = Math.abs((numericValue / (this.ratio_z_y)).toFixed(2));
        this.xThreshold = Math.abs((this.yThreshold / (this.ratio_y_x)).toFixed(2));
      } else if (type === 'ch1Threshold') {
        this.ch2Threshold = Math.abs((numericValue * (this.ratio_ch2_ch1)).toFixed(2));
      } else if (type === 'ch2Threshold') {
        this.ch1Threshold = Math.abs((numericValue / (this.ratio_ch2_ch1)).toFixed(2));
      }
    },

    async getRatioData() {
      try {
        const response = await axios.get(`${API_BASE_URL}/data/get_ratio_data`, {
          params: {
            device_name: this.selectedDevice.value,
            device_type: this.selectedDevice.type
          }
        });

        if (response.data.status === 'success') {
          return response.data.data;
        } else {
          this.showMessage('error', '获取比例数据失败');
          return null;
        }
      } catch (error) {
        console.error('获取比例数据失败:', error);
        this.showMessage('error', '获取比例数据失败');
        return null;
      }
    },

  },
  mounted() {
    // 在组件挂载时获取比例数据
    this.getRatioData().then(ratios => {
      this.ratio_y_x = ratios.ratio_y_x;
      this.ratio_z_y = ratios.ratio_z_y;
      this.ratio_ch2_ch1 = ratios.ratio_ch2_ch1;
    });
    // 获取限值设置
    this.fetchLimits();
  },
};
</script>

<style scoped>
/* 页面布局 */
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css');
.app-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 100vh; /* 改为最小高度 */
  height: auto; /* 允许内容扩展 */
  background-color: #f4f5f7;
  overflow-x: hidden; /* 防止水平滚动 */
  padding-bottom: 80px; /* 添加底部内边距，防止最后的元素被遮挡 */
}

.green-underline-title {
  color: green;
  text-decoration: underline;
  margin-bottom: 10px;
}

.header {
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 10px 20px;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Navbar 容器样式 */
.navBar {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border-bottom: 2px solid #f0f0f0;
}

/* 标题样式 */
.app-title {
  font-size: 24px;
  font-weight: bold; /* 设置粗体 */
  margin-bottom: 20px; /* 设置与按钮的距离 */
}

/* 按钮容器样式 */
.nav-buttons {
  display: flex;
  gap: 20px; /* 按钮之间的间距 */
}

/* 按钮默认样式 */
.nav-buttons button {
  padding: 10px 20px;
  font-size: 16px;
  font-weight: 500;
  color: #333;
  background-color: transparent;
  border: none;
  border-bottom: 2px solid transparent; /* 默认没有底线 */
  cursor: pointer;
  transition: all 0.3s ease;
}

/* 按钮 hover 样式 */
.nav-buttons button:hover {
  color: #007bff;
}

/* 当前选中按钮的样式 */
.nav-buttons button.active {
  color:#28a745; /* 激活时的文本颜色 */
  border-bottom: 2px solid #28a745; /* 绿色下划线 */
  font-weight: bold;
}

@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css');
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh; /* 改为最小高度 */
  height: auto; /* 允许内容扩展 */
  background-color: #ffffff;
  overflow-x: hidden; /* 防止水平滚动 */
}

.parameter-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start; /* 改为顶部对齐 */
  background-color: #ffffff;
  padding: 1rem; /* 减小内边距 */
  overflow-y: auto; /* 添加垂直滚动 */
}

.parameter-form {
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: 0.8rem; /* 减小间距 */
  margin-bottom: 70px; /* 添加底部间距确保最后元素可见 */
}

.parameter-row {
  display: flex;
  align-items: center;
  gap: 0.8rem; /* 减小间距 */
  padding: 0.4rem 0.8rem; /* 减小内边距 */
  flex-wrap: wrap; /* 在小屏幕上允许换行 */
}

.parameter-row h1 {
  font-size: 1rem; /* 减小标题字体大小 */
  margin: 0; /* 移除边距 */
  white-space: nowrap; /* 防止文字换行 */
}

.parameter-group {
  display: flex;
  flex-direction: column;
  align-items: left;
  gap: 0.8rem; /* 减小间距 */
  background: #f9f9f9;
  padding: 0.5rem 0.8rem; /* 减小内边距 */
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 0.8rem; /* 添加底部间距 */
}

.parameter-icon {
  font-size: 1.2rem; /* 减小图标大小 */
  color: #4caf50;
  min-width: 1.2rem; /* 设置最小宽度 */
}

.parameter-label {
  flex: 1;
  font-weight: bold;
}

.parameter-input {
  flex: 2;
}

/* 建筑物网格样式 */
.building-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem; /* 减小间距 */
  width: 100%;
}

.building-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem; /* 减小间距 */
}

.building-group h3 {
  color: #333;
  font-size: 1rem; /* 减小字体大小 */
  margin-bottom: 3px;
  padding-left: 5px;
  border-left: 3px solid #4caf50;
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); /* 减小卡片尺寸 */
  gap: 8px; /* 减小间距 */
}

.device-item {
  background-color: #e9ecef;
  padding: 6px 8px; /* 减小内边距 */
  border-radius: 4px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem; /* 减小字体大小 */
}

.device-item:hover {
  background-color: #d1e7dd;
  transform: translateY(-2px);
}

.device-item.active {
  background-color: #4caf50;
  color: white;
  font-weight: bold;
}

.selected-device-info {
  font-weight: bold;
  color: #4caf50;
}

/* 面板展开/收起动画效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease; /* 动画效果 */
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0; /* 起始/结束透明度 */
  transform: translateY(10px); /* 起始/结束位置偏移 */
}

.outlayer {
  width: 100%; /* 占满屏幕 */
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto; /* 允许垂直滚动 */
  height: calc(100vh - 60px); /* 减去头部高度 */
  padding-bottom: 80px; /* 添加底部内边距 */
}

.device-section,
.charts-section {
  margin: 20px;
}

.section-title {
  font-size: 20px;
  margin-bottom: 10px;
}

.device-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.device-box {
  width: 80px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.charts-section {
  margin: 20px 0;
}

.section-title {
  font-size: 20px;
  margin-bottom: 20px;
  text-align: center;
}

.charts-container {
  display: flex;
  flex-direction: column; /* 纵向排列 */
  gap: 20px; /* 图表之间的间距 */
}

.chart-card {
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  width: 100%; /* 占满页面宽度 */
}

.chart-title {
  font-size: 16px;
  margin-bottom: 10px;
  font-weight: bold;
  text-align: center; /* 标题居中 */
}

.chart {
  width: 100%; /* 占满父容器宽度 */
  height: 300px; /* 固定高度 */
}

.scale-slider {
  margin-top: 10px;
  width: 100%; /* 滑块宽度与图一致 */
}

/* 修改智能助手的样式 */
.ai-assistant-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.assistant-toggle-btn {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #007bff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  transition: transform 0.3s ease;
}

.assistant-toggle-btn:hover {
  transform: scale(1.1);
}

.chat-window-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: white;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.chat-header {
  padding: 10px;
  background: #f8f9fa;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.chat-input {
  padding: 15px;
  background: #fff;
  border-top: 1px solid #eee;
  display: flex;
  gap: 10px;
}

.chat-input input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.chat-input button {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.chat-input button:hover {
  background: #0056b3;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
}

/* 添加消息样式 */
.message {
  margin: 10px;
  padding: 10px;
  border-radius: 8px;
  max-width: 80%;
}

.message.user {
  margin-left: auto;
  background-color: #e3f2fd;
  text-align: right;
}

.message.assistant {
  margin-right: auto;
  background-color: #f5f5f5;
  text-align: left;
}

.message-header {
  margin-bottom: 5px;
  font-size: 0.9em;
  color: #666;
}

.message-content {
  word-break: break-word;
}

.message-text {
  line-height: 1.5;
}
.divider {
  margin: 2px;
  border: none;
  border-top: 1px solid #e0e0e0;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .parameter-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .device-grid {
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  }

  .parameter-icon {
    margin-right: 5px;
  }

  .parameter-row h1 {
    margin-bottom: 5px;
  }

  .parameter-group {
    padding: 0.4rem;
  }
}

@media (max-width: 480px) {
  .device-grid {
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  }

  .device-item {
    padding: 4px 6px;
    font-size: 0.8rem;
  }

  .building-group h3 {
    font-size: 0.9rem;
  }
}

/* 调整输入框样式 */
:deep(input),
:deep(.el-input__inner),
:deep(.u-input) {
  width: 100%;
  max-width: 160px;
}

/* 针对按钮的样式调整 */
:deep(.el-button),
:deep(.u-button) {
  padding: 8px 15px;
  font-size: 0.9rem;
}

/* 确保滚动视图包含所有内容 */
html, body {
  height: 100%;
  overflow-y: auto;
  scroll-behavior: smooth;
}

/* 添加针对最后一个卡片的样式 */
.parameter-group:last-child {
  margin-bottom: 80px; /* 为最后一个卡片添加额外的底部间距 */
}

/* 针对限值设置组的特定样式 */
.parameter-group:last-of-type {
  padding-bottom: 20px;
}

/* 针对应用按钮的样式 */
.parameter-row:last-child .u-button,
.parameter-row:last-child button {
  margin-bottom: 15px;
}

.device-type-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  margin-left: 8px;
}

.acc-badge {
  background-color: #e3f2fd;
  color: #1976d2;
}

.strain-badge {
  background-color: #fff8e1;
  color: #ff8f00;
}

.device-item.strain-gauge {
  background-color: #fff8e1;
  border-left: 3px solid #ff8f00;
}

.device-item.strain-gauge.active {
  background-color: #ff8f00;
  color: white;
}

.alert-rule-note {
  padding: 10px 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #f8fafc;
  color: #334155;
  line-height: 1.6;
  font-size: 0.9rem;
}

.alert-rule-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  margin-top: 8px;
}

.alert-rule-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: 8px;
  border-left: 4px solid #94a3b8;
  background: #fff;
}

.alert-rule-card strong {
  color: #0f172a;
}

.alert-rule-card span {
  color: #64748b;
  font-size: 0.85rem;
}

.alert-rule-card.danger {
  border-left-color: #ef4444;
}

.alert-rule-card.warning {
  border-left-color: #f59e0b;
}

.alert-rule-card.info {
  border-left-color: #3b82f6;
}
</style>


