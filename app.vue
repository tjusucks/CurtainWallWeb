<template>
  <div>
    <NuxtLoadingIndicator/>

    <NuxtLayout>
      <NuxtPage/>
    </NuxtLayout>

    <UNotifications/>
    <UModals/>
  </div>
</template>

<script setup lang="ts">
const colorMode = useColorMode()
const color = computed(() => colorMode.value === 'light' ? 'light' : '#111827')

useHead({
  title: 'Curtain Wall Monitor Platform',
  meta: [
    {charset: 'utf-8'},
    {name: 'viewport', content: 'width=device-width, initial-scale=1'},
    {key: 'theme-color', name: 'theme-color', content: color},
    {hid: 'author', name: 'author', content: 'Curtain Wall'},
    {hid: 'description', name: 'description', content: 'Curtain Wall'}
  ],
  link: [
    {rel: 'icon', type: 'image/x-icon', href: '/favicon.ico'}
  ],
  htmlAttrs: {
    lang: 'zh-CN',
  }
})

const title = 'Curtain Wall Monitor Platform'
const description = 'Curtain Wall Monitor Platform'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://dashboard-template.nuxt.dev/social-card.png',
  twitterImage: 'https://dashboard-template.nuxt.dev/social-card.png',
  twitterCard: 'summary_large_image'
})

</script>

<style>
.el-image__placeholder {
  position: relative;
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  color: #909399;
}

.el-image__placeholder::before {
  width: 26px;
  height: 26px;
  border: 3px solid #dcdfe6;
  border-top-color: #409eff;
  border-radius: 50%;
  content: "";
  animation: image-loading-spin 0.8s linear infinite;
}

.el-image__placeholder::after {
  margin-left: 10px;
  font-size: 13px;
  content: "图片加载中";
}

@keyframes image-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
