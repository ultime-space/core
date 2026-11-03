/**
 * math.ts — 颜色数学（平台无关）
 * ---------------------------------------------------------------------------
 * 色彩空间转换、混合、WCAG 对比度、按目标反解。只有数学与判据，
 * 不产出 token 名、不拼载体字符串。
 */

export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v))

/** '#RRGGBB' / '#RGB' → [r, g, b]（0–255）。 */
export function parseHex(hex: string): [number, number, number] {
  const v = String(hex).replace('#', '').trim()
  const full =
    v.length === 3
      ? v
          .split('')
          .map((c) => c + c)
          .join('')
      : v
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

export const toHex = (rgb: number[]): string =>
  '#' +
  rgb
    .map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

/** 与白色混合：weight = 白色占比（0–1）。 */
export const mixWhite = (hex: string, weight: number): string =>
  toHex(parseHex(hex).map((c) => c * (1 - weight) + 255 * weight))

/** 与黑色混合：weight = 黑色占比（0–1）。 */
export const mixBlack = (hex: string, weight: number): string => toHex(parseHex(hex).map((c) => c * (1 - weight)))

/** 任意两色混合：weight = b 的占比。 */
export const mix = (a: string, b: string, weight: number): string => {
  const [ar, ag, ab] = parseHex(a)
  const [br, bg, bb] = parseHex(b)
  return toHex([ar * (1 - weight) + br * weight, ag * (1 - weight) + bg * weight, ab * (1 - weight) + bb * weight])
}

/** 半透明前景叠在实色底上的合成结果。 */
export function composite(hex: string, alpha: number, background: string): string {
  const [r, g, b] = parseHex(hex)
  const [br, bg, bb] = parseHex(background)
  return toHex([r * alpha + br * (1 - alpha), g * alpha + bg * (1 - alpha), b * alpha + bb * (1 - alpha)])
}

/** RGB → HSL（h 0–360，s / l 0–1）。 */
export function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  const d = max - min
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }
  return [h, s, l]
}

/** HSL → '#RRGGBB'。 */
export function hslToRgb(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let rgb: number[]
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return toHex(rgb.map((v) => (v + m) * 255))
}

/* ==========================================================================
   对比度（WCAG 2.x）
   ========================================================================== */

export const CONTRAST = {
  /** 普通信息文字 */
  text: 4.5,
  /** 主文字（AAA） */
  textStrong: 7,
  /** 实心面文字 */
  solid: 4.5,
  /** 图元 / 描边 / 焦点环 */
  graphic: 3,
} as const

const srgbToLin = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

export const relLum = (hex: string): number => {
  const [r, g, b] = parseHex(hex).map((c) => srgbToLin(c / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const contrast = (a: string, b: string): number => {
  const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/* ==========================================================================
   反解
   ========================================================================== */

/** 在浅底上求「仍满足 need 的最亮 L」。 */
export function solveLightnessOnLight({
  hue,
  saturation,
  background,
  need,
}: {
  hue: number
  saturation: number
  background: string
  need: number
}): string {
  let lo = 0
  let hi = 1
  let best = hslToRgb(hue, saturation, 0)
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    const hex = hslToRgb(hue, saturation, mid)
    if (contrast(hex, background) >= need) {
      best = hex
      lo = mid
    } else hi = mid
  }
  return best
}

/** 在深底上求「仍满足 need 的最暗 L」。 */
export function solveLightnessOnDark({
  hue,
  saturation,
  background,
  need,
}: {
  hue: number
  saturation: number
  background: string
  need: number
}): string {
  let lo = 0
  let hi = 1
  let best = hslToRgb(hue, saturation, 1)
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    const hex = hslToRgb(hue, saturation, mid)
    if (contrast(hex, background) >= need) {
      best = hex
      hi = mid
    } else lo = mid
  }
  return best
}

/** 在任意底上把基色压到刚好达到目标（方向由底色深浅决定）。 */
export function solveToneAgainst(base: string, background: string, need: number): string {
  if (contrast(base, background) >= need) return base
  const [h, s] = rgbToHsl(parseHex(base))
  return relLum(background) > 0.5
    ? solveLightnessOnLight({ hue: h, saturation: s, background, need })
    : solveLightnessOnDark({ hue: h, saturation: s, background, need })
}

/**
 * 反解 alpha：基色叠在背景上，合成后达到目标对比度。
 * 0.03 余量吸收 hex 取整；向上取到 2 位小数。
 */
export function solveAlpha(baseHex: string, background: string, target: number): number {
  const [r, g, b] = parseHex(baseHex)
  const [br, bg, bb] = parseHex(background)
  for (let a = 0; a <= 1.0001; a += 0.005) {
    const hex = toHex([r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)])
    if (contrast(hex, background) >= target + 0.03) return Math.min(1, Math.ceil(a * 100) / 100)
  }
  return 1
}

/** 反解覆盖度：达到目标所需的最小 alpha（面层级用，不加余量）。 */
export function solveCoverage(baseHex: string, background: string, target: number): number {
  const [r, g, b] = parseHex(baseHex)
  const [br, bg, bb] = parseHex(background)
  for (let a = 0; a <= 1.0001; a += 0.002) {
    const hex = toHex([r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)])
    if (contrast(hex, background) >= target) return Math.min(1, Math.ceil(a * 500) / 500)
  }
  return 1
}
