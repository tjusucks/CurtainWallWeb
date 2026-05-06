<template>
  <div class="gi-pointcloud-shell">
    <div ref="hostRef" class="gi-pointcloud-canvas">
      <div class="gi-pointcloud-toolbar">
        <button type="button" @click="setView('reset')">重置视角</button>
        <button type="button" @click="setView('front')">正视</button>
        <button type="button" @click="setView('top')">俯视</button>
        <button type="button" @click="setView('side')">侧视</button>
      </div>

      <div v-if="!sceneReady" class="gi-pointcloud-empty">
        <div>
          <p>暂无可显示的点云数据</p>
        </div>
      </div>
    </div>

    <div class="gi-pointcloud-legend">
      <h4>点云说明</h4>
      <div class="gi-legend-items">
        <div class="gi-legend-item">
          <div class="gi-legend-swatch" style="background-color: #3b82f6; color: #3b82f6;" />
          <span>蓝色：低于拟合平面</span>
        </div>
        <div class="gi-legend-item">
          <div class="gi-legend-swatch" style="background-color: #84cc16; color: #84cc16;" />
          <span>绿色：接近拟合平面</span>
        </div>
        <div class="gi-legend-item">
          <div class="gi-legend-swatch" style="background-color: #ef4444; color: #ef4444;" />
          <span>红色：高于拟合平面</span>
        </div>
      </div>

      <p v-if="legendText" class="gi-legend-note">{{ legendText }}</p>
      <p v-if="legendSource === 'raw'" class="gi-legend-note">
        当前结果未提供投影后的点云坐标，前端已回退到原始点云字段展示，建议以后端投影结果为准。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { PointCloudData } from '~/types/glassInspection'

interface ResolvedPointCloud {
  points: number[][]
  heights: number[]
  source: 'projected' | 'raw'
}

interface SceneStats {
  count: number
  minMm: number
  maxMm: number
  rangeMm: number
  xSpanMm: number
  ySpanMm: number
  zSpanMm: number
}

interface SceneData {
  displayPoints: number[][]
  heightsMm: number[]
  stats: SceneStats
  gridStep: number
  frame: {
    maxX: number
    maxY: number
    maxZ: number
  }
  bounds: {
    minX: number
    minY: number
    minZ: number
    maxX: number
    maxY: number
    maxZ: number
    centerX: number
    centerY: number
    centerZ: number
  }
  pointSize: number
  axisLength: number
  planePadding: number
  cameraDistance: number
  target: [number, number, number]
}

type ViewName = 'reset' | 'front' | 'top' | 'side'

const props = defineProps<{
  data: PointCloudData
}>()

const hostRef = ref<HTMLDivElement | null>(null)
const sceneReady = ref(false)
const legendText = ref('')
const legendSource = ref<'projected' | 'raw'>('projected')

const viewPresets = reactive<Record<ViewName, [number, number, number]>>({
  reset: [0, 0, 0],
  front: [0, 0, 0],
  top: [0, 0, 0],
  side: [0, 0, 0]
})

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let resizeObserver: ResizeObserver | null = null
let animationFrameId = 0
let sceneGroup: THREE.Group | null = null
let currentSceneData: SceneData | null = null

function resolvePointCloudData(data: PointCloudData): ResolvedPointCloud {
  if (Array.isArray(data.projected_points) && data.projected_points.length > 0) {
    const points = data.projected_points.filter((point) => {
      return Array.isArray(point) && point.length >= 3 && point.every((value) => Number.isFinite(value))
    })

    const heights =
      Array.isArray(data.projected_dists) && data.projected_dists.length === points.length
        ? data.projected_dists.map((value) => Number(value))
        : points.map((point) => Number(point[2] ?? 0))

    return { points, heights, source: 'projected' }
  }

  if (Array.isArray(data.points) && data.points.length > 0) {
    const points = data.points.filter((point) => {
      return Array.isArray(point) && point.length >= 3 && point.every((value) => Number.isFinite(value))
    })

    const heights =
      Array.isArray(data.dists) && data.dists.length === points.length
        ? data.dists.map((value) => Number(value))
        : points.map((point) => Number(point[2] ?? 0))

    return { points, heights, source: 'raw' }
  }

  return { points: [], heights: [], source: 'projected' }
}

function getHeightColor(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return new THREE.Color('#7dd3fc')
  }

  const bound = Math.max(Math.abs(min), Math.abs(max), 1e-6)
  const normalized = THREE.MathUtils.clamp(value / bound, -1, 1)
  const color = new THREE.Color()

  if (normalized < 0) {
    const t = normalized + 1
    color.setRGB(0.12 + 0.2 * t, 0.55 + 0.3 * t, 1 - 0.35 * t)
  } else {
    const t = normalized
    color.setRGB(0.35 + 0.65 * t, 0.85 - 0.45 * t, 0.35 - 0.35 * t)
  }

  return color
}

function getGridStep(spanMm: number) {
  const target = Math.max(spanMm / 8, 5)
  const base = 10 ** Math.floor(Math.log10(target))
  const candidates = [1, 2, 5, 10].map((multiplier) => multiplier * base)

  return candidates.reduce((best, current) => {
    return Math.abs(current - target) < Math.abs(best - target) ? current : best
  })
}

function buildSceneData(resolved: ResolvedPointCloud): SceneData | null {
  if (!resolved.points.length) {
    return null
  }

  const xMmRaw = resolved.points.map((point) => point[0] * 1000)
  const yMmRaw = resolved.points.map((point) => point[1] * 1000)
  const heightsMm = resolved.heights.map((value) => value * 1000)

  const minRawX = Math.min(...xMmRaw)
  const maxRawX = Math.max(...xMmRaw)
  const minRawY = Math.min(...yMmRaw)
  const maxRawY = Math.max(...yMmRaw)
  const minRawZ = Math.min(...heightsMm)
  const maxRawZ = Math.max(...heightsMm)

  const xSpanMm = maxRawX - minRawX
  const ySpanMm = maxRawY - minRawY
  const zSpanMm = maxRawZ - minRawZ
  const dominantSpan = Math.max(xSpanMm, ySpanMm, zSpanMm, 1)
  const planePadding = Math.max(dominantSpan * 0.18, 18)

  const shiftX = planePadding + Math.max(0, -minRawX)
  const shiftY = planePadding + Math.max(0, -minRawY)
  const shiftZ = planePadding + Math.max(0, -minRawZ)

  const displayPoints = resolved.points.map((point, index) => [
    point[0] * 1000 + shiftX,
    point[1] * 1000 + shiftY,
    heightsMm[index] + shiftZ
  ])

  const xValues = displayPoints.map((point) => point[0])
  const yValues = displayPoints.map((point) => point[1])
  const zValues = displayPoints.map((point) => point[2])

  const minX = Math.min(...xValues)
  const maxX = Math.max(...xValues)
  const minY = Math.min(...yValues)
  const maxY = Math.max(...yValues)
  const minZ = Math.min(...zValues)
  const maxZ = Math.max(...zValues)

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const centerZ = (minZ + maxZ) / 2
  const frameMaxX = maxX + planePadding
  const frameMaxY = maxY + planePadding
  const frameMaxZ = Math.max(maxZ + planePadding * 1.8, dominantSpan * 0.72 + planePadding)

  return {
    displayPoints,
    heightsMm,
    stats: {
      count: displayPoints.length,
      minMm: minRawZ,
      maxMm: maxRawZ,
      rangeMm: zSpanMm,
      xSpanMm,
      ySpanMm,
      zSpanMm
    },
    frame: {
      maxX: frameMaxX,
      maxY: frameMaxY,
      maxZ: frameMaxZ
    },
    bounds: {
      minX,
      minY,
      minZ,
      maxX,
      maxY,
      maxZ,
      centerX,
      centerY,
      centerZ
    },
    gridStep: getGridStep(dominantSpan),
    pointSize: THREE.MathUtils.clamp(dominantSpan / 150, 4, 7),
    axisLength: Math.max(frameMaxX, frameMaxY, frameMaxZ) * 1.08,
    planePadding,
    cameraDistance: Math.max(frameMaxX, frameMaxY, frameMaxZ) * 0.95 + planePadding * 2.2,
    target: [centerX, centerY, centerZ]
  }
}

function createPlaneGrid(width: number, height: number, step: number, orientation: 'xy' | 'xz' | 'yz') {
  const vertices: number[] = []
  const xLines = Math.max(1, Math.round(width / step))
  const yLines = Math.max(1, Math.round(height / step))

  const pushLine = (start: [number, number, number], end: [number, number, number]) => {
    vertices.push(...start, ...end)
  }

  for (let index = 0; index <= xLines; index += 1) {
    const value = Math.min(index * step, width)
    if (orientation === 'xy') {
      pushLine([value, 0, 0], [value, height, 0])
    } else if (orientation === 'xz') {
      pushLine([value, 0, 0], [value, 0, height])
    } else {
      pushLine([0, value, 0], [0, value, height])
    }
  }

  for (let index = 0; index <= yLines; index += 1) {
    const value = Math.min(index * step, height)
    if (orientation === 'xy') {
      pushLine([0, value, 0], [width, value, 0])
    } else if (orientation === 'xz') {
      pushLine([0, 0, value], [width, 0, value])
    } else {
      pushLine([0, 0, value], [0, width, value])
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  const material = new THREE.LineBasicMaterial({
    color: '#83f0bf',
    transparent: true,
    opacity: 0.28
  })

  return new THREE.LineSegments(geometry, material)
}

function createReferencePlanes(sceneData: SceneData) {
  const group = new THREE.Group()
  const planeColor = new THREE.Color('#6ee7b7')
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: planeColor,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide
  })

  const xyPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(sceneData.frame.maxX, sceneData.frame.maxY),
    planeMaterial.clone()
  )
  xyPlane.position.set(sceneData.frame.maxX / 2, sceneData.frame.maxY / 2, 0)
  group.add(xyPlane)
  group.add(createPlaneGrid(sceneData.frame.maxX, sceneData.frame.maxY, sceneData.gridStep, 'xy'))

  const xzPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(sceneData.frame.maxX, sceneData.frame.maxZ),
    planeMaterial.clone()
  )
  xzPlane.position.set(sceneData.frame.maxX / 2, 0, sceneData.frame.maxZ / 2)
  xzPlane.rotation.x = Math.PI / 2
  group.add(xzPlane)
  group.add(createPlaneGrid(sceneData.frame.maxX, sceneData.frame.maxZ, sceneData.gridStep, 'xz'))

  const yzPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(sceneData.frame.maxZ, sceneData.frame.maxY),
    planeMaterial.clone()
  )
  yzPlane.position.set(0, sceneData.frame.maxY / 2, sceneData.frame.maxZ / 2)
  yzPlane.rotation.y = Math.PI / 2
  group.add(yzPlane)
  group.add(createPlaneGrid(sceneData.frame.maxY, sceneData.frame.maxZ, sceneData.gridStep, 'yz'))

  group.add(
    new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      sceneData.axisLength,
      0xef4444,
      sceneData.axisLength * 0.08,
      sceneData.axisLength * 0.045
    )
  )
  group.add(
    new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      sceneData.axisLength,
      0x22c55e,
      sceneData.axisLength * 0.08,
      sceneData.axisLength * 0.045
    )
  )
  group.add(
    new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 0),
      sceneData.axisLength,
      0x3b82f6,
      sceneData.axisLength * 0.08,
      sceneData.axisLength * 0.045
    )
  )

  return group
}

function createPointCloud(sceneData: SceneData) {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(sceneData.displayPoints.flat())
  const colors = new Float32Array(sceneData.displayPoints.length * 3)

  const minHeight = Math.min(...sceneData.heightsMm)
  const maxHeight = Math.max(...sceneData.heightsMm)

  sceneData.displayPoints.forEach((_, index) => {
    const color = getHeightColor(sceneData.heightsMm[index], minHeight, maxHeight)
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
  })

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size: sceneData.pointSize,
    sizeAttenuation: false,
    vertexColors: true
  })

  return new THREE.Points(geometry, material)
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh & {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }

    if (mesh.geometry) {
      mesh.geometry.dispose()
    }

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose())
    } else if (mesh.material) {
      mesh.material.dispose()
    }
  })
}

function syncRendererSize() {
  if (!renderer || !camera || !hostRef.value) {
    return
  }

  const width = hostRef.value.clientWidth
  const height = hostRef.value.clientHeight

  if (!width || !height) {
    return
  }

  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function ensureRenderer() {
  if (!hostRef.value || renderer) {
    return
  }

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x030806, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100000)
  camera.up.set(0, 0, 1)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = true
  controls.enableZoom = true
  controls.enableRotate = true
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.screenSpacePanning = true

  hostRef.value.appendChild(renderer.domElement)
  syncRendererSize()
}

function updateLegend(sceneData: SceneData, source: 'projected' | 'raw') {
  legendSource.value = source
  legendText.value = `点数 ${sceneData.stats.count}，高度范围 ${sceneData.stats.minMm.toFixed(2)} mm 到 ${sceneData.stats.maxMm.toFixed(2)} mm，跨度 ${sceneData.stats.rangeMm.toFixed(2)} mm；平面尺寸约 ${sceneData.stats.xSpanMm.toFixed(1)} mm × ${sceneData.stats.ySpanMm.toFixed(1)} mm，Z 向范围约 ${sceneData.stats.zSpanMm.toFixed(2)} mm。`
}

function rebuildScene() {
  ensureRenderer()

  if (!scene || !camera || !controls) {
    return
  }

  const resolved = resolvePointCloudData(props.data)
  const nextSceneData = buildSceneData(resolved)
  currentSceneData = nextSceneData

  if (sceneGroup) {
    disposeObject(sceneGroup)
    scene.remove(sceneGroup)
    sceneGroup = null
  }

  if (!nextSceneData) {
    sceneReady.value = false
    legendText.value = ''
    return
  }

  const group = new THREE.Group()
  group.add(new THREE.AmbientLight(0xffffff, 0.72))

  const primaryLight = new THREE.DirectionalLight(0xffffff, 1.15)
  primaryLight.position.set(
    nextSceneData.frame.maxX * 1.15,
    -nextSceneData.frame.maxY * 0.72,
    nextSceneData.frame.maxZ * 1.12
  )
  group.add(primaryLight)

  const secondaryLight = new THREE.DirectionalLight(0xffffff, 0.45)
  secondaryLight.position.set(
    nextSceneData.frame.maxX * 0.28,
    nextSceneData.frame.maxY * 1.08,
    nextSceneData.frame.maxZ * 0.78
  )
  group.add(secondaryLight)

  group.add(createReferencePlanes(nextSceneData))
  group.add(createPointCloud(nextSceneData))

  scene.add(group)
  sceneGroup = group

  viewPresets.reset = [
    nextSceneData.frame.maxX + nextSceneData.cameraDistance * 0.42,
    -nextSceneData.cameraDistance * 0.7,
    nextSceneData.frame.maxZ + nextSceneData.cameraDistance * 0.55
  ]
  viewPresets.front = [
    nextSceneData.target[0],
    -nextSceneData.cameraDistance,
    nextSceneData.target[2] + nextSceneData.cameraDistance * 0.18
  ]
  viewPresets.top = [
    nextSceneData.target[0],
    nextSceneData.target[1],
    nextSceneData.frame.maxZ + nextSceneData.cameraDistance
  ]
  viewPresets.side = [
    nextSceneData.frame.maxX + nextSceneData.cameraDistance,
    nextSceneData.target[1],
    nextSceneData.target[2] + nextSceneData.cameraDistance * 0.18
  ]

  setView('reset')
  updateLegend(nextSceneData, resolved.source)
  sceneReady.value = true
}

function setView(view: ViewName) {
  if (!camera || !controls || !currentSceneData) {
    return
  }

  const targetPosition = viewPresets[view]
  camera.position.set(...targetPosition)
  controls.target.set(...currentSceneData.target)
  controls.update()
}

function animate() {
  if (!renderer || !scene || !camera) {
    return
  }

  controls?.update()
  renderer.render(scene, camera)
  animationFrameId = window.requestAnimationFrame(animate)
}

onMounted(() => {
  ensureRenderer()
  rebuildScene()

  if (hostRef.value) {
    resizeObserver = new ResizeObserver(() => {
      syncRendererSize()
    })
    resizeObserver.observe(hostRef.value)
  }

  animate()
})

watch(
  () => props.data,
  () => {
    rebuildScene()
  },
  { deep: true }
)

onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }

  resizeObserver?.disconnect()
  controls?.dispose()

  if (sceneGroup) {
    disposeObject(sceneGroup)
  }

  renderer?.dispose()

  if (renderer?.domElement && renderer.domElement.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement)
  }
})
</script>
