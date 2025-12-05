// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: [process.env.NUXT_UI_PRO_PATH || '@nuxt/ui-pro'],
  modules: ['@nuxt/ui', '@nuxt/fonts', '@vueuse/nuxt', "@nuxt/image", '@element-plus/nuxt','@pinia/nuxt'],

  // plugins: [
  //   '~/plugins/cleanup.js'
  // ],
  ui: {
    global: true,
    icons: {
      dynamic: true,
      families: {
        heroicons: true,
        'simple-icons': true,
        'material-symbols': true
      }
    },
    colors: ['primary', 'red', 'orange', 'green']
  },

  devtools: { enabled: true },

  // 不开启服务端渲染
  ssr: false,

  routeRules: {
    '/api/**': {
      proxy: 'http://110.42.214.164:8008/api/**'
    },
    '/predict/**': {
      proxy: 'http://110.42.214.164:8007/predict/**'
    },
    '/history/**': {
      proxy: 'http://110.42.214.164:8007/history/**'
    },
    '/oss/**': {
      proxy: 'http://110.42.214.164:9000/oss/**'
    },
    '/crackdetection/**': {
      proxy: 'http://110.42.214.164:8001/crackdetection/**'
    }
  },
  nitro: {
    devProxy: {
      '/api': {
        target: 'http://110.42.214.164:8008',
        changeOrigin: true,
      },
      '/predict': {
        target: 'http://110.42.214.164:8007',
        changeOrigin: true
      },
      '/history': {
        target: 'http://110.42.214.164:8007',
        changeOrigin: true
      },
      '/oss': {
        target: 'http://110.42.214.164:9000',
        changeOrigin: true,
      },
      '/crackdetection': {
        target: 'http://110.42.214.164:8001',
        //target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      }
    }
  },

  // 添加路由配置
  app: {
    baseURL: '/',
    buildAssetsDir: '/_nuxt/',
  },

  compatibilityDate: '2024-12-17',

  // 确保环境变量在运行时可用
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_API_BASE_URL
    }
  },

  image: {
    domains: ['110.42.214.164']
  }
})
