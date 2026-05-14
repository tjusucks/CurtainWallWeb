<template>
  <UDashboardLayout>
    <UDashboardPanel :width="250" :resizable="{ min: 200, max: 300 }" collapsible>
      <UDashboardNavbar class="!border-transparent" :ui="{ left: 'flex-1' }">
        <template #left>
          <WebInfo/>

        </template>
      </UDashboardNavbar>

      <UDashboardSidebar>
        <template #header>
          <UDashboardSearchButton/>
        </template>

        <UDashboardSidebarLinks :links="links"/>

        <UDivider/>

        <!--
        <UDashboardSidebarLinks :links="[{ label: 'Colors', draggable: true, children: colors }]" @update:links="(colors: any) => defaultColors = colors" />
        -->
        <div class="flex-1"/>

        <UDashboardSidebarLinks :links="footerLinks"/>

        <UDivider class="sticky bottom-0"/>

        <template #footer>
          <!-- ~/components/UserDropdown.vue -->
          <UserDropdown/>
        </template>
      </UDashboardSidebar>
    </UDashboardPanel>

    <slot/>

    <!-- ~/components/HelpSlideover.vue -->
    <HelpSlideover/>
    <!-- ~/components/NotificationsSlideover.vue -->
    <!-- <NotificationsSlideover /> -->

    <ClientOnly>
      <LazyUDashboardSearch :groups="groups"/>
    </ClientOnly>
  </UDashboardLayout>
</template>

<script setup lang="ts">
import {useRoute, useRouter} from "vue-router";
import {onMounted} from "vue";
import axios from "axios";

const route = useRoute();
const router = useRouter();
const appConfig = useAppConfig();
const {isHelpSlideoverOpen} = useDashboard();
const TEMP_TOKEN = "temp-corrosion-access-token";

// definePageMeta({
//   middleware: "slidebar-renew",
// });

const userPermissions = ref({
  is_superuser: false,
  access_system_a: false,
  access_system_b: false,
  access_system_c: false,
  access_system_d: false,
  access_system_v: false,
  access_system_f: false,
  access_system_g: false,
  access_system_h: false,
  access_system_z: false,
});



const baseLinks = [
  {
    id: "home",
    label: "首页",
    icon: "i-heroicons-home",
    to: "/",
    tooltip: {
      text: "首页",
      shortcuts: ["G", "H"],
    },
  },
  {
    id: "wind",
    label: "幕墙振动监测",
    icon: "i-simple-icons-tailwindcss",
    to: "/monitor",
    defaultOpen: false,
    children: [
      {
        id: "monitor",
        label: "监测中心",
        icon: "i-heroicons-chart-bar-square",
        to: "/vibration",
        defaultOpen: false,
        tooltip: {
          text: "监测中心",
          shortcuts: ["G", "M"],
        },
        children: [
          {
            label: "监测总览",
            to: "/vibration/dashboard",
          },
          {
            label: "实时监测",
            to: "/vibration",
            exact: true,
          },
          {
            label: "预警规则",
            to: "/vibration/parameter",
          },
          {
            label: "预警记录",
            to: "/vibration/abnormal",
          },
          {
            label: "服务器监控",
            to: "/vibration/server-monitor",
          },

        ],
      },
    ],
    tooltip: {
      text: "震动数据检测",
    },
  },
  {
    id: "stoneCrack",
    label: "石材裂缝检测",
    icon: "i-simple-icons-affinitypublisher",
    to: "/crackdetect",
    defaultOpen: false,
    children: [
      {
        label: "检测中心",
        to : "/crackdetect",
        exact: true,
      },
      {
        label:"历史记录",
        to : "/crackdetect/history",
      },
      {
        label: "数据集一览",
        to: "/crackdetect/datasets",
      }
    ]
  },

  {
    id: "resilienceAssessment",
    label: "幕墙性能评估",
    icon: "i-simple-icons-testcafe",
    to: "/resilience",
    defaultOpen: false,
    children: [
      {
        id: "dataset",
        label: "数据集管理",
        icon: "heroicons-solid:database",
        to: "/resilience/views/DataSetsView",
        defaultOpen: false,
        tooltip: {
          text: "数据集管理",
          shortcuts: ["G", "M"],
        }
      },
      {
        id: "analysisJob",
        label: "分析任务",
        icon: "heroicons-solid:calculator",
        to: "/resilience/views/DataSetsView",
        defaultOpen: false,
        tooltip: {
          text: "分析任务",
          shortcuts: ["G", "M"],
        },
        children: [
          {
            label: "模型列表",
            to: "/resilience/views/AnalysisModelsView",
          },
          {
            label: "任务管理",
            to: "/resilience/views/AnalysisJobView",
            exact: true,
          },
        ],
      },
      {
        id: "visualization",
        label: "可视化",
        icon: "heroicons-solid:computer-desktop",
        to: "/resilience/visualization",
        defaultOpen: false,
        tooltip: {
          text: "可视化",
          shortcuts: ["G", "M"],
        },
        children: [
          {
            label: "聚类分析",
            to: "/resilience/views/VisualizationClusterView",
          },
          {
            label: "雷达图",
            to: "/resilience/views/VisualizationRadarView",
          },
          {
            label: "热力图",
            to: "/resilience/views/VisualizationHeatMapView",
          },
          {
            label: "剖面分析",
            to: "/resilience/views/VisualizationSliceView",
          },
        ],
      },
      {
        id: "reports",
        label: "报告管理",
        icon: "heroicons-solid:document-report",
        to: "/resilience/reports",
        defaultOpen: false,
        tooltip: {
          text: "报告管理",
          shortcuts: ["G", "M"],
        },
        children: [
          {
            label: "报告生成",
            to: "/resilience/views/ReportsGenerateView",
          },
          {
            label: "历史报告",
            to: "/resilience/views/ReportsHistoryView",
            exact: true,
          },
        ],
      },
    ],
    tooltip: {
      text: "幕墙韧性评估",
    },
  },


  {
    id: "stoneDirty",
    label: "石材污渍检测",
    to: "/stonedirty/mainpage",
    icon: "i-heroicons-fire",
    tooltip: {
      text: "石材污渍检测",
    },
    defaultOpen: false,
    children: [
      {
        label: "上传图片",
        to: "/stonedirty/mainpage",
        exact: true,
      },
      {
        label: "历史图片",
        to: "/stonedirty/otherpage",
      },
    ],

  },
  {
    id: "corrosion",
    label: "金属幕墙锈蚀污损检测",
    to: "/corrosion",
    icon: "i-heroicons-fire",
    tooltip: {
      text: "金属幕墙锈蚀污损检测",
    },
    defaultOpen: false,
    children: [
      {
        label: "检测中心",
        to: "/corrosion",
        exact: true,
      },
      {
        label: "历史记录",
        to: "/corrosion/history",
      },
      {
        label: "日志中心",
        to: "/corrosion/logs",
      },
    ],
  },
  {
    id: "userManage",
    label: "用户管理",
    to: "/userManage",
    icon: "i-heroicons-book-open",
    tooltip: {
      text: "用户管理",
    },
  },
];

const userAuth = ref({
  is_superuser: false,
  access_system_a: false,
  access_system_b: false,
  access_system_c: false,
  access_system_d: false,
  access_system_v: false,
  access_system_f: false,
  access_system_g: false,
  access_system_h: false,
  access_system_z: false,
});

const links = computed(() => {
  const hiddenIds = new Set<string>()

  if (!userAuth.value.is_superuser) {
    if (!userAuth.value.access_system_a) hiddenIds.add("3DBuildingModel")
    if (!userAuth.value.access_system_b) hiddenIds.add("stoneDirty")
    if (!userAuth.value.access_system_c) hiddenIds.add("stoneCrack")
    if (!userAuth.value.access_system_d) hiddenIds.add("explosion")
    if (!userAuth.value.access_system_v) hiddenIds.add("wind")
    if (!userAuth.value.access_system_f) hiddenIds.add("segment")
    if (!userAuth.value.access_system_g) hiddenIds.add("glassFlatness")
    if (!userAuth.value.access_system_h) {
      hiddenIds.add("resilienceAssessment")
      hiddenIds.add("glassToughnessJudge")
    }
    if (!userAuth.value.access_system_z) hiddenIds.add("corrosion")
    hiddenIds.add("userManage")
  }

  return baseLinks.filter((link) => !hiddenIds.has(link.id))
})

const getUserAuth = async () => {
  try {
    const authToken = localStorage.getItem("authToken");
    if (!authToken || authToken === TEMP_TOKEN) {
      localStorage.removeItem("authToken");
      const storedAuth = JSON.parse(localStorage.getItem("userAuth") || "{}");
      if (storedAuth?.temp_corrosion_bypass) {
        delete storedAuth.temp_corrosion_bypass;
        localStorage.setItem("userAuth", JSON.stringify(storedAuth));
      }
      return;
    }
    const response = await axios.get("/api/account/custom/getPermissions", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    userAuth.value = response.data.data;
  } catch (error) {
    console.error("Failed to fetch permissions");
    ElMessage.error("获取用户权限失败");
  }
};

onMounted(() => {
  getUserAuth();
});

const footerLinks = [
  {
    label: "帮助与支持",
    icon: "i-heroicons-question-mark-circle",
    click: () => (isHelpSlideoverOpen.value = true),
  },
];

const groups = computed(() => [
  {
    key: "links",
    label: "Go to",
    commands: links.value.map((link) => ({
      ...link,
      shortcuts: link.tooltip?.shortcuts,
    })),
  },
  {
    key: "code",
    label: "Code",
    commands: [
      {
        id: "source",
        label: "GitHub",
        icon: "i-simple-icons-github",
        click: () => {
          window.open(
              `https://github.com/CurtainWallMonitoringPlatform`,
              "_blank"
          );
        },
      },
    ],
  },
]);

const defaultColors = ref(
    ["green", "teal", "cyan", "sky", "blue", "indigo", "violet"].map((color) => ({
      label: color,
      chip: color,
      click: () => (appConfig.ui.primary = color),
    }))
);
const colors = computed(() =>
    defaultColors.value.map((color) => ({
      ...color,
      active: appConfig.ui.primary === color.label,
    }))
);

const backToMain = () => {
  router.push("/");
};
</script>

<style>
.back-to-main-btn {
  margin: 5px;
  align-self: flex-end;
  /* 对齐到容器的左侧 */
}
</style>
