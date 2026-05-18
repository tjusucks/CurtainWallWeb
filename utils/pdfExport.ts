import { jsPDF } from 'jspdf'

interface ReportItem {
  filename: string
  input: string
  output: string
  metrics: any
  batchId?: string
  batchOrder?: number
}

const REPORT_SEQ_KEY = 'corrosion-report-seq'

function nextReportSeq(): number {
  try {
    const raw = localStorage.getItem(REPORT_SEQ_KEY)
    const current = raw ? parseInt(raw, 10) || 0 : 0
    const next = current + 1
    localStorage.setItem(REPORT_SEQ_KEY, String(next))
    return next
  } catch {
    // 若 localStorage 不可用则退化为时间戳，但仍返回数字便于编号
    return Math.floor(Date.now() / 1000)
  }
}

function padSeq(seq: number, width = 4): string {
  return seq.toString().padStart(width, '0')
}

async function ensureCJKFont(pdf: jsPDF): Promise<boolean> {
  // jsPDF 在当前环境下注册大型 TTF 会触发 "Invalid array length"。
  // 先退化为内置字体，保证导出流程可用；中文文案会降级显示。
  void pdf
  console.warn('CJK font loading temporarily disabled, fallback to Helvetica')
  return false
}

export async function generatePDFReport(items: ReportItem[], chartImages?: { pie?: string, bar?: string }) {
  if (!items.length) return

  const reportSeq = nextReportSeq()
  const today = new Date()
  const year = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const reportId = `R${year}${m}${d}${padSeq(reportSeq)}`

  const pdf = new jsPDF('p', 'mm', 'a4')
  const hasCJK = await ensureCJKFont(pdf)
  if (!hasCJK) pdf.setFont('helvetica', 'normal')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const contentWidth = pageWidth - margin * 2
  const setReportFont = (style: 'normal' | 'bold' = 'normal') => {
    if (!hasCJK) {
      pdf.setFont('helvetica', style)
    } else {
      pdf.setFont('NotoSansSC', 'normal')
    }
  }
  const safeSplitText = (text: string, maxWidth: number): string[] => {
    try {
      setReportFont('normal')
      const result = pdf.splitTextToSize(text, maxWidth)
      if (Array.isArray(result) && result.length) {
        return result.map((line) => String(line))
      }
    } catch (e) {
      console.warn('splitTextToSize failed, fallback to manual wrapping', e)
    }

    const plain = String(text || '')
    const chunkSize = Math.max(8, Math.floor(maxWidth / 2))
    const lines: string[] = []
    for (let i = 0; i < plain.length; i += chunkSize) {
      lines.push(plain.slice(i, i + chunkSize))
    }
    return lines.length ? lines : ['']
  }

  let y = margin

  // 标题与报告编号
  pdf.setFontSize(18)
  pdf.text('Corrosion Detection Report', pageWidth / 2, y, { align: 'center' })
  y += 12

  pdf.setFontSize(12)
  pdf.text(`Report ID: ${reportId}`, margin, y)
  y += 8

  // 日期与摘要
  pdf.setFontSize(10)
  pdf.text(`Date: ${new Date().toLocaleString()}`, margin, y)
  y += 8
  pdf.text(`Total Images: ${items.length}`, margin, y)
  y += 12

  // 图表（如果提供）
  if (chartImages) {
    const chartHeight = 70
    const chartWidth = (contentWidth / 2) - 5
    
    try {
      if (chartImages.pie && chartImages.bar) {
        pdf.addImage(chartImages.pie, 'PNG', margin, y, chartWidth, chartHeight)
        pdf.addImage(chartImages.bar, 'PNG', margin + chartWidth + 10, y, chartWidth, chartHeight)
      } else if (chartImages.bar) {
        pdf.addImage(chartImages.bar, 'PNG', margin, y, contentWidth, chartHeight)
      } else if (chartImages.pie) {
        pdf.addImage(chartImages.pie, 'PNG', margin, y, chartWidth, chartHeight)
      }
      if (chartImages.pie || chartImages.bar) {
        y += chartHeight + 10
      }
    } catch (e) {
      console.error('Error adding charts to PDF', e)
    }
  }

  // 按 batch 分组，保持首次出现的顺序
  type BatchGroup = { id: string; items: ReportItem[]; orderHint: number }
  const batchList: BatchGroup[] = []
  const map = new Map<string, BatchGroup>()
  for (const item of items) {
    const bid = item.batchId || 'N/A'
    let group = map.get(bid)
    if (!group) {
      group = { id: bid, items: [], orderHint: Number.POSITIVE_INFINITY }
      map.set(bid, group)
      batchList.push(group)
    }
    group.items.push(item)
    if (typeof item.batchOrder === 'number') {
      group.orderHint = Math.min(group.orderHint, item.batchOrder)
    }
  }

  for (let b = 0; b < batchList.length; b++) {
    const bid = batchList[b].id
    const list = batchList[b].items
    const labelNumber = isFinite(batchList[b].orderHint) ? (batchList[b].orderHint as number) : b + 1

    // 批次标题
    pdf.setFontSize(13)
    setReportFont('bold')
    const batchLabel = bid !== 'N/A' ? bid : `Batch-${padSeq(labelNumber, 2)}`
    const batchTitle = hasCJK
      ? `批次 #${padSeq(labelNumber, 2)} (${batchLabel})`
      : `Batch #${padSeq(labelNumber, 2)} (${batchLabel})`
    pdf.text(batchTitle, margin, y)
    setReportFont('normal')
    y += 8

    for (let i = 0; i < list.length; i++) {
      const item = list[i]

      // 检查是否需要新页面
      if (y > pageHeight - 100) {
        pdf.addPage()
        y = margin
      }

      const safeBatch = batchLabel.replace(/\s+/g, '_')
      const itemSeqLabel = `${reportId}-B${padSeq(labelNumber, 2)}-${padSeq(i + 1, 2)}-${safeBatch}`

      // 编号
      pdf.setFontSize(12)
      setReportFont('bold')
      pdf.text(`ID: ${itemSeqLabel}`, margin, y)
      setReportFont('normal')
      y += 6

      // 文件名
      pdf.setFontSize(9)
      pdf.text(`File: ${item.filename}`, margin, y)
      y += 8

      // 图像
      const imgHeight = 60
      const imgWidth = (contentWidth / 2) - 2
      
      try {
        const inputData = await getImageData(item.input)
        if (inputData) {
          pdf.addImage(inputData, 'JPEG', margin, y, imgWidth, imgHeight, undefined, 'FAST')
          pdf.setFontSize(10)
          setReportFont('bold')
          pdf.text('Before', margin, y + imgHeight + 6)
          setReportFont('normal')
        }

        const outputData = await getImageData(item.output)
        if (outputData) {
          pdf.addImage(outputData, 'JPEG', margin + imgWidth + 4, y, imgWidth, imgHeight, undefined, 'FAST')
          pdf.setFontSize(10)
          setReportFont('bold')
          pdf.text('After', margin + imgWidth + 4, y + imgHeight + 6)
          setReportFont('normal')
        }
      } catch (e) {
        console.error('Error adding image to PDF', e)
      }

      y += imgHeight + 10

      const tableX = margin
      const tableWidth = contentWidth
      const colWidth = tableWidth / 3
      const baseRow = 8
      const lineHeight = 4.5
      const pad = 4

      const measureHeight = (lines: string[]) => Math.max(baseRow, lines.length * lineHeight + pad)
      const fmtRatio = (value?: number) => (typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : '-')
      const fmtConf = (value?: number) => (typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '-')
      const m = item.metrics || {}
      const metricRows = [
        [
          `${hasCJK ? '锈蚀数量' : 'Corrosion Count'}: ${m.corrosion_count ?? 0}`,
          `${hasCJK ? '锈斑数量' : 'Rust Spots Count'}: ${m.rust_spots_count ?? 0}`,
          `${hasCJK ? '总数量' : 'Total Count'}: ${m.total_count ?? m.count ?? 0}`,
        ],
        [
          `${hasCJK ? '锈蚀面积占比' : 'Corrosion Area'}: ${fmtRatio(m.corrosion_area_ratio)}`,
          `${hasCJK ? '锈斑面积占比' : 'Rust Spots Area'}: ${fmtRatio(m.rust_spots_area_ratio)}`,
          `${hasCJK ? '整体面积占比' : 'Total Area'}: ${fmtRatio(m.total_area_ratio ?? m.area_ratio)}`,
        ],
        [
          `${hasCJK ? '锈蚀平均置信度' : 'Corrosion Conf'}: ${fmtConf(m.corrosion_avg_conf)}`,
          `${hasCJK ? '锈斑平均置信度' : 'Rust Spots Conf'}: ${fmtConf(m.rust_spots_avg_conf)}`,
          `${hasCJK ? '整体平均置信度' : 'Total Conf'}: ${fmtConf(m.total_avg_conf ?? m.avg_conf)}`,
        ],
      ]

      setReportFont('normal')
      const metricLines = metricRows.map((row) => row.map((val) => safeSplitText(val, colWidth - 4)))
      const rowHeights = metricLines.map((row) => measureHeight(row.flat()))
      const neededHeight = rowHeights.reduce((sum, height) => sum + height, 0) + 10
      if (y > pageHeight - neededHeight) {
        pdf.addPage()
        y = margin
      }

      pdf.setDrawColor(180)
      pdf.setLineWidth(0.1)
      pdf.setFontSize(9)

      let finalY = y
      for (let r = 0; r < metricLines.length; r++) {
        for (let c = 0; c < 3; c++) {
          const x = tableX + c * colWidth
          pdf.rect(x, finalY, colWidth, rowHeights[r])
          pdf.text(metricLines[r][c], x + 2, finalY + 5)
        }
        finalY += rowHeights[r]
      }

      y = finalY + 12 // 下一项的间距
    }

    y += 4 // 批次之间留白
  }

  pdf.save(`corrosion_report_${reportId}.pdf`)
}

async function getImageData(url: string): Promise<string | null> {
  if (!url) return null
  
  // 如果已经是 base64 data URI，直接返回
  if (url.startsWith('data:image')) return url

  try {
    let fetchUrl = url
    const config = useRuntimeConfig()
    const corrosionApiBase = (config.public.corrosionApiBase as string) || 'http://8.153.161.229:18000'
    const baseUrl = corrosionApiBase.replace(/\/$/, '')
    
    // 如果是后端服务器路径（/images/...），直接访问腐蚀后端
    if (url.startsWith('/images/') || url.startsWith('images/')) {
      const normalizedPath = url.startsWith('/') ? url : `/${url}`
      fetchUrl = `${baseUrl}${normalizedPath}`
    } 
    // 如果是绝对路径（任意后端域名的 /images/...），也直接切到腐蚀后端
    else if (url.includes('/images/') && (url.startsWith('http://') || url.startsWith('https://'))) {
      const pathMatch = url.match(/\/images\/.+/)
      if (pathMatch) {
        fetchUrl = `${baseUrl}${pathMatch[0]}`
      }
    }
    // blob: URL 和其他 http(s): URL 直接访问
    
    const res = await fetch(fetchUrl)
    if (!res.ok) {
      console.error(`Failed to fetch image: ${res.status} ${res.statusText}`, fetchUrl)
      return null
    }
    
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => {
        console.error('FileReader error', fetchUrl)
        reject(null)
      }
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.error('Failed to load image', url, e)
    return null
  }
}
