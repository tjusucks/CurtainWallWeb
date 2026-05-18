// stores/crackDetection.js
import { defineStore } from 'pinia'

const MAX_STEP = 3
const STORE_VERSION = 1
const EXPIRE_MS = 24 * 60 * 60 * 1000

const clampStep = (step) => {
    if (!Number.isInteger(step)) return 0
    if (step < 0) return 0
    if (step > MAX_STEP) return MAX_STEP
    return step
}

export const useCrackDetectionStore = defineStore('crackDetection', {
    state: () => ({
        projectId: null,  // 项目数据
        pickedImage: null,
        currentStep: 0,             // 当前步骤
        lastActiveAt: 0,
        persistVersion: STORE_VERSION
    }),
    actions: {
        touch() {
            this.lastActiveAt = Date.now()
        },
        clearFlowState() {
            this.projectId = null
            this.pickedImage = null
            this.currentStep = 0
            this.touch()
        },
        ensureConsistency() {
            const now = Date.now()
            const isExpired = !this.lastActiveAt || now - this.lastActiveAt > EXPIRE_MS
            const versionMismatch = this.persistVersion !== STORE_VERSION

            if (versionMismatch || isExpired) {
                this.clearFlowState()
                this.persistVersion = STORE_VERSION
                return
            }

            this.currentStep = clampStep(this.currentStep)

            // 没有项目时，不允许处于流程中间步骤
            if (!this.projectId && this.currentStep > 0) {
                this.currentStep = 0
            }

            // 没有已选分割图时，不允许停留在裂缝检测步骤
            if (this.currentStep >= 3 && !this.pickedImage) {
                this.currentStep = 2
            }
        },
        setProjectId(id) {
            this.projectId = id
            this.touch()
        },
        setPickedImage(image) {
            this.pickedImage = image
            this.touch()
        },
        nextStep() {
            this.ensureConsistency()
            if (this.currentStep < MAX_STEP) {
                this.currentStep += 1
                this.touch()
            }
        },
        preStep() {
            this.ensureConsistency()
            if (this.currentStep > 0) {
                this.currentStep -= 1
                this.pickedImage = null
                this.touch()
            }
        },
        setStep(step) {
            this.currentStep = clampStep(step)
            this.touch()
        },
        enterFromNavigation() {
            this.ensureConsistency()
            if (!this.projectId) {
                this.currentStep = 0
            }
            this.touch()
        }
    },
    persist: {
        key: 'crack-detection-store',  // 自定义存储键名
        paths: ['projectId', 'pickedImage', 'currentStep', 'lastActiveAt', 'persistVersion'],
        storage: localStorage,  // 使用 localStorage (默认值)

        // 可选钩子函数
        beforeRestore: (context) => {
            console.log('即将恢复状态', context.store.$id)
        },
        afterRestore: (context) => {
            console.log('状态已恢复', context.store.$id)
            context.store.ensureConsistency()
        }
    }
})
