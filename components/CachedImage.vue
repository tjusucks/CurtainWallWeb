<template>
  <img
    v-if="resolvedSrc"
    v-bind="$attrs"
    :src="resolvedSrc"
    :alt="alt"
    @error="handleError"
  />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { getCachedImageSrc, primeImageCache } from '~/composables/useImageCache'

defineOptions({
  inheritAttrs: false
})

const props = withDefaults(defineProps<{
  src?: string
  alt?: string
}>(), {
  src: '',
  alt: ''
})

const resolvedSrc = ref('')

watch(
  () => props.src,
  async (src) => {
    resolvedSrc.value = src ? getCachedImageSrc(src) : ''
    if (!src) return
    const cached = await primeImageCache(src)
    if (props.src === src && cached) {
      resolvedSrc.value = cached
    }
  },
  { immediate: true }
)

const handleError = async () => {
  if (!props.src) return
  resolvedSrc.value = props.src
  await primeImageCache(props.src)
}
</script>
