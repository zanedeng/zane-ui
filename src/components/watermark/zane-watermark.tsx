import { Component, Element, h, Host, Prop, Watch } from '@stencil/core'
import { useMutationObserver } from '../../hooks/useMutationObserver'
import type { UseMutationObserverReturn } from '../../hooks/useMutationObserver'

interface FontType {
  color: string
  fontSize: number
  fontWeight: string
  fontStyle: string
  fontFamily: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  fontGap: number
}

const TEXT_ALIGN_RATIO_MAP: Record<string, [number, number]> = {
  left: [0, 0.5],
  start: [0, 0.5],
  center: [0.5, 0],
  right: [1, -0.5],
  end: [1, -0.5],
}

@Component({
  tag: 'zane-watermark',
  styleUrl: 'zane-watermark.scss',
})
export class ZaneWatermark {
  @Element() el!: HTMLElement

  @Prop() zIndex: number = 9

  @Prop() rotate: number = -22

  @Prop() width?: number

  @Prop() height?: number

  @Prop() image?: string

  @Prop() content: string | string[] = 'zane-ui'

  @Prop() fontColor: string = 'var(--zane-text-color-disabled)'

  @Prop() fontSize: number = 16

  @Prop() fontWeight: string = 'normal'

  @Prop() fontStyle: string = 'normal'

  @Prop() fontFamily: string = 'sans-serif'

  @Prop() textAlign: CanvasTextAlign = 'center'

  @Prop() textBaseline: CanvasTextBaseline = 'hanging'

  @Prop() fontGap: number = 3

  @Prop() gap: string = '100,100'

  @Prop() offset?: string

  private watermarkEl: HTMLDivElement | null = null

  private observer!: UseMutationObserverReturn

  private stopObservation = false

  private loaded = false

  private imageCache?: HTMLImageElement

  @Watch('zIndex')
  @Watch('rotate')
  @Watch('width')
  @Watch('height')
  @Watch('image')
  @Watch('content')
  @Watch('fontColor')
  @Watch('fontSize')
  @Watch('fontWeight')
  @Watch('fontStyle')
  @Watch('fontFamily')
  @Watch('textAlign')
  @Watch('textBaseline')
  @Watch('fontGap')
  @Watch('gap')
  @Watch('offset')
  onPropChange() {
    if (!this.loaded) return
    if (this.image) {
      this.preloadImage(this.image)
    } else {
      this.renderWatermark()
    }
  }

  componentDidLoad() {
    this.loaded = true
    if (this.image) {
      this.preloadImage(this.image)
    } else {
      this.renderWatermark()
    }
    this.setupObserver()
    this.setupThemeObserver()
  }

  disconnectedCallback() {
    this.observer?.stop()
    this.themeObserver?.disconnect()
    this.destroyWatermark()
  }

  private preloadImage(src: string) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      this.imageCache = img
      this.renderWatermark()
    }
    img.onerror = () => {
      this.imageCache = undefined
      this.renderWatermark()
    }
    img.src = src
  }

  private setupObserver() {
    this.observer = useMutationObserver(
      () => this.el,
      { attributes: true, childList: true, subtree: true },
      (mutations) => {
        if (this.stopObservation) return
        const needRender = mutations.some((m) => {
          if (m.type === 'childList') {
            const removed = Array.from(m.removedNodes)
            if (this.watermarkEl && removed.includes(this.watermarkEl)) return true
          }
          if (m.type === 'attributes' && m.target === this.watermarkEl) return true
          return false
        })
        if (needRender) {
          this.destroyWatermark()
          this.renderWatermark()
        }
      },
      this.el,
    )
    this.observer.start()
  }

  private themeObserver: MutationObserver | null = null

  private destroyWatermark() {
    if (this.watermarkEl && this.watermarkEl.parentNode) {
      this.watermarkEl.parentNode.removeChild(this.watermarkEl)
    }
    this.watermarkEl = null
  }

  private setupThemeObserver() {
    this.themeObserver = new MutationObserver(() => {
      if (this.loaded) this.renderWatermark()
    })
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
  }

  private resolveFillColor(color: string): string {
    const varMatch = color.match(/^var\((--[^,)]+)\)$/)
    if (varMatch) {
      const resolved = getComputedStyle(this.el).getPropertyValue(varMatch[1]).trim()
      if (resolved) {
        const hex = resolved.replace('#', '')
        if (/^[0-9a-f]{6}$/i.test(hex)) {
          const r = parseInt(hex.substring(0, 2), 16)
          const g = parseInt(hex.substring(2, 4), 16)
          const b = parseInt(hex.substring(4, 6), 16)
          return `rgba(${r},${g},${b},0.15)`
        }
        return resolved
      }
    }
    return color
  }

  private renderWatermark() {
    const gap = this.parseTuple(this.gap, [100, 100])
    const gapX = gap[0]
    const gapY = gap[1]
    const gapXCenter = gapX / 2
    const gapYCenter = gapY / 2

    const parsedOffset = this.offset ? this.parseTuple(this.offset, [gapXCenter, gapYCenter]) : null
    const offsetLeft = parsedOffset ? parsedOffset[0] : gapXCenter
    const offsetTop = parsedOffset ? parsedOffset[1] : gapYCenter

    const ratio = Math.max(window.devicePixelRatio || 1, 1)

    if (this.imageCache) {
      const img = this.imageCache
      const markWidth = this.width || img.naturalWidth || 120
      const markHeight = this.height || img.naturalHeight || 64
      this.drawCanvas(img, markWidth, markHeight, ratio, 0, offsetLeft, offsetTop, gapXCenter, gapYCenter, gapX, gapY)
    } else {
      this.renderTextWatermark(ratio, offsetLeft, offsetTop, gapXCenter, gapYCenter, gapX, gapY)
    }
  }

  private renderTextWatermark(
    ratio: number,
    offsetLeft: number,
    offsetTop: number,
    gapXCenter: number,
    gapYCenter: number,
    gapX: number,
    gapY: number,
  ) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const contentLines = Array.isArray(this.content)
      ? this.content
      : this.parseJsonContent(this.content) || (this.content || '').replace(/\\n/g, '\n').split('\n')
    const font: FontType = {
      color: this.fontColor,
      fontSize: this.fontSize,
      fontWeight: this.fontWeight,
      fontStyle: this.fontStyle,
      fontFamily: this.fontFamily,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline,
      fontGap: this.fontGap,
    }

    ctx.font = `${font.fontStyle} normal ${font.fontWeight} ${font.fontSize}px/${font.fontSize}px ${font.fontFamily}`

    let maxWidth = 0
    for (const line of contentLines) {
      const metrics = ctx.measureText(line)
      if (metrics.width > maxWidth) maxWidth = metrics.width
    }

    const textHeight = contentLines.length * font.fontSize + (contentLines.length - 1) * font.fontGap

    let markWidth = this.width || Math.ceil(maxWidth) + 4
    let markHeight = this.height || Math.ceil(textHeight) + 4

    const rad = (this.rotate * Math.PI) / 180
    const absSin = Math.abs(Math.sin(rad))
    const space = Math.ceil(absSin * markHeight / 2)
    markWidth += space

    this.drawCanvas(contentLines, markWidth, markHeight, ratio, space, offsetLeft, offsetTop, gapXCenter, gapYCenter, gapX, gapY)
  }

  private drawCanvas(
    content: string[] | HTMLImageElement,
    markWidth: number,
    markHeight: number,
    ratio: number,
    space: number,
    offsetLeft: number,
    offsetTop: number,
    gapXCenter: number,
    gapYCenter: number,
    gapX: number,
    gapY: number,
  ) {
    const firstCanvas = this.prepareCanvas(content, markWidth, markHeight, ratio, space)
    if (!firstCanvas) return

    const contentWidth = markWidth * ratio
    const contentHeight = markHeight * ratio

    const rad = (this.rotate * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)

    const maxSize = Math.max(markWidth, markHeight)
    const realMaxSize = maxSize * ratio

    const secondCanvas = document.createElement('canvas')
    secondCanvas.width = realMaxSize
    secondCanvas.height = realMaxSize
    const ctx2 = secondCanvas.getContext('2d')!

    ctx2.translate(realMaxSize / 2, realMaxSize / 2)
    ctx2.rotate(rad)
    ctx2.drawImage(firstCanvas, -contentWidth / 2, -contentHeight / 2)

    // Step 3: calculate bounding box of the centered, rotated content
    const halfW = contentWidth / 2
    const halfH = contentHeight / 2
    const points = [
      this.rotatePoint(-halfW, -halfH, cos, sin),
      this.rotatePoint(halfW, -halfH, cos, sin),
      this.rotatePoint(-halfW, halfH, cos, sin),
      this.rotatePoint(halfW, halfH, cos, sin),
    ]

    const minX = Math.min(...points.map(p => p[0]))
    const minY = Math.min(...points.map(p => p[1]))
    const maxX = Math.max(...points.map(p => p[0]))
    const maxY = Math.max(...points.map(p => p[1]))

    const cutLeft = minX + realMaxSize / 2
    const cutTop = minY + realMaxSize / 2
    const cutWidth = maxX - minX
    const cutHeight = maxY - minY

    const realGapX = gapX * ratio
    const realGapY = gapY * ratio

    const filledWidth = (cutWidth + realGapX) * 2
    const filledHeight = cutHeight + realGapY

    const filledCanvas = document.createElement('canvas')
    filledCanvas.width = filledWidth
    filledCanvas.height = filledHeight
    const filledCtx = filledCanvas.getContext('2d')!

    filledCtx.drawImage(secondCanvas, cutLeft, cutTop, cutWidth, cutHeight, 0, 0, cutWidth, cutHeight)
    filledCtx.drawImage(secondCanvas, cutLeft, cutTop, cutWidth, cutHeight, cutWidth + realGapX, -cutHeight / 2 - realGapY / 2, cutWidth, cutHeight)
    filledCtx.drawImage(secondCanvas, cutLeft, cutTop, cutWidth, cutHeight, cutWidth + realGapX, +cutHeight / 2 + realGapY / 2, cutWidth, cutHeight)

    const base64Url = filledCanvas.toDataURL()
    const tileWidth = filledWidth / ratio

    this.appendWatermark(base64Url, tileWidth, offsetLeft, offsetTop, gapXCenter, gapYCenter)
  }

  private prepareCanvas(
    content: string[] | HTMLImageElement,
    markWidth: number,
    markHeight: number,
    ratio: number,
    space: number,
  ): HTMLCanvasElement | null {
    const canvas = document.createElement('canvas')
    canvas.width = markWidth * ratio
    canvas.height = markHeight * ratio
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.scale(ratio, ratio)

    if (content instanceof HTMLImageElement) {
      ctx.drawImage(content, 0, 0, markWidth, markHeight)
    } else {
      const font: FontType = {
        color: this.fontColor,
        fontSize: this.fontSize,
        fontWeight: this.fontWeight,
        fontStyle: this.fontStyle,
        fontFamily: this.fontFamily,
        textAlign: this.textAlign,
        textBaseline: this.textBaseline,
        fontGap: this.fontGap,
      }

      ctx.font = `${font.fontStyle} normal ${font.fontWeight} ${font.fontSize}px/${markHeight}px ${font.fontFamily}`
      ctx.fillStyle = this.resolveFillColor(font.color)
      ctx.textAlign = font.textAlign
      ctx.textBaseline = font.textBaseline

      const [alignRatio, spaceRatio] = TEXT_ALIGN_RATIO_MAP[font.textAlign] || TEXT_ALIGN_RATIO_MAP.center

      for (let i = 0; i < content.length; i++) {
        const x = markWidth * alignRatio + space * spaceRatio
        const y = i * (font.fontSize + font.fontGap)
        ctx.fillText(content[i], x, y)
      }
    }

    return canvas
  }

  private appendWatermark(
    base64Url: string,
    tileWidth: number,
    offsetLeft: number,
    offsetTop: number,
    gapXCenter: number,
    gapYCenter: number,
  ) {
    this.stopObservation = true

    if (!this.watermarkEl) {
      this.watermarkEl = document.createElement('div')
      this.el.appendChild(this.watermarkEl)
    }

    let left = 0
    let top = 0
    let width = '100%'
    let height = '100%'
    let backgroundPosition = '0 0'

    if (offsetLeft - gapXCenter > 0) {
      left = offsetLeft - gapXCenter
      width = `calc(100% - ${left}px)`
      backgroundPosition = `-${left}px 0`
    }

    if (offsetTop - gapYCenter > 0) {
      top = offsetTop - gapYCenter
      height = `calc(100% - ${top}px)`
      backgroundPosition = `${backgroundPosition.split(' ')[0]} -${top}px`
    }

    Object.assign(this.watermarkEl.style, {
      position: 'absolute',
      left: left + 'px',
      top: top + 'px',
      width,
      height,
      zIndex: String(this.zIndex),
      pointerEvents: 'none',
      backgroundRepeat: 'repeat',
      backgroundImage: `url('${base64Url}')`,
      backgroundSize: `${Math.floor(tileWidth)}px`,
      backgroundPosition,
    })

    setTimeout(() => {
      this.stopObservation = false
    }, 0)
  }

  private parseTuple(value: string, fallback: [number, number]): [number, number] {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed) && parsed.length >= 2) {
        return [Number(parsed[0]), Number(parsed[1])]
      }
    } catch {
      // fall through
    }
    return fallback
  }

  private parseJsonContent(value: string | string[]): string[] | null {
    if (typeof value === 'string' && value.startsWith('[')) {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) return parsed.map(String)
      } catch {
        // fall through
      }
    }
    return null
  }

  private rotatePoint(x: number, y: number, cos: number, sin: number): [number, number] {
    return [x * cos - y * sin, x * sin + y * cos]
  }

  render() {
    return (
      <Host style={{ position: 'relative' }}>
        <slot />
      </Host>
    )
  }
}
