<template>
  <div :class="['gi-card-surface', 'gi-panel', 'gi-upload-card', { 'gi-upload-card--multi': isMulti }]">
    <template v-if="isMulti">
      <div :class="['gi-multi-upload', { 'gi-multi-upload--disabled': disabled }]">
        <div class="gi-multi-upload__head">
          <div>
            <strong>四图同步上传</strong>
            <span>点击对应槽位上传，支持拖拽替换单张图片。</span>
          </div>
          <span>{{ filledCount }}/{{ files.length }}</span>
        </div>

        <div class="gi-multi-upload__grid">
          <div
            v-for="(slotFile, index) in files"
            :key="index"
            :class="[
              'gi-mini-slot',
              {
                'gi-mini-slot--filled': slotFile && previewUrls[index],
                'gi-mini-slot--disabled': disabled
              }
            ]"
            role="button"
            :tabindex="disabled ? -1 : 0"
            @click="openFileDialog(index)"
            @keydown.enter.prevent="openFileDialog(index)"
            @keydown.space.prevent="openFileDialog(index)"
            @dragover.prevent
            @drop.prevent="handleDrop($event, index)"
          >
            <template v-if="slotFile && previewUrls[index]">
              <img class="gi-mini-slot__image" :src="previewUrls[index]" :alt="`上传预览 ${index + 1}`">
              <button
                type="button"
                class="gi-mini-slot__remove"
                :disabled="disabled"
                @click.stop="$emit('remove', index)"
              >
                <UIcon name="i-heroicons-x-mark" />
              </button>
              <span class="gi-mini-slot__label">{{ slotLabel(index) }}</span>
            </template>

            <template v-else>
              <div class="gi-mini-slot__empty">
                <UIcon name="i-heroicons-plus" />
                <strong>{{ slotLabel(index) }}</strong>
                <span>点击上传</span>
              </div>
            </template>
          </div>
        </div>

        <div class="gi-multi-upload__footer">
          <div class="gi-progress">
            <span :style="{ width: `${progressWidth}%` }" />
          </div>
          <span>{{ filledCount === files.length ? '全部图片已就绪' : '待上传图片会以缩略图形式显示在对应槽位' }}</span>
        </div>
      </div>
    </template>

    <template v-else>
      <div
        :class="['gi-drop-zone', { 'gi-drop-zone--disabled': disabled }]"
        @click="openFileDialog()"
        @dragover.prevent
        @drop.prevent="handleDrop"
      >
        <template v-if="activeFile && activePreview">
          <div class="gi-single-preview">
            <div class="gi-mini-slot gi-mini-slot--filled gi-single-preview__slot">
              <img class="gi-mini-slot__image" :src="activePreview" :alt="`上传预览 ${currentIndex + 1}`">
              <button
                type="button"
                class="gi-mini-slot__remove"
                :disabled="disabled"
                @click.stop="$emit('remove', currentIndex)"
              >
                <UIcon name="i-heroicons-x-mark" />
              </button>
              <span class="gi-mini-slot__label">{{ slotLabel(currentIndex) }}</span>
            </div>
            <span>点击缩略图区域可重新上传</span>
          </div>
        </template>

        <template v-else>
          <div class="gi-drop-zone__empty">
            <div class="gi-drop-zone__icon">
              <UIcon name="i-heroicons-arrow-up-tray" />
            </div>
            <strong>点击上传或拖拽图片到此处</strong>
            <span>支持 JPG、PNG、WEBP 格式，建议上传清晰无遮挡的现场原图。</span>
          </div>
        </template>
      </div>

      <div class="gi-slot-status" style="margin-top: 14px;">
        <div class="gi-progress">
          <span :style="{ width: filledCount > 0 ? '100%' : '0%' }" />
        </div>
      </div>
    </template>

    <input
      ref="inputRef"
      class="hidden"
      type="file"
      :accept="accept"
      :disabled="disabled"
      @change="handleFileChange"
    >
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    files: (File | null)[]
    previewUrls: (string | null)[]
    currentIndex: number
    disabled?: boolean
    slotTips?: string[]
    accept?: string
  }>(),
  {
    disabled: false,
    slotTips: () => [],
    accept: 'image/*'
  }
)

const emit = defineEmits<{
  (event: 'select-file', payload: { index: number; file: File }): void
  (event: 'remove', index: number): void
  (event: 'go-prev'): void
  (event: 'go-next'): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const pendingIndex = ref<number | null>(null)

const isMulti = computed(() => props.files.length > 1)
const filledCount = computed(() => props.files.filter(Boolean).length)
const activeFile = computed(() => props.files[props.currentIndex] ?? null)
const activePreview = computed(() => props.previewUrls[props.currentIndex] ?? null)
const progressWidth = computed(() => {
  if (!props.files.length) {
    return 0
  }
  return (filledCount.value / props.files.length) * 100
})

const slotLabel = (index: number) => props.slotTips[index] || `图像 ${index + 1}`

const normalizeIndex = (index: number) => {
  if (!props.files.length) {
    return 0
  }
  return Math.min(Math.max(index, 0), props.files.length - 1)
}

const emitSelectedFile = (file: File | undefined, index = props.currentIndex) => {
  if (!file || props.disabled || !file.type.startsWith('image/')) {
    return
  }
  emit('select-file', { index: normalizeIndex(index), file })
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emitSelectedFile(target.files?.[0], pendingIndex.value ?? props.currentIndex)
  pendingIndex.value = null
  target.value = ''
}

const handleDrop = (event: DragEvent, index = props.currentIndex) => {
  if (props.disabled) {
    return
  }
  emitSelectedFile(event.dataTransfer?.files?.[0], index)
}

const openFileDialog = (index = props.currentIndex) => {
  if (!props.disabled) {
    pendingIndex.value = normalizeIndex(index)
    inputRef.value?.click()
  }
}
</script>
