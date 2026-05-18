<template>
<div style="height: 30%;display: flex;">
    <div class="small-title" style="width: 10%;">图片列表</div>
    <div style="margin-left: 3%;width: 82%;display: flex;justify-content: center;">
        <el-carousel v-if="groupedImages.length" trigger="click" :autoplay="false" arrow="always" height="90%" class="pics">
            <el-carousel-item
             v-for="(group, groupIndex) in groupedImages" 
             :key="groupIndex"
            >
            <div class="image-group">
                <div class="group-card" v-for="(item, itemIndex) in group">
                  <div class="pic-name">
                    <span class="filename-text" :title="item.name">{{ item.name }}</span>
                    <el-tag v-if="item.detected" type="success" effect="dark" round class="item">已检测</el-tag>
                    <el-tag v-else type="warning" effect="dark" round class="item">未检测</el-tag>
                  </div>
                  <el-image
                      :key="itemIndex"
                      :src="safeImageSrc(item.src)"
                      fit="scale-down"
                      lazy
                      class="grouped-image"
                      @error="markImageFailed(item.src)"
                      @click="pickImage(item)"
                  >
                    <template #error>
                      <div class="image-slot">图片加载失败</div>
                    </template>
                  </el-image>
                </div>
            </div>
            </el-carousel-item>
        </el-carousel>
        <el-empty v-else description="暂无图片" class="list-empty" />
    </div>
</div>
<div style="height: 67%;margin-top: 3%;">
    <div style="height: 16%;display: flex;align-items: center;justify-content: center;flex-direction: column;gap: 10px;">
        <div style="display: flex;align-items: center;justify-content: center;gap: 24px;">
          <span class="small-title">幕墙块检测分割</span>
          <el-button type="primary" :disabled="globalLoading" :loading="globalLoading" @click="startSeg">
            {{ picked.detected ? '重新分割' : '开始分割' }}
          </el-button>
        </div>
        <div v-if="globalLoading" class="progress-wrap">
          <el-progress :percentage="segProgress" :stroke-width="12" :text-inside="true" status="active" />
          <div class="progress-text">{{ progressText }}</div>
        </div>
      </div>
    <div class="seg-container">
        <div>
            <div class="pic-title">原始布局</div>
            <div class="pic-container">
              <el-image class="result-pic" :src="safeImageSrc(picked.origin)" :preview-src-list="[picked.origin]" @error="markImageFailed(picked.origin)">
                <template #error>
                  <div class="image-slot">{{ imageFallbackText(picked.origin, '请选择图片') }}</div>
                </template>
              </el-image>
            </div>
        </div>
        <div>
            <div class="pic-title">分割结果</div>
            <div class="pic-container">
              <el-image class="result-pic" :src="safeImageSrc(picked.overview)" :preview-src-list="[picked.overview]" @error="markImageFailed(picked.overview)">
                <template #error>
                  <div class="image-slot">{{ imageFallbackText(picked.overview, '等待分割结果') }}</div>
                </template>
              </el-image>
            </div>
        </div>
        <div>
            <div class="pic-title">几何变换</div>
            <div class="pic-container">
                <el-carousel v-if="picked.segimages.length" trigger="click" indicator-position="none" :autoplay="false" arrow="always" height="90%" class="carouse">
                    <el-carousel-item v-for="(seg, index) in picked.segimages" :key="seg.segId || seg.image_path || index" class="seg-slide">
                    <div class="seg-index-label">区域{{ index+1 }}</div>
                    <el-image 
                        :src="safeImageSrc(seg.image_path)" 
                        alt="暂无图片"
                        :preview-src-list="[seg.image_path]"
                        :preview-teleported="true"
                        lazy
                        fit="contain"
                        class="carouse-pic"
                        @error="markImageFailed(seg.image_path)"
                    >
                      <template #error>
                        <div class="image-slot">图片加载失败</div>
                      </template>
                    </el-image>
                    </el-carousel-item>
                </el-carousel>
                <el-empty v-else description="暂无几何变换结果" class="result-empty" />
            </div>
        </div>
    </div>
</div>
</template>

<script setup>
import { computed } from 'vue';
import { ref, onMounted } from 'vue';
import axios from 'axios'
import { useCrackDetectionStore } from '../store/CrackDetection'
import { ElMessageBox } from 'element-plus'
const store = useCrackDetectionStore()

const carouselImages = ref([]);

// 将图片按3个一组分组
const groupedImages = computed(() => {
  const groups = [];
  for (let i = 0; i < carouselImages.value.length; i += 3) {
    groups.push(carouselImages.value.slice(i, i + 3));
  }
  return groups;
});

const picked = ref({
  origin: "",
  overview: "",
  detected:false,
  segimages:[]
})
const failedImageUrls = ref(new Set())

const safeImageSrc = (url) => {
  if (!url) return ''
  return failedImageUrls.value.has(url) ? '' : url
}

const markImageFailed = (url) => {
  if (!url) return
  failedImageUrls.value.add(url)
}

// 添加全局加载状态
const globalLoading = ref(false)
const segProgress = ref(0)
const progressText = ref('')
let progressTimer = null

const startProgressSimulation = () => {
  segProgress.value = 8
  progressText.value = '正在进行幕墙块检测与分割...'
  if (progressTimer) clearInterval(progressTimer)
  progressTimer = setInterval(() => {
    if (segProgress.value < 92) {
      segProgress.value += Math.max(1, Math.floor((100 - segProgress.value) / 12))
    }
  }, 800)
}

const stopProgressSimulation = (success = false) => {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
  segProgress.value = success ? 100 : 0
  progressText.value = success ? '分割完成' : ''
}

const pickImage = (image) => {
  if (!globalLoading.value) {
    picked.value.image_id = image.image_id,
    picked.value.origin = image.src
    picked.value.overview = image.segments?.image_path || ""
    picked.value.detected = image.detected
    picked.value.segimages = normalizeSegimages(image.segments?.segimages || [])
    store.pickedImage = image.segments;
    store.pickedImage.detected = image.detected;
    store.pickedImage.image_id = image.image_id;
    store.pickedImage.segimages = normalizeSegimages(image.segments?.segimages || [])
  }
};

const normalizeSegimages = (segimages = []) => {
  return segimages
    .filter(seg => seg && seg.image_path)
    .map(seg => ({
      segId: seg.segId || seg.seg_id || null,
      image_path: seg.image_path,
      crackimages: Array.isArray(seg.crackimages) ? seg.crackimages : [],
      have_crack: seg.have_crack
    }))
}

const imageFallbackText = (url, emptyText) => {
  if (!url) return emptyText
  return failedImageUrls.value.has(url) ? '图片加载失败' : emptyText
}

const startSeg = async () => {
  if (!picked.value || globalLoading.value) return

  if (picked.value.detected) {
    try {
      await ElMessageBox.confirm(
        '当前图片已有分割结果，是否重新分割并覆盖当前展示结果？',
        '确认重跑',
        { type: 'warning', confirmButtonText: '重跑', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
  }
  
  try {
    globalLoading.value = true // 设置全局加载状态
    startProgressSimulation()
    const response = await axios.post('/crackdetection/crack-detection/preprocess_file', {
      image_path: picked.value.origin
    })

    if (response.data.success) {
      const urls = response.data.data?.result_urls || []
      const noDetection = response.data.no_detection || urls.length === 0

      if (noDetection) {
        picked.value.detected = false
        stopProgressSimulation(false)
        ElMessage.warning(response.data.message || '未检测到可分割幕墙块，请更换图片后重试')
        return
      }
      
      // 更新检测结果
      picked.value.detected = true
      picked.value.segimages = urls
        .filter(url => !url.includes('segment-whole'))
        .map(url => ({ image_path: url, crackimages: [] }))
      picked.value.overview = urls.find(url => url.includes('segment-whole'))
      
      // 修复：完整设置store.pickedImage的数据结构
      store.pickedImage = {
        image_path: urls.find(url => url.includes('segment-whole')), // 分割概览图
        segimages: urls.filter(url => !url.includes('segment-whole')).map(url => ({
          image_path: url,
          crackimages: [] // 初始化裂缝检测结果数组
        })),
        detected: true,
        image_id: picked.value.image_id
      }
      
      const targetImage = carouselImages.value.find(img => img.image_id === picked.value.image_id);
      if (targetImage) {
        targetImage.detected = true;
      }

      // 调用 addSegOverview 接口上传分割结果
      try {
        const overviewResponse = await axios.post('/crackdetection/addSegOverview', {
          image_id: picked.value.image_id,
          image_path: picked.value.overview
        })
        
        if (overviewResponse.data.segoverview_id) {

          store.pickedImage.segId = overviewResponse.data.segoverview_id;

          // 修复：创建一个数组来保存更新后的segimages
          const updatedSegimages = [];
          
          for (const seg of picked.value.segimages) {
            // 先上传几何变换图片作为 segimage
            try {
              const segImageResponse = await axios.post('/crackdetection/addSegImage', {
                segoverview_id: overviewResponse.data.segoverview_id,
                image_path: seg.image_path
              })
          
              // 修复：当seg_id存在时才保存数据
              if (segImageResponse.data.seg_id) {
                updatedSegimages.push({
                  image_path: seg.image_path,
                  segId: segImageResponse.data.seg_id,  // 保存segId
                  crackimages: []
                });
              } else {
                console.error('Failed to add segment image:', segImageResponse.data)
              }
            } catch (error) {
              console.error('Error adding segment image:', error)
            }
          }
          
          // 修复：更新store.pickedImage.segimages为包含segId的完整数据
          store.pickedImage.segimages = updatedSegimages;
          picked.value.segimages = updatedSegimages;
          stopProgressSimulation(true)
        } else {
          throw new Error('添加分割概览失败')
        }
      } catch (error) {
        console.error('Error adding segment overview:', error)
        throw error
      }
    } else {
      throw new Error('预处理失败')
    }
  } catch (error) {
    stopProgressSimulation(false)
    ElMessage.error('检测失败：' + error.message)
  } finally {
    globalLoading.value = false
  }
}

const fetchPendingImages = async (projectId) => {
  try {
    const response = await axios.get(`/crackdetection/getProjectHierarchy/${projectId}`)
    
    // 如果返回的是数组，说明有待处理的图片
    if (response.data.images) {
      carouselImages.value = response.data.images.map(img => {
        const overview = img.segoverviews?.find(o => o.segimages.length > 0);

        return {
          detected: img.status === "processed",
          src: img.image_path,
          name: img.image_path.split('/').pop(),
          image_id: img.image_id,
          segments:{
            image_path: overview?.image_path,
            segimages: normalizeSegimages((overview?.segimages || []).map(seg => ({
              segId: seg.seg_id,
              image_path: seg.image_path,
              crackimages: (seg.crackimages || []).map(crack => crack.image_path),
              have_crack: seg.have_crack
            })))
          } 
        };
      });
    } 
    // 如果返回消息是没有待处理图片，则跳转到历史记录页面
    else if (response.data.message === "No pending images found") {
      ElMessage.success('所有图片已处理完成，请前往历史记录页面查看记录或打印报告')
      return
    } 
    // 其他情况可能是错误
    else {
      console.log('获取图片列表失败:', response.data.images)
      throw new Error('获取图片列表失败')
    }
  } catch (error) {
    console.error('Failed to fetch pending images:', error)
    ElMessage.error('获取待处理图片失败：' + error.message)
  }
}

onMounted(() => {
  const projectId = store.projectId
  if (!projectId) {
    ElMessage.error('项目ID不存在')
    return
  }
  
  fetchPendingImages(projectId)
})
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
  font-size: 20px;
}

.small-title{
    font-size: 28px;
    font-weight: bold;
    color: black;
    text-align: center;
    word-break: break-word;
}

.pics{
    width: 100%;
    height: 100%;
    background-color: #D6D6D6;
    overflow: hidden;
    min-width: 0;
}

.pic-name{
  color: black;
  position: static;
  max-width: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  text-align: center;
  padding: 0 8px;
  box-sizing: border-box;
  gap: 8px;
  min-width: 0;
}

.group-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.filename-text {
  display: block;
  max-width: 72%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item {
  margin-left: 10px;
}

.image-group {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)); /* 三列布局 */
  gap: 20px; /* 图片间距 */
  height: 100%;
  width: 90%;
  margin: auto;
  padding: 20px;
  box-sizing: border-box;
  min-width: 0;
  overflow: hidden;
}

.image-group > div {
  min-width: 0;
  overflow: hidden;
}

.grouped-image {
  width: 100%;
  height: calc(100% - 40px);
  max-width: 100%;
  overflow: hidden;
  cursor: pointer;
}

:deep(.el-carousel__indicator--outside button) {
  background-color: #c0c4cc;
}

:deep(.el-carousel__indicator--outside.is-active button) {
  background-color: white;
}

/* 自定义箭头样式 */
:deep(.el-carousel__arrow) {
  background-color: rgba(0, 0, 0, 0.3);
  color: white;
  font-size: 20px;
}

:deep(.el-carousel__arrow:hover) {
  background-color: rgba(0, 0, 0, 0.5);
}

.seg-container{
    width: 95%;
    height: 75%;
    margin-top: 2vh;
    border-color: #171D25;
    border-radius: 5px;
    box-shadow: 0px 0px 10px rgb(81, 81, 81);
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)); /* 三列布局，避免内容撑破 */
    gap: 10px;
    padding: 10px;
    box-sizing: border-box;
    overflow: hidden;
}

.seg-container > div {
    min-width: 0;
    overflow: hidden;
}

.pic-title{
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: black;
    height: 20%;
    font-size: 20px;
    padding: 0 8px;
    box-sizing: border-box;
    word-break: break-word;
}

.pic-container{
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 80%;
    position: relative;
    min-height: 0;
    overflow: hidden;
    box-sizing: border-box;
}

.carouse{
  width: 100%;
  max-width: 100%;
  height: 100%;
  background-color: #D6D6D6;
  overflow: hidden;
}

.seg-slide {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.carouse-pic{
  display: block;
  width: 100%;
  height: calc(100% - 28px);
  margin: auto;
}

.seg-index-label {
  height: 28px;
  line-height: 28px;
  text-align: center;
  color: black;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 8px;
  box-sizing: border-box;
}

.result-pic{
    width: 100%;
    height: 100%;
    max-width: 100%;
}

.progress-wrap {
    width: 36%;
    min-width: 420px;
}

.progress-text {
    margin-top: 6px;
    color: #666;
    font-size: 14px;
    text-align: center;
}

.list-empty,
.result-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #D6D6D6;
}

.result-pic :deep(.el-image__wrapper),
.carouse-pic :deep(.el-image__wrapper),
.grouped-image :deep(.el-image__wrapper) {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.result-pic :deep(.el-image__inner),
.carouse-pic :deep(.el-image__inner),
.grouped-image :deep(.el-image__inner) {
  object-fit: contain;
}

@media (max-width: 1366px) {
  .progress-wrap {
    width: 58%;
    min-width: 320px;
  }
}

@media (max-width: 1100px) {
  .image-group {
    grid-template-columns: 1fr;
    gap: 12px;
    width: 96%;
    padding: 12px;
  }

  .seg-container {
    grid-template-columns: 1fr;
    height: auto;
    max-height: none;
    overflow-y: auto;
  }

  .pic-title {
    height: 56px;
    font-size: 18px;
  }

  .pic-container {
    height: 320px;
  }

  .progress-wrap {
    width: 90%;
    min-width: 0;
  }

  .filename-text {
    max-width: 62%;
  }
}
</style>
