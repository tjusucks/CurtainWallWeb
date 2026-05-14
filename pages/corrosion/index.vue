<template>
  <div class="page-card corrosion-page">
    <div class="title-row">
      <div>
        <h1 class="card-title">金属幕墙锈蚀污损检测</h1>
        <p class="card-sub"> </p>
      </div>
    </div>
    <CorrosionDetectionCorrosionPanel />
  </div>
</template>

<style scoped>
.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.corrosion-page {
  width: 100%;
  max-width: none;
  min-width: 0;
  min-height: 0;
  height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
