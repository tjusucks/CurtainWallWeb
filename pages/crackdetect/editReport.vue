<template>
  <div class="container">
    <div class="header">
      <div class="title-section">
        <el-button icon="ArrowLeft" @click="$router.back()">返回</el-button>
        <h2>编辑报告 - {{ projectDetails.project_name }}</h2>
        <div class="action-buttons">
          <el-button @click="previewReport">预览</el-button>
          <el-button type="primary" @click="saveReport">保存报告</el-button>
          <el-button type="success" @click="downloadReport">下载PDF</el-button>
        </div>
      </div>
    </div>

    <el-container class="main-content">
      <!-- 左侧图片列表 -->
      <el-aside width="300px">
        <el-card class="image-list-card">
          <template #header>
            <div class="card-header">
              <span>图片列表</span>
              <el-badge :value="projectDetails.images?.length || 0" class="image-count" />
            </div>
          </template>
          <div class="thumbnail-list" v-if="projectDetails.images?.length > 0">
            <div 
              v-for="(image, index) in projectDetails.images" 
              :key="image.image_id"
              class="image-item"
              :class="{ active: currentImageIndex === index }"
              @click="selectImage(index)"
            >
              <el-image 
                :src="image.image_path" 
                fit="cover"
                class="thumbnail"
                :preview-disabled="true"
              />
              <div class="image-info">
                <span class="image-name">图片 {{ index + 1 }}</span>
                <el-tag size="small" :type="image.have_crack === '1' ? 'danger' : 'success'">
                  {{ image.have_crack === '1' ? '有裂缝' : '无裂缝' }}
                </el-tag>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无图片" />
        </el-card>
      </el-aside>

      <!-- 主要编辑区域 -->
      <el-main>
        <div class="edit-area">
          <!-- 报告基本信息 -->
          <el-card class="info-card">
            <template #header>
              <span>报告基本信息</span>
            </template>
            <el-form :model="reportData" label-width="100px">
              <el-form-item label="项目名称">
                <el-input v-model="reportData.projectName" placeholder="请输入项目名称"></el-input>
              </el-form-item>
              <el-form-item label="报告标题">
                <el-input v-model="reportData.title" placeholder="请输入报告标题"></el-input>
              </el-form-item>
              <el-form-item label="检测单位">
                <el-input v-model="reportData.organization" placeholder="请输入检测单位"></el-input>
              </el-form-item>
              <el-form-item label="检测人员">
                <el-input v-model="reportData.inspector" placeholder="请输入检测人员"></el-input>
              </el-form-item>
              <el-form-item label="检测日期">
                <el-date-picker
                  v-model="reportData.inspectionDate"
                  type="date"
                  placeholder="选择日期"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                />
              </el-form-item>
            </el-form>
          </el-card>

          <!-- 当前图片编辑 -->
          <el-card v-if="currentImage" class="image-edit-card">
            <template #header>
              <span>图片 {{ currentImageIndex + 1 }} - 检测结果描述</span>
            </template>
            
            <div class="image-preview">
              <el-image
                :src="currentImage.image_path"
                fit="contain"
                class="preview-image"
              />
            </div>

            <!-- 分割概览 -->
            <div v-if="currentImage?.segoverviews && currentImage.segoverviews[0]" class="segmentation-section">
              <h4>分割概览</h4>
              <el-image
                :src="currentImage.segoverviews[0].image_path"
                fit="contain"
                class="seg-overview-image"
              />
              
              <!-- 检测结果网格 -->
              <div class="detection-grid">
                <div 
                  v-for="(seg, segIndex) in sortedSegImages(currentImage.segoverviews[0].segimages)" 
                  :key="seg.seg_id"
                  class="detection-item"
                >
                  <h5>区域 {{ segIndex + 1 }}</h5>
                  <div class="detection-images">
                    <div class="detection-image-item">
                      <p>几何变换</p>
                      <el-image
                        :src="seg.image_path"
                        fit="contain"
                        class="small-image"
                      />
                    </div>
                    <div v-if="getDetectionResultGroups(seg.crackimages).standard.segformerUrl" class="detection-image-item">
                      <p>Segformer</p>
                      <el-image
                        :src="getDetectionResultGroups(seg.crackimages).standard.segformerUrl"
                        fit="contain"
                        class="small-image"
                      />
                    </div>
                    <div v-if="getDetectionResultGroups(seg.crackimages).standard.crackDetectionUrl" class="detection-image-item">
                      <p>CrackDetection</p>
                      <el-image
                        :src="getDetectionResultGroups(seg.crackimages).standard.crackDetectionUrl"
                        fit="contain"
                        class="small-image"
                      />
                    </div>
                    <div v-if="getDetectionResultGroups(seg.crackimages).som.overlayUrl" class="detection-image-item">
                      <p>SOM Overlay</p>
                      <el-image
                        :src="getDetectionResultGroups(seg.crackimages).som.overlayUrl"
                        fit="contain"
                        class="small-image"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <el-form label-width="100px">
              <el-form-item label="图片描述">
                <el-input
                  :model-value="currentImageData.description"
                  @update:model-value="updateImageData('description', $event)"
                  type="textarea"
                  :rows="3"
                  placeholder="请输入图片描述"
                />
              </el-form-item>
              <el-form-item label="裂缝情况">
                <el-select 
                  :model-value="currentImageData.crackStatus"
                  @update:model-value="updateImageData('crackStatus', $event)"
                  placeholder="请选择"
                >
                  <el-option label="无裂缝" value="none" />
                  <el-option label="轻微裂缝" value="minor" />
                  <el-option label="中度裂缝" value="moderate" />
                  <el-option label="严重裂缝" value="severe" />
                </el-select>
              </el-form-item>
              <el-form-item label="详细说明">
                <el-input
                  :model-value="currentImageData.details"
                  @update:model-value="updateImageData('details', $event)"
                  type="textarea"
                  :rows="5"
                  placeholder="请输入裂缝的详细说明，包括位置、长度、宽度等信息"
                />
              </el-form-item>
              <el-form-item label="处理建议">
                <el-input
                  :model-value="currentImageData.suggestions"
                  @update:model-value="updateImageData('suggestions', $event)"
                  type="textarea"
                  :rows="3"
                  placeholder="请输入处理建议"
                />
              </el-form-item>
              
              <!-- LLM智能分析 -->
              <el-form-item v-if="currentImage?.have_crack === '1'" label="智能分析">
                <div class="llm-analysis-section">
                  <el-button 
                    type="primary" 
                    size="small" 
                    @click="analyzeCrackWithLLM(currentImageIndex)"
                    :loading="llmLoading[currentImageIndex]"
                  >
                    {{ llmLoading[currentImageIndex] ? '分析中...' : '获取智能分析' }}
                  </el-button>
                  <el-input
                    v-if="currentImageData.llmAnalysis"
                    :model-value="currentImageData.llmAnalysis"
                    @update:model-value="updateImageData('llmAnalysis', $event)"
                    type="textarea"
                    :rows="5"
                    placeholder="智能分析结果"
                    style="margin-top: 10px;"
                  />
                  <el-alert
                    v-if="currentImageData.llmAnalysis"
                    type="info"
                    :closable="false"
                    style="margin-top: 10px;"
                  >
                    <template #title>
                      <span style="font-size: 12px;">此分析由AI生成，仅供参考</span>
                    </template>
                  </el-alert>
                </div>
              </el-form-item>
            </el-form>
          </el-card>

          <!-- 总体结论 -->
          <el-card class="conclusion-card">
            <template #header>
              <span>总体结论</span>
            </template>
            <el-form :model="reportData" label-width="100px">
              <el-form-item label="总体评估">
                <el-input
                  v-model="reportData.overallAssessment"
                  type="textarea"
                  :rows="4"
                  placeholder="请输入总体评估结论"
                />
              </el-form-item>
              <el-form-item label="建议措施">
                <el-input
                  v-model="reportData.recommendations"
                  type="textarea"
                  :rows="4"
                  placeholder="请输入建议采取的措施"
                />
              </el-form-item>
            </el-form>
          </el-card>
        </div>
      </el-main>
    </el-container>

    <!-- 预览对话框 -->
    <el-dialog
      v-model="previewVisible"
      title="报告预览"
      width="90%"
      :before-close="handlePreviewClose"
    >
      <div class="report-preview">
        <div class="report-header">
          <h1>{{ reportData.title || '裂缝检测报告' }}</h1>
          <div class="report-info">
            <p>项目名称：{{ reportData.projectName }}</p>
            <p>检测单位：{{ reportData.organization }}</p>
            <p>检测人员：{{ reportData.inspector }}</p>
            <p>检测日期：{{ reportData.inspectionDate }}</p>
          </div>
        </div>

        <div class="report-body">
          <h2>检测结果</h2>
          <div v-for="(image, index) in projectDetails.images" :key="image.image_id" class="image-report-section">
            <h3>图片 {{ index + 1 }}</h3>
            <div class="image-report-content">
              <el-image :src="image.image_path" fit="contain" class="report-image" />
              <div class="image-report-text">
                <p><strong>描述：</strong>{{ imageDataList[index]?.description || '暂无描述' }}</p>
                <p><strong>裂缝情况：</strong>{{ getCrackStatusText(imageDataList[index]?.crackStatus) }}</p>
                <p><strong>详细说明：</strong>{{ imageDataList[index]?.details || '暂无详细说明' }}</p>
                <p><strong>处理建议：</strong>{{ imageDataList[index]?.suggestions || '暂无建议' }}</p>
                <div v-if="image.have_crack === '1' && imageDataList[index]?.llmAnalysis" class="llm-analysis-preview">
                  <p><strong>智能分析：</strong></p>
                  <div class="llm-content" v-html="renderMarkdown(imageDataList[index]?.llmAnalysis)"></div>
                </div>
              </div>
            </div>
            
            <!-- 分割和检测结果 -->
            <div v-if="image.segoverviews && image.segoverviews[0]" class="report-detection-results">
              <h4>检测结果详情</h4>
              <el-image :src="image.segoverviews[0].image_path" fit="contain" class="report-seg-overview" />
              
              <div class="report-detection-grid">
                <div 
                  v-for="(seg, segIdx) in sortedSegImages(image.segoverviews[0].segimages)" 
                  :key="seg.seg_id"
                  class="report-detection-item"
                >
                  <h5>区域 {{ segIdx + 1 }}</h5>
                  <div class="report-detection-images">
                    <div
                      v-for="slot in getAvailableReportImageSlots(seg)"
                      :key="slot.key"
                      class="report-detection-slot"
                    >
                      <p class="report-slot-title">{{ slot.label }}</p>
                      <div class="report-slot-image-box">
                        <el-image
                          :src="slot.url"
                          fit="contain"
                          class="report-slot-image"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="report-final-section">
            <h2>总体结论</h2>
            <p style="white-space: pre-wrap;">{{ reportData.overallAssessment || '暂无总体评估' }}</p>
            
            <h2>建议措施</h2>
            <p style="white-space: pre-wrap;">{{ reportData.recommendations || '暂无建议措施' }}</p>
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="previewVisible = false">关闭</el-button>
          <el-button type="primary" @click="exportPDF">导出PDF</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { ElMessage, ElLoading } from 'element-plus'
import { marked } from 'marked'

const route = useRoute()
const projectDetails = ref({
  project_name: '',
  project_id: null,
  images: [],
  user_name: '',
  create_time: '',
})

const currentImageIndex = ref(0)
const imageDataList = ref([])
const previewVisible = ref(false)
const llmLoading = ref({}) // 记录每个图片的LLM分析加载状态

const reportData = ref({
  projectName: '',
  title: '幕墙裂缝检测报告',
  organization: '',
  inspector: '',
  inspectionDate: new Date().toISOString().split('T')[0],
  overallAssessment: '',
  recommendations: ''
})

const currentImage = computed(() => {
  if (currentImageIndex.value === null) return null
  return projectDetails.value.images?.[currentImageIndex.value]
})

const currentImageData = computed({
  get() {
    return imageDataList.value[currentImageIndex.value] || {
      description: '',
      crackStatus: 'none',
      details: '',
      suggestions: '',
      llmAnalysis: ''
    }
  },
  set(value) {
    if (currentImageIndex.value !== null && imageDataList.value[currentImageIndex.value]) {
      imageDataList.value[currentImageIndex.value] = value
    }
  }
})

const sanitizeImageDataForStorage = (list) => {
  if (!Array.isArray(list)) return []
  return list.map((item) => ({
    description: item?.description || '',
    crackStatus: item?.crackStatus || 'none',
    details: item?.details || '',
    suggestions: item?.suggestions || ''
  }))
}

const mergeSavedImageData = (baseList, savedList) => {
  if (!Array.isArray(baseList) || baseList.length === 0) return []
  if (!Array.isArray(savedList) || savedList.length === 0) return baseList
  return baseList.map((base, idx) => {
    const saved = savedList[idx]
    if (!saved) return base
    return {
      ...base,
      description: saved.description ?? base.description,
      crackStatus: saved.crackStatus ?? base.crackStatus,
      details: saved.details ?? base.details,
      suggestions: saved.suggestions ?? base.suggestions
    }
  })
}

const selectImage = (index) => {
  currentImageIndex.value = index
}

// 更新图片数据
const updateImageData = (field, value) => {
  if (currentImageIndex.value !== null && imageDataList.value[currentImageIndex.value]) {
    imageDataList.value[currentImageIndex.value] = {
      ...imageDataList.value[currentImageIndex.value],
      [field]: value
    }
  }
}

// 获取项目详情
const fetchProjectDetails = async () => {
  try {
    const projectId = route.query.id
    console.log('Fetching project with ID:', projectId) // 添加调试信息
    
    const response = await axios.get(`/crackdetection/getProjectHierarchy/${projectId}`)
    
    console.log('API Response:', response.data) // 查看返回的数据
    console.log('Images array:', response.data.images) // 特别查看图片数组
    
    // 使用更安全的数据处理方式，与 ProjectDetail.vue 保持一致
    projectDetails.value = {
      ...response.data,
      project_name: response.data.project_name || '',
      project_id: response.data.project_id || null,
      images: response.data.images || [],
      user_name: response.data.user_name || '',
      create_time: response.data.create_time || ''
    }
    
    reportData.value.projectName = projectDetails.value.project_name
    
    // 初始化每个图片的编辑数据
    if (projectDetails.value.images && projectDetails.value.images.length > 0) {
      imageDataList.value = projectDetails.value.images.map((image) => ({
        description: '',
        crackStatus: image.have_crack === '1' ? 'severe' : 'none',
        details: '',
        suggestions: '',
        llmAnalysis: '' // 添加LLM分析字段
      }))
      
      // 默认选中第一张图片
      currentImageIndex.value = 0
    } else {
      console.warn('No images found in the response')
      imageDataList.value = []
    }
    
  } catch (error) {
    console.error('Failed to fetch project details:', error)
    ElMessage.error('获取项目详情失败：' + error.message)
  }
}

const buildOrderedCrackImages = (crackimages) => {
  if (!Array.isArray(crackimages) || crackimages.length === 0) return []
  return [...crackimages]
    .filter((img) => img && typeof img.image_path === 'string' && img.image_path)
    .sort((a, b) => {
      const ai = Number.isFinite(Number(a.crack_id)) ? Number(a.crack_id) : Number.MAX_SAFE_INTEGER
      const bi = Number.isFinite(Number(b.crack_id)) ? Number(b.crack_id) : Number.MAX_SAFE_INTEGER
      return ai - bi
    })
}

const getDetectionResultGroups = (crackimages) => {
  const ordered = buildOrderedCrackImages(crackimages)
  if (ordered.length === 0) {
    return {
      standard: { segformerUrl: '', crackDetectionUrl: '' },
      som: { overlayUrl: '' },
    }
  }

  const latestFirst = [...ordered].reverse()
  const isSomPath = (path) => path.includes('/som/') || path.includes('som-')
  const groups = {
    standard: { segformerUrl: '', crackDetectionUrl: '' },
    som: { overlayUrl: '' },
  }

  const somOverlay = latestFirst.find((img) => {
    const p = img.image_path
    return isSomPath(p) && (p.includes('overlay') || p.includes('som-mask-') || p.includes('/som/overlay/'))
  })
  if (somOverlay) groups.som.overlayUrl = somOverlay.image_path

  const standardSegformer = latestFirst.find((img) => {
    const p = img.image_path
    return !isSomPath(p) && p.includes('segformer')
  })
  const standardMask = latestFirst.find((img) => {
    const p = img.image_path
    return !isSomPath(p) && (p.includes('mask') || p.includes('highlighted') || p.includes('result'))
  })
  if (standardSegformer) groups.standard.segformerUrl = standardSegformer.image_path
  if (standardMask) groups.standard.crackDetectionUrl = standardMask.image_path
  return groups
}

const getReportImageSlots = (seg) => {
  const groups = getDetectionResultGroups(seg?.crackimages || [])
  return [
    { key: 'geom', label: '几何变换', url: seg?.image_path || '' },
    { key: 'segformer', label: 'Segformer', url: groups.standard.segformerUrl || '' },
    { key: 'crack', label: 'CrackDetection', url: groups.standard.crackDetectionUrl || '' },
    { key: 'som', label: 'SOM Overlay', url: groups.som.overlayUrl || '' }
  ]
}

const getAvailableReportImageSlots = (seg) => {
  return getReportImageSlots(seg).filter((slot) => typeof slot.url === 'string' && slot.url.trim().length > 0)
}

// 兼容旧调用
const getCrackImage = (crackimages, type) => {
  const groups = getDetectionResultGroups(crackimages)
  if (type === 'segformer') return groups.standard.segformerUrl || groups.som.overlayUrl || ''
  if (type === 'mask') return groups.standard.crackDetectionUrl || groups.som.overlayUrl || ''
  if (type === 'somOverlay') return groups.som.overlayUrl || ''
  return ''
}

// 对几何变换图片进行排序
const sortedSegImages = (segimages) => {
  return [...segimages].sort((a, b) => {
    // 从图片路径中提取数字
    const getNumber = (path) => {
      const match = path.match(/rawimage-(\d+)\.png$/)
      return match ? parseInt(match[1]) : 0
    }
    return getNumber(a.image_path) - getNumber(b.image_path)
  })
}

// 获取裂缝状态文本
const getCrackStatusText = (status) => {
  const statusMap = {
    'none': '无裂缝',
    'minor': '轻微裂缝',
    'moderate': '中度裂缝',
    'severe': '严重裂缝'
  }
  return statusMap[status] || '未评估'
}

// 渲染 Markdown 内容
const renderMarkdown = (content) => {
  if (!content) return ''
  try {
    return marked(content)
  } catch (error) {
    console.error('Markdown rendering error:', error)
    return content
  }
}

// 预览报告
const previewReport = () => {
  previewVisible.value = true
}

// 关闭预览
const handlePreviewClose = () => {
  previewVisible.value = false
}

// LLM智能分析
const analyzeCrackWithLLM = async (imageIndex) => {
  try {
    const image = projectDetails.value.images[imageIndex]
    if (!image || image.have_crack !== '1') {
      return
    }
    
    llmLoading.value[imageIndex] = true
    
    console.log('Calling LLM analyze API with URL:', image.image_path)
    
    // 调用LLM分析接口
    // 直接使用完整URL，避免代理问题
    const response = await axios.post('http://110.42.214.164:8001/llm-analyze', {
      url: image.image_path
    })
    
    console.log('LLM API response:', response.data)
    
    if (response.data.success) {
      // 更新当前图片的LLM分析结果
      updateImageData('llmAnalysis', response.data.analysis)
      ElMessage.success('智能分析完成')
    } else {
      ElMessage.error('分析失败：' + (response.data.error || '未知错误'))
    }
  } catch (error) {
    console.error('LLM analysis failed:', error)
    console.error('Error details:', error.response?.data || error.message)
    ElMessage.error('智能分析失败：' + (error.response?.data?.error || error.message))
  } finally {
    llmLoading.value[imageIndex] = false
  }
}

// 保存报告
const saveReport = async () => {
  try {
    const persistedImageData = sanitizeImageDataForStorage(imageDataList.value)
    const reportPayload = {
      projectId: projectDetails.value.project_id,
      reportData: reportData.value,
      imageDataList: persistedImageData
    }
    
    localStorage.setItem(`report_${projectDetails.value.project_id}`, JSON.stringify(reportPayload))
    
    ElMessage.success('报告保存成功')
  } catch (error) {
    ElMessage.error('保存失败：' + error.message)
  }
}

// 下载报告（不显示预览直接下载）
// PDF 生成已迁移到后端 (typst 矢量渲染)。
// 流程：POST /reports/generate → 轮询任务状态 → blob 下载。
// 前端只负责拼载荷、显示进度、触发浏览器下载。

const REPORT_POLL_INTERVAL_MS = 800
const REPORT_POLL_TIMEOUT_MS  = 5 * 60 * 1000

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms))

const buildReportPayload = () => {
  const projectId = route.query.id || projectDetails.value.project_id
  return {
    project_id: projectId,
    reportData: reportData.value,
    imageDataList: imageDataList.value,
    projectHierarchy: projectDetails.value,
  }
}

const triggerBrowserDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the download dispatch a tick before revoking; some browsers
  // (Safari, older Edge) cancel the download otherwise.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const downloadReport = async () => {
  const loadingInstance = ElLoading.service({
    lock: true,
    text: '正在提交报告生成任务...',
    background: 'rgba(0, 0, 0, 0.7)',
  })

  try {
    // 1) 提交任务
    const submitResp = await axios.post('/crackdetection/reports/generate', buildReportPayload())
    const taskId = submitResp.data?.task_id
    if (!taskId) {
      throw new Error('后端未返回 task_id')
    }

    // 2) 轮询进度
    loadingInstance.setText('正在生成 PDF (0%)...')
    const pollDeadline = Date.now() + REPORT_POLL_TIMEOUT_MS
    while (true) {
      if (Date.now() > pollDeadline) {
        throw new Error('生成超时，请稍后重试')
      }
      const statusResp = await axios.get(`/crackdetection/reports/tasks/${taskId}`)
      const data = statusResp.data || {}
      const pct = Number.isFinite(data.progress) ? data.progress : 0
      const stats = data.stats || {}
      const failed = stats.failed_images || 0
      const total  = stats.total_images  || 0
      loadingInstance.setText(
        failed > 0
          ? `正在生成 PDF (${pct}%) — 图片加载失败 ${failed}/${total}`
          : `正在生成 PDF (${pct}%)...`
      )

      if (data.status === 'success') break
      if (data.status === 'failed') {
        throw new Error(data.error || '后端报告生成失败')
      }
      await sleepMs(REPORT_POLL_INTERVAL_MS)
    }

    // 3) 下载 PDF
    loadingInstance.setText('正在下载 PDF...')
    const pdfResp = await axios.get(
      `/crackdetection/reports/tasks/${taskId}/download`,
      { responseType: 'blob' },
    )
    const fileName = `${reportData.value.projectName || '裂缝检测'}_报告_${new Date().toISOString().split('T')[0]}.pdf`
    triggerBrowserDownload(pdfResp.data, fileName)

    loadingInstance.close()
    ElMessage.success('PDF 下载成功')
  } catch (error) {
    console.error('生成报告失败:', error)
    loadingInstance.close()
    const detail = error.response?.data?.error || error.message
    ElMessage.error('PDF 生成失败：' + detail)
  }
}

// 导出PDF
const exportPDF = async () => {
  // 与主下载按钮复用同一条链路
  await downloadReport()
}

onMounted(async () => {
  await fetchProjectDetails()
  
  // 尝试加载已保存的报告数据
  const savedReport = localStorage.getItem(`report_${route.query.id}`)
  if (savedReport) {
    try {
      const parsed = JSON.parse(savedReport)
      if (parsed.reportData) {
        Object.assign(reportData.value, parsed.reportData)
      }
      if (parsed.imageDataList) {
        imageDataList.value = mergeSavedImageData(imageDataList.value, parsed.imageDataList)
      }
    } catch (error) {
      console.error('Failed to load saved report:', error)
    }
  }
})
</script>

<style scoped>
.container {
  padding: 20px;
  background-color: #F5F7FA;
  min-height: 100vh;
}

.header {
  margin-bottom: 20px;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.title-section h2 {
  margin: 0;
  color: #1989FA;
  flex: 1;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.main-content {
  height: calc(100vh - 120px);
}

.image-list-card {
  height: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.thumbnail-list {
  height: calc(100% - 60px);
  overflow-y: auto;
}

.image-item {
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: background-color 0.3s;
}

.image-item:hover {
  background-color: #f5f5f5;
}

.image-item.active {
  background-color: #e6f7ff;
}

.thumbnail {
  width: 60px;
  height: 60px;
  border-radius: 4px;
  flex-shrink: 0;
}

.image-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.image-name {
  font-size: 14px;
  color: #606266;
}

.edit-area {
  height: 100%;
  overflow-y: auto;
  padding-right: 10px;
}

.info-card,
.image-edit-card,
.conclusion-card {
  margin-bottom: 20px;
}

.image-preview {
  margin-bottom: 20px;
  text-align: center;
}

.preview-image {
  max-height: 300px;
  width: auto;
}

:deep(.el-form-item__label) {
  font-weight: bold;
}

.report-preview {
  padding: 40px;
  background-color: white;
  max-height: 70vh;
  overflow-y: auto;
}

.report-header {
  text-align: center;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e4e7ed;
}

.report-header h1 {
  margin-bottom: 20px;
  color: #303133;
}

.report-info p {
  margin: 8px 0;
  color: #606266;
}

.report-body {
  line-height: 1.8;
}

.report-body h2 {
  margin-top: 30px;
  margin-bottom: 15px;
  color: #303133;
}

.report-body h3 {
  margin-top: 20px;
  margin-bottom: 10px;
  color: #606266;
}

.image-report-section {
  margin-bottom: 30px;
  page-break-inside: avoid;
}

.image-report-content {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.report-image {
  width: 300px;
  height: auto;
  flex-shrink: 0;
}

.image-report-text {
  flex: 1;
}

.image-report-text p {
  margin: 10px 0;
  color: #606266;
}

.report-detection-results {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}

.report-detection-results h4 {
  margin-bottom: 15px;
  color: #303133;
  font-weight: bold;
}

.report-seg-overview {
  max-width: 100%;
  max-height: 300px;
  margin-bottom: 20px;
}

.report-detection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}

.report-detection-item {
  border: 1px solid #e4e7ed;
  padding: 10px;
  border-radius: 4px;
}

.report-detection-item h5 {
  text-align: center;
  margin-bottom: 10px;
  color: #606266;
  min-height: 22px;
  line-height: 22px;
}

.report-detection-images {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.report-detection-slot {
  border: 1px solid #eef0f3;
  border-radius: 4px;
  padding: 6px;
  background: #fff;
}

.report-slot-title {
  margin: 0 0 6px 0;
  font-size: 12px;
  color: #909399;
  text-align: center;
  min-height: 18px;
  line-height: 18px;
}

.report-slot-image-box {
  height: 120px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
}

.report-slot-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}

.report-slot-placeholder {
  font-size: 12px;
  color: #b0b3b8;
}

.dialog-footer {
  text-align: center;
}

.segmentation-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}

.segmentation-section h4 {
  margin-bottom: 15px;
  color: #303133;
  font-weight: bold;
}

.seg-overview-image {
  max-height: 300px;
  width: 100%;
  margin-bottom: 20px;
}

.detection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.detection-item {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 15px;
  background-color: #f9f9f9;
}

.detection-item h5 {
  margin-bottom: 10px;
  color: #606266;
  text-align: center;
}

.detection-images {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.detection-image-item {
  text-align: center;
}

.detection-image-item p {
  margin-bottom: 5px;
  font-size: 12px;
  color: #909399;
}

.small-image {
  width: 100%;
  height: 100px;
  object-fit: contain;
  border: 1px solid #eee;
  border-radius: 4px;
}

.llm-analysis-section {
  width: 100%;
}

.llm-analysis-preview {
  margin-top: 15px;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.llm-analysis-preview p {
  margin-bottom: 10px !important;
}

.llm-content {
  line-height: 1.6;
  color: #606266;
}

/* Markdown 样式 */
.llm-content :deep(h1),
.llm-content :deep(h2),
.llm-content :deep(h3),
.llm-content :deep(h4),
.llm-content :deep(h5),
.llm-content :deep(h6) {
  margin-top: 16px;
  margin-bottom: 8px;
  color: #303133;
}

.llm-content :deep(p) {
  margin: 8px 0;
}

.llm-content :deep(ul),
.llm-content :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.llm-content :deep(li) {
  margin: 4px 0;
}

.llm-content :deep(code) {
  background-color: #f0f0f0;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.9em;
}

.llm-content :deep(pre) {
  background-color: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 12px 0;
}

.llm-content :deep(blockquote) {
  border-left: 3px solid #409EFF;
  padding-left: 12px;
  margin: 12px 0;
  color: #606266;
}

.llm-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}

.llm-content :deep(th),
.llm-content :deep(td) {
  border: 1px solid #E4E7ED;
  padding: 8px 12px;
  text-align: left;
}

.llm-content :deep(th) {
  background-color: #f5f7fa;
  font-weight: bold;
}
</style>
