<template>
<div class="box">
    <div style="width:35%;height: 100%;">
        <div class="box-title">
            <p>分割结果</p>
        </div>
        <div class="box-content">
            <el-image 
             :src="safeImageSrc(picked.image_path)"
             :preview-src-list="[picked.image_path]" 
             style="width:80%;height: 60%;" 
             />
        </div>
    </div>
    <div style="width:65%;height: 100%;">
        <div class="box-title">
            <p>检测结果</p>
            <div style="display:flex;justify-content:center;align-items:center;gap:8px;">
              <span style="font-size:12px;color:#606266;">检测模式</span>
              <el-select v-model="detectionMode" size="small" style="width:160px">
                <el-option label="标准双模型" value="standard" />
                <el-option label="SOM 模式" value="som" />
              </el-select>
            </div>
            <div v-if="detectionMode === 'som'" style="position:relative;z-index:2;display:flex;justify-content:center;align-items:center;gap:10px;margin-top:8px;">
              <span style="font-size:12px;color:#606266;">像素阈值</span>
              <el-input-number
                v-model="somThresholds.min_crack_pixels"
                :min="1"
                :step="1"
                :step-strictly="false"
                :controls="true"
                controls-position="right"
                :readonly="false"
                size="small"
                style="width: 140px;"
              />
              <span style="font-size:12px;color:#606266;">面积占比阈值</span>
              <el-input-number
                v-model="somThresholds.min_crack_area_ratio"
                :min="0"
                :max="1"
                :step="0.0001"
                :precision="4"
                :step-strictly="false"
                :controls="true"
                controls-position="right"
                :readonly="false"
                size="small"
                style="width: 160px;"
              />
            </div>
            <el-progress :percentage="getDetectionProgress()" style="width:50%;margin-left: auto;margin-right: auto;margin-top: 10px;" />
            <el-button 
                type="primary" 
                style="position: absolute;right: 10%;top:55%" 
                @click="startCrackDetection" 
                :loading="globalLoading"
                :disabled="globalLoading || nums === 0"
            >
                {{ isAllDetectionComplete ? '重新检测' : '开始检测' }}
            </el-button>
        </div>
        <el-scrollbar style="width:100%;height: 82%;">
        <div class="box-content" style="height: 100%;">
            <el-timeline style="width: 90%;height: 100%;">
                <el-timeline-item 
                    v-for="(item, index) in picked.segimages" 
                    :key="index"
                    :timestamp="`区域${index + 1}`"
                    placement="top"
                >
                    <el-card style="height: 20vh;">
                        <!-- 在卡片顶部添加裂缝状态 -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 5px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: bold; font-size: 14px;">区域{{ index + 1 }}检测结果</span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <!-- 检测完成时显示结果标签 -->
                                <div class="status-container">
                                    <el-tag 
                                        v-if="crackResult && crackResult.length > index && crackResult[index] && crackResult[index].have_crack !== undefined"
                                        :type="crackResult[index].have_crack === '1' ? 'danger' : 'success'"
                                        size="small"
                                        style="font-size: 11px;"
                                    >
                                        {{ crackResult[index].have_crack === '1' ? '有裂缝' : '无裂缝' }}
                                    </el-tag>
                                    <!-- 废案入口（已停用）：
                                    <el-button 
                                        v-if="crackResult && crackResult.length > index && crackResult[index] && crackResult[index].have_crack=== '1'"
                                        type="primary" 
                                        size="small" 
                                        @click="openAIAnalysis(index)"
                                        style="font-size: 11px; padding: 2px 8px; margin-left: 8px;"
                                        :loading="analysisLoading"
                                    >
                                        智能助手分析
                                    </el-button>
                                    -->
                                    <el-button 
                                        v-if="detectionMode === 'standard' && crackResult && crackResult.length > index && crackResult[index] && crackResult[index].have_crack=== '1'"
                                        type="warning" 
                                        size="small" 
                                        @click="handleDualModelDetection(index)"
                                        style="font-size: 11px; padding: 2px 8px; margin-left: 8px;"
                                    >
                                        双模型协同检测
                                    </el-button>
                                    <!-- 检测中状态 - 只在两个模型都未检测完成时显示 -->
                                    <span v-else-if="!isDetectionComplete(index)" style="color: #909399; font-size: 12px;">
                                        检测中...
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div
                          v-if="detectionMode === 'som' && crackResult && crackResult[index] && crackResult[index].metrics"
                          style="display:flex;gap:14px;font-size:12px;color:#606266;margin-bottom:8px;"
                        >
                          <span>crack_pixels: {{ crackResult[index].metrics.crack_pixels }}</span>
                          <span>area_ratio: {{ formatRatio(crackResult[index].metrics.crack_area_ratio) }}</span>
                        </div>
                        
                        <div class="result-card">
                            <div>
                                <div style="height: 5%;text-align: center;font-weight: bold">原始图片</div>
                                <div class="image-container">
                                    <el-image
                                     :src="safeImageSrc(item.image_path)" 
                                     @error="markImageFailed(item.image_path)"
                                     :preview-src-list="[item.image_path]"
                                     fit="contain"
                                     style="width:80%;height: 80%;" 
                                     >
                                     </el-image>
                                </div>
                            </div>
                            <div>
                                <div style="height: 5%;text-align: center;font-weight: bold">{{ getSecondModelTitle() }}</div>
                                <div class="image-container">
                                    <el-image
                                     :src="safeImageSrc(getSecondModelImage(item))" 
                                     @error="markImageFailed(getSecondModelImage(item))"
                                     :preview-src-list="[getSecondModelImage(item)]"
                                     fit="contain"
                                     style="width:80%;height: 80%;" 
                                     >
                                     <template #error>
                                        <div class="image-slot">
                                            待检测
                                        </div>
                                      </template>
                                     </el-image>
                                </div>
                            </div>
                            <div>
                                <div style="height: 5%;text-align: center;font-weight: bold">{{ getThirdModelTitle() }}</div>
                                <div class="image-container">
                                    <el-image
                                     :src="safeImageSrc(getThirdModelImage(item))" 
                                     @error="markImageFailed(getThirdModelImage(item))"
                                     :preview-src-list="[getThirdModelImage(item)]"
                                     fit="contain"
                                     style="width:80%;height: 80%;" 
                                     >
                                     <template #error>
                                        <div class="image-slot">
                                            待检测
                                        </div>
                                      </template>
                                    </el-image>
                                </div>
                            </div>
                        </div>
                    </el-card>
                </el-timeline-item>
            </el-timeline>
        </div>
        </el-scrollbar>
    </div>
</div>


<!-- 废案弹窗（已停用）：
AI分析结果弹窗 + 双模型协同检测结果弹窗
-->
<el-dialog
    v-model="dualModelDialogVisible"
    title="双模型协同检测结果"
    width="80%"
    :before-close="handleCloseDualModelDialog"
>
    <div v-if="dualModelLoading" style="text-align: center; padding: 24px;">
        双模型协同检测中，请稍候...
    </div>
    <div v-else-if="dualModelResult">
        <div style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 15px; color: #303133;">检测结果对比</h4>
            <div style="margin-bottom: 24px; text-align: center;">
                <h5 style="margin-bottom: 10px;">原始图片</h5>
                <img
                    :src="safeImageSrc(picked.segimages[currentDualModelIndex]?.image_path)"
                    @error="markImageFailed(picked.segimages[currentDualModelIndex]?.image_path)"
                    style="max-width: 100%; max-height: 360px; border: 1px solid #ddd; border-radius: 4px;"
                    alt="原始图片"
                />
            </div>
            <div style="text-align: center;">
                <h5 style="margin-bottom: 10px;">检测结果</h5>
                <img
                    v-if="dualModelResult.data?.merged_results?.merged_highlighted_url"
                    :src="safeImageSrc(dualModelResult.data.merged_results.merged_highlighted_url)"
                    @error="markImageFailed(dualModelResult.data.merged_results.merged_highlighted_url)"
                    style="max-width: 100%; max-height: 360px; border: 1px solid #ddd; border-radius: 4px;"
                    alt="检测结果"
                />
                <div v-else style="padding: 36px; background: #f5f5f5; border-radius: 4px; color: #999;">
                    暂无检测结果图片
                </div>
            </div>
        </div>

        <el-descriptions :column="2" border>
            <el-descriptions-item label="是否检测到裂缝">
                <el-tag :type="(dualModelResult.data?.have_crack === true || dualModelResult.data?.have_crack === 'true') ? 'danger' : 'success'">
                    {{ (dualModelResult.data?.have_crack === true || dualModelResult.data?.have_crack === 'true') ? '是' : '否' }}
                </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="检测到的区域数量">
                {{ dualModelResult.data?.crop_regions?.length || 0 }}
            </el-descriptions-item>
        </el-descriptions>
    </div>
    <div v-else-if="dualModelError" style="text-align: center; padding: 24px; color: #f56c6c;">
        {{ dualModelError }}
    </div>
</el-dialog>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import axios from 'axios'
import { useCrackDetectionStore } from '../store/CrackDetection'
import { ElMessage, ElMessageBox } from 'element-plus'
// import { Loading } from '@element-plus/icons-vue' // 废案功能停用
const store = useCrackDetectionStore()

const picked = ref({
    image_path: "",
    segimages:[]
})

const nums = ref(0)
const progress = ref(0)
const globalLoading = ref(false)
const detectionMode = ref('standard')
const somThresholds = ref({
  min_crack_pixels: 250,
  min_crack_area_ratio: 0.0002
})
const isAllDetectionComplete = computed(() => {
  if (nums.value === 0) return false
  
  for (let i = 0; i < nums.value; i++) {
    if (!isDetectionComplete(i)) {
      return false
    }
  }
  
  return true
})
// 修复：将 null 改为空数组
const crackResult = ref([])
const crackResult2 = ref([])

const getSecondModelTitle = () => detectionMode.value === 'som' ? 'SOM掩码' : 'Segformer模型'
const getThirdModelTitle = () => detectionMode.value === 'som' ? 'SOM叠加图' : 'CrackDetection模型'

const buildOrderedCrackImages = (crackimages) => {
  if (!Array.isArray(crackimages)) return []
  return crackimages
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item.image_path === 'string') return item.image_path
      return ''
    })
    .filter((path) => typeof path === 'string' && path)
}

const getDetectionResultGroups = (crackimages) => {
  const ordered = buildOrderedCrackImages(crackimages)
  if (ordered.length === 0) {
    return {
      standard: { segformerUrl: '', crackDetectionUrl: '' },
      som: { maskUrl: '', overlayUrl: '' },
    }
  }
  const latestFirst = [...ordered].reverse()
  const isSomPath = (path) => path.includes('/som/') || path.includes('som-')
  const groups = {
    standard: { segformerUrl: '', crackDetectionUrl: '' },
    som: { maskUrl: '', overlayUrl: '' },
  }

  const somMask = latestFirst.find((p) => isSomPath(p) && (p.includes('som-segformer-') || p.includes('/som/mask/')))
  const somOverlay = latestFirst.find((p) => isSomPath(p) && (p.includes('overlay') || p.includes('som-mask-') || p.includes('/som/overlay/')))
  if (somMask) groups.som.maskUrl = somMask
  if (somOverlay) groups.som.overlayUrl = somOverlay

  const standardSegformer = latestFirst.find((p) => !isSomPath(p) && p.includes('segformer'))
  const standardMask = latestFirst.find((p) => !isSomPath(p) && (p.includes('mask') || p.includes('highlighted') || p.includes('result')))
  if (standardSegformer) groups.standard.segformerUrl = standardSegformer
  if (standardMask) groups.standard.crackDetectionUrl = standardMask

  return groups
}

const hydrateSegModeFields = (seg) => {
  const groups = getDetectionResultGroups(seg.crackimages)
  seg.standardSegformerUrl = groups.standard.segformerUrl
  seg.standardCrackDetectionUrl = groups.standard.crackDetectionUrl
  seg.somMaskUrl = groups.som.maskUrl
  seg.somOverlayUrl = groups.som.overlayUrl

  const fallbackHaveCrack = (seg.have_crack === '0' || seg.have_crack === '1') ? seg.have_crack : undefined
  if (seg.standardHaveCrack === undefined && (seg.standardSegformerUrl || seg.standardCrackDetectionUrl)) {
    seg.standardHaveCrack = fallbackHaveCrack
  }
  if (seg.somHaveCrack === undefined && (seg.somMaskUrl || seg.somOverlayUrl)) {
    seg.somHaveCrack = fallbackHaveCrack
  }
}

const getModeResultPair = (seg) => {
  if (detectionMode.value === 'som') {
    return { first: seg.somMaskUrl || '', second: seg.somOverlayUrl || '' }
  }
  return { first: seg.standardSegformerUrl || '', second: seg.standardCrackDetectionUrl || '' }
}

const getSecondModelImage = (item) => {
  if (!item) return ''
  return getModeResultPair(item).first
}
const getThirdModelImage = (item) => {
  if (!item) return ''
  return getModeResultPair(item).second
}
const formatRatio = (val) => {
  if (typeof val !== 'number') return '-'
  return val.toFixed(6)
}

const normalizeSomThresholds = () => {
  const pixels = Number(somThresholds.value.min_crack_pixels)
  const ratio = Number(somThresholds.value.min_crack_area_ratio)

  somThresholds.value.min_crack_pixels = Number.isFinite(pixels) && pixels >= 1
    ? Math.floor(pixels)
    : 2500
  somThresholds.value.min_crack_area_ratio = Number.isFinite(ratio)
    ? Math.min(1, Math.max(0, ratio))
    : 0.01
}

const resetCurrentModeDetectionState = () => {
  crackResult.value = []
  crackResult2.value = []
  progress.value = 0

  picked.value.segimages.forEach((seg) => {
    if (detectionMode.value === 'som') {
      seg.somMaskUrl = ''
      seg.somOverlayUrl = ''
      seg.somMetrics = null
      seg.somHaveCrack = undefined
    } else {
      seg.standardSegformerUrl = ''
      seg.standardCrackDetectionUrl = ''
      seg.standardHaveCrack = undefined
    }
  })
}

const loadModeResultsFromSegImages = () => {
  crackResult.value = []
  crackResult2.value = []

  picked.value.segimages.forEach((seg, index) => {
    const { first, second } = getModeResultPair(seg)
    const fallbackHaveCrack = (seg.have_crack === '0' || seg.have_crack === '1') ? seg.have_crack : undefined
    const modeHaveCrack = detectionMode.value === 'som'
      ? (seg.somHaveCrack ?? fallbackHaveCrack)
      : (seg.standardHaveCrack ?? fallbackHaveCrack)

    if (first) {
      crackResult.value[index] = {
        url: first,
        have_crack: modeHaveCrack,
        metrics: detectionMode.value === 'som' ? seg.somMetrics || null : null,
      }
    }
    if (second) {
      crackResult2.value[index] = {
        url: second
      }
    }
  })
}

// 废案状态（已停用）：
// const analysisDialogVisible = ref(false)
// const analysisLoading = ref(false)
// const analysisResult = ref(null)
// const analysisError = ref(null)
// const currentAnalysisIndex = ref(-1)
const dualModelDialogVisible = ref(false)
const dualModelLoading = ref(false)
const dualModelResult = ref(null)
const dualModelError = ref(null)
const currentDualModelIndex = ref(-1)
const failedImageUrls = ref(new Set())

const safeImageSrc = (url) => {
  if (!url) return ''
  return failedImageUrls.value.has(url) ? '' : url
}

const markImageFailed = (url) => {
  if (!url) return
  failedImageUrls.value.add(url)
}

const startCrackDetection = async () => {
  try {
    normalizeSomThresholds()
    if (isAllDetectionComplete.value) {
      try {
        await ElMessageBox.confirm(
          `当前${detectionMode.value === 'som' ? 'SOM' : '标准'}模式结果已存在，是否重新检测并覆盖本地显示？`,
          '确认重跑',
          { type: 'warning', confirmButtonText: '重跑', cancelButtonText: '取消' }
        )
      } catch {
        return
      }
      resetCurrentModeDetectionState()
    } else {
      // 初始化结果数组和进度
      crackResult.value = []
      crackResult2.value = []
      progress.value = 0
    }
    let allDetectionSuccess = true
    globalLoading.value = true

    // 为标准模式创建重试函数
    const retryDetectionRequests = async (url, maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`开始第 ${attempt} 次检测请求: ${url}`)
          const response1 = await axios.post('/crackdetection/segformer/predict', {
            url: url
          })
          const response2 = await axios.post('/crackdetection/crack-detection/detect', {
            url: url
          })
          
          // 检查HTTP状态码
          if (response1.status !== 200 || response2.status !== 200) {
            throw new Error(`HTTP错误 - response1状态: ${response1.status}, response2状态: ${response2.status}`)
          }
          
          // 检查业务逻辑是否成功
          if (response1.data.success && response2.data.success) {
            console.log(`第 ${attempt} 次请求成功`)
            return [response1, response2]
          } else {
            // 业务逻辑失败，抛出错误以触发重试
            const error1 = !response1.data.success ? `segformer预测失败: ${response1.data.message || '未知错误'}` : ''
            const error2 = !response2.data.success ? `crack-detection检测失败: ${response2.data.message || '未知错误'}` : ''
            throw new Error(`业务逻辑失败 - ${error1} ${error2}`.trim())
          }
        } catch (error) {
          console.warn(`检测请求失败，第 ${attempt} 次尝试:`, error.message)
          console.warn('错误详情:', error)
          
          // 检查是否是HTTP错误（包括500错误）
          if (error.response) {
            console.warn(`HTTP错误状态码: ${error.response.status}`)
          }
          
          if (attempt === maxRetries) {
            console.error(`检测请求失败，已重试 ${maxRetries} 次: ${error.message}`)
            throw new Error(`检测请求失败，已重试 ${maxRetries} 次: ${error.message}`)
          }
          
          console.log(`等待 ${1000 * attempt}ms 后进行第 ${attempt + 1} 次重试...`)
          // 等待一段时间后重试（指数退避）
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
      }
    }

    const retrySomDetectionRequest = async (url, maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await axios.post('/crackdetection/crack-detection/som-detect', {
            url: url,
            min_crack_pixels: somThresholds.value.min_crack_pixels,
            min_crack_area_ratio: somThresholds.value.min_crack_area_ratio,
          })
          if (response.status !== 200) {
            throw new Error(`HTTP错误 - response状态: ${response.status}`)
          }
          if (response.data.success) {
            return response
          }
          throw new Error(`SOM检测失败: ${response.data.message || '未知错误'}`)
        } catch (error) {
          if (attempt === maxRetries) {
            throw new Error(`SOM检测请求失败，已重试 ${maxRetries} 次: ${error.message}`)
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
      }
    }

    // 对每个几何变换的图片进行检测
    for (let i = 0; i < picked.value.segimages.length; i++) {
      const seg = picked.value.segimages[i]

      try {
        let modelResult = null
        let modelResult2 = null
        if (detectionMode.value === 'som') {
          const responseSom = await retrySomDetectionRequest(seg.image_path)
          modelResult = {
            url: responseSom.data.data.mask_url,
            have_crack: responseSom.data.have_crack ? "1" : "0",
            metrics: {
              crack_pixels: responseSom.data.data.crack_pixels,
              crack_area_ratio: responseSom.data.data.crack_area_ratio,
            }
          }
          modelResult2 = {
            url: responseSom.data.data.overlay_url
          }
        } else {
          const [response1, response2] = await retryDetectionRequests(seg.image_path)
          modelResult = {
            url: response1.data.data,
            have_crack: response1.data.have_crack ? "1" : "0"
          }
          modelResult2 = {
            url: response2.data.data.mask_url
          }
        }

        crackResult.value.push(modelResult)
        crackResult2.value.push(modelResult2)

        // 修改：每完成一个区域的检测，进度增加1
        progress.value = i + 1
        if (!Array.isArray(seg.crackimages)) seg.crackimages = []
        seg.crackimages.push(modelResult.url, modelResult2.url)
        if (detectionMode.value === 'som' && modelResult.metrics) {
          seg.somMaskUrl = modelResult.url
          seg.somOverlayUrl = modelResult2.url
          seg.somMetrics = modelResult.metrics
          seg.somHaveCrack = modelResult.have_crack
        } else {
          seg.standardSegformerUrl = modelResult.url
          seg.standardCrackDetectionUrl = modelResult2.url
          seg.standardHaveCrack = modelResult.have_crack
        }

        // 上传两个模型的检测结果
        try {
          // 上传第一个模型的检测结果
          console.log('seg_id:', seg.segId)
          await axios.post('/crackdetection/addCrackImage', {
            seg_id: seg.segId,
            image_path: modelResult.url
          })
          await axios.post('/crackdetection/addCrackImage', {
            seg_id: seg.segId,
            image_path: modelResult2.url
          })

          // 新增：调用更新分割图像的裂缝状态接口
          await axios.post('/crackdetection/update_seg_image', {
            seg_id: seg.segId,
            have_crack: modelResult.have_crack
          })
          
          console.log(`区域 ${i + 1} 裂缝状态已更新: ${modelResult.have_crack === "1" ? '有裂缝' : '无裂缝'}`)
        } catch (error) {
          console.error('Error uploading crack detection results or updating seg image:', error)
        }
      } catch (error) {
        allDetectionSuccess = false
        console.error('Detection failed:', error)
        // 修改：即使检测失败，也要更新进度
        progress.value = i + 1
      }
    }

    // 所有检测完成后，更新状态
    if (allDetectionSuccess && crackResult.value.length > 0) {
      // 添加详细的调试日志
      console.log('=== 检测结果分析 ===')
      console.log('crackResult.value:', crackResult.value)
      
      // 检查每个结果的详细信息
      crackResult.value.forEach((result, index) => {
        console.log(`第${index + 1}个区域:`, {
          url: result.url,
          have_crack: result.have_crack,
          have_crack_type: typeof result.have_crack,
          is_crack: result.have_crack === "1" || result.have_crack === true
        })
      })
      
      // 检查是否有裂缝 - 修复判断逻辑
      const hasCrack = crackResult.value.some(result => {
        const isCrack = result.have_crack === "1" || result.have_crack === true
        console.log(`检查结果: ${result.have_crack} -> ${isCrack}`)
        return isCrack
      })
      
      console.log('最终判断结果:', hasCrack ? '有裂缝' : '无裂缝')
      console.log('===================')
      
      try {
        // 上传检测状态
        const updateData = {
          image_id: store.pickedImage.image_id,
          have_crack: hasCrack ? "1" : "0",
          status: "processed"
        }
        
        console.log('准备上传的数据:', updateData)
        
        await axios.post('/crackdetection/update_image', updateData)
        
        console.log('状态更新成功')
      } catch (error) {
        console.error('Error updating image status:', error)
      }
    }
  } catch (error) {
    ElMessage.error('检测失败：' + error.message)
  } finally {
    globalLoading.value = false
  }
}

onMounted(() => {
  const projectId = store.projectId
  if (!projectId) {
    ElMessage.error('项目ID不存在')
    return
  }

  console.log('debug', store.pickedImage);
  
  // 修复数据结构不匹配的问题
  if (store.pickedImage) {
    picked.value = {
      image_path: store.pickedImage.image_path || '',
      segimages: store.pickedImage.segimages || []
    }

    picked.value.segimages.forEach((seg) => {
      if (!Array.isArray(seg.crackimages)) seg.crackimages = []
      hydrateSegModeFields(seg)
      if (seg.standardSegformerUrl && (seg.have_crack === "0" || seg.have_crack === "1")) {
        seg.standardHaveCrack = seg.have_crack
      }
    })
    
    nums.value = picked.value.segimages.length;
    progress.value = 0
    
    console.log('设置后的picked.value:', picked.value)
    console.log('分割概览图片路径:', picked.value.image_path)
    console.log('分割区域数量:', picked.value.segimages.length)
    
    // 添加调试信息：检查每个segimage是否包含segId
    picked.value.segimages.forEach((seg, index) => {
      console.log(`分割区域 ${index}:`, seg)
      console.log(`分割区域 ${index} 的 segId:`, seg.segId)
    })
    
    // 按当前模式加载已有结果，避免模式串结果
    loadModeResultsFromSegImages()
    
  } else {
    ElMessage.error('未找到图片数据，请先完成图片分割')
  }
})

watch(detectionMode, () => {
  loadModeResultsFromSegImages()
  progress.value = 0
})

// 修改获取裂缝状态的函数
const getCrackStatus = (segmentIndex, modelIndex) => {
  // modelIndex: 0 = Segformer模型, 1 = CrackDetection模型
  if (modelIndex === 0) {
    // 检查 crackResult 是否存在且有对应索引的数据
    if (crackResult.value && crackResult.value[segmentIndex]) {
      return crackResult.value[segmentIndex].have_crack
    }
  } else {
    // CrackDetection模型目前没有返回have_crack字段
    // 如果需要，可以在这里添加类似的逻辑
  }
  return null
}

// 计算检测进度的函数
const getDetectionProgress = () => {
  if (nums.value === 0) return 0
  
  let completedCount = 0
  for (let i = 0; i < nums.value; i++) {
    if (isDetectionComplete(i)) {
      completedCount++
    }
  }
  
  return Math.round((completedCount / nums.value) * 100)
}

// 判断某个区域的检测是否完成（两个模型都有结果）
const isDetectionComplete = (index) => {
  const seg = picked.value.segimages[index]
  if (!seg) return false
  const { first, second } = getModeResultPair(seg)
  return Boolean(first && second)
}

// 废案方法（已停用）：
// const openAIAnalysis = async () => {}
// const handleCloseDialog = () => {}
// const formatMarkdown = (text) => text
const handleDualModelDetection = async (index) => {
  try {
    currentDualModelIndex.value = index
    dualModelDialogVisible.value = true
    dualModelLoading.value = true
    dualModelResult.value = null
    dualModelError.value = null

    const imageUrl = picked.value.segimages[index]?.image_path
    if (!imageUrl) throw new Error('未找到区域图片')

    const response = await axios.post('/crackdetection/crack-detection/region-detect', {
      url: imageUrl
    })

    if (!response.data) throw new Error('接口返回为空')
    dualModelResult.value = response.data
    ElMessage.success('双模型协同检测完成')
  } catch (error) {
    dualModelError.value = error.response?.data?.message || error.message || '双模型协同检测失败，请重试'
    ElMessage.error('双模型协同检测失败')
  } finally {
    dualModelLoading.value = false
  }
}

const handleCloseDualModelDialog = () => {
  dualModelDialogVisible.value = false
  dualModelLoading.value = false
  dualModelResult.value = null
  dualModelError.value = null
  currentDualModelIndex.value = -1
}
</script>

<style scoped>
.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 15px;
}

.box{
  background-color: white;
  display: flex;
  width: 96%;
  max-width: 96%;
  height: 90%;
  max-height: 90%;
  margin-top: 4%;
  border-color: #171D25;
  border-radius: 5px;
  box-shadow: 0px 0px 10px rgb(81, 81, 81);
  min-width: 0;
}

.box-title{
    height: 15%;
    text-align: center;
    color: black;
    font-size: 20px;
    padding-top: 20px;
    position: relative;
    padding-left: 8px;
    padding-right: 8px;
    box-sizing: border-box;
    word-break: break-word;
}

.box-content{
    width: 100%;
    height: 85%;
    display: flex;
    justify-content: center;
    align-items: center;
    min-width: 0;
}

.result-card{
    width:100%;
    height: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)); /* 三列布局 */
    gap: 10px;
    min-width: 0;
    overflow: hidden;
}

.result-card > div {
  min-width: 0;
  overflow: hidden;
}

:deep(.el-card__body) {
  padding-right: 0;
  padding-left: 0;
  padding-top: 3%;
  padding-bottom: 0;
  height: 100%;
}

.image-container{
    width: 100%;
    height: 95%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    min-width: 0;
}

:deep(.el-timeline-item__node) {
  background-color: #07C160; /* 节点颜色 */
}

.crack-status {
  text-align: center;
  margin-top: 5px;
}

.analysis-content {
  line-height: 1.6;
  font-size: 14px;
  color: #333;
}

.analysis-content p {
  margin-bottom: 12px;
}

.analysis-content ul {
  margin: 10px 0;
  padding-left: 20px;
}

.analysis-content li {
  margin-bottom: 5px;
}

.analysis-content strong {
  font-weight: bold;
  color: #409EFF;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

.image-container :deep(.el-image__wrapper) {
  display: flex;
  justify-content: center;
  align-items: center;
}

.image-container :deep(.el-image__inner) {
  object-fit: contain;
  max-width: 100%;
  max-height: 100%;
}

:deep(.el-table .cell) {
  word-break: break-word;
}

@media (max-width: 1366px) {
  .box-title {
    font-size: 18px;
  }
}

@media (max-width: 1100px) {
  .box {
    flex-direction: column;
    width: 100%;
    max-width: 100%;
    height: auto;
    max-height: none;
    margin-top: 12px;
  }

  .box > div[style*="width:35%"],
  .box > div[style*="width:65%"] {
    width: 100% !important;
  }

  .box-content {
    height: auto;
  }

  .result-card {
    grid-template-columns: 1fr;
  }

  :deep(.el-card) {
    height: auto !important;
  }

  .image-container {
    min-height: 220px;
  }
}
</style>
