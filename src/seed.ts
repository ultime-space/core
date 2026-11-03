/**
 * seed.ts — 内核唯一的可编辑输入
 * ---------------------------------------------------------------------------
 * seed 只记录参数，不记录派生结果：颜色锚点 / 中性配方 / 画布对称 / 面目标 /
 * 圆角基座 / 字体栈 / 光源参数 / 动效步长。档位值由 `buildCore` 派生。
 *
 * 读取顺序：项目 JSON（JSONC）→ `resolveSeed` 深合并默认值 → 派生。
 * `seedHash` 是 manifest 的可复现指纹；同一输入必须逐字节相同。
 */

import type { NeutralInput, StepRatio } from './model/color/ramp'

export type ThemeMode = 'light' | 'dark'
export type OnSide = 'light' | 'dark'

export interface ContrastAllow {
  /** 配对名，如 `ink.secondary @ surface.raised` */
  pair: string
  /** 放行到的最低对比度 */
  min: number
  reason: string
  owner: string
  reviewBy: string
}

export interface AccentSeed {
  /** 主题色参与度 0–1 */
  pull: number
  /** 识别预算（度） */
  identityBudget: number
  /** 状态步长（tone） */
  stateSteps: number[]
  /** 语义色最低感知彩度 */
  chromaFloor: number
  /** 主色与语义色最小色相距离；只报告，不旋转 */
  hueSeparation: number
}

export interface SemanticSeed {
  hue: number
}

export interface SurfaceAlpha {
  card: number
  overlay: number
  sunken: number
  block: number
  blockLight: number
  blockStrong: number
}

export interface SurfaceSeed {
  /** 画布来源：`neutral.<档>` 或直接 hex */
  canvasLight: string
  canvasDark: string
  /** 两端画布到各自极点取同一对比度；null = 关闭 */
  canvasSymmetry: number | { light: number; dark: number } | null
  /** 面层目标：面对画布的对比度；null = 用固定 alpha */
  faceContrast: { card?: number; overlay?: number; sunken?: number } | null
  tintLight: string
  tintDark: string
  themeMix: number
  alpha: { light: SurfaceAlpha; dark: SurfaceAlpha }
  /** 遮罩 alpha；单值，不随模式 */
  scrimAlpha: number
}

export interface ColorSeed {
  primaryHue: number
  lightness: number
  chromaRatio: number
  /** 前景方向：按模式声明，浅色模式通常为 light，深色模式通常为 dark */
  onSide: { light: OnSide; dark: OnSide }
  onColors: { light: string; dark: string }
  solidTarget: number
  /** 启用的模式；单侧项目只审启用侧 */
  modes: ThemeMode[]
  /** 项目登记的颜色例外 */
  contrastAllow: ContrastAllow[]
  accent: AccentSeed
  semantics: Record<string, number | SemanticSeed>
  neutral: NeutralInput & { stepRatio?: StepRatio }
  surface: SurfaceSeed
}

export interface SkeletonSeed {
  radius: { base: number; levels: number }
  /** 字号 = base + steps[n]；档数固定 9，steps 只能整体替换 */
  fontSize: { base: number; steps: number[] }
  font: { family: string | string[]; mono: string | string[] }
}

export interface LightSeed {
  /** 光源方位：0° 正上，顺时针 */
  azimuthAngle: number
  /** 光源仰角：只影响影长，默认 60° */
  altitudeAngle: number
  blurBase: number
  blurRatio: number
  /** 墨量单位（百分比） */
  inkUnit: number
  /** 环境墨偏色；null = 继承中性墨 */
  ambientTint: { hue: number; chroma: number } | null
  /** 主光偏色；null = 纯白 */
  lightTint: { hue: number; chroma: number } | null
  rimAlpha: number
  bevel: {
    light: { highlight: number; shade: number }
    dark: { highlight: number; shade: number }
  }
}

export interface MotionSeed {
  duration: { unit: number; count: number }
  loop: { base: number; ratio: number; count: number }
  delay: { base: number; ratio: number; count: number }
  easing: { t: number } | { standard: number[]; decelerate: number[]; accelerate: number[] }
}

export interface CoreSeed {
  color: ColorSeed
  skeleton: SkeletonSeed
  light: LightSeed
  motion: MotionSeed
}

/** 深可选：项目只写要改的项；数组整体替换。 */
export type DeepPartial<T> = T extends (infer U)[] ? U[] : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T

export type SeedInput = DeepPartial<CoreSeed>

const SEMANTIC_HUES = { danger: 0, warning: 30, success: 150, info: 210 }

export const DEFAULT_SEED: CoreSeed = {
  color: {
    primaryHue: 222,
    lightness: 0.67,
    chromaRatio: 0,
    onSide: { light: 'light', dark: 'dark' },
    onColors: { light: '#FFFFFF', dark: '#000000' },
    solidTarget: 4.5,
    modes: ['light', 'dark'],
    contrastAllow: [],
    accent: {
      pull: 1,
      identityBudget: 2,
      stateSteps: [3, 6],
      chromaFloor: 0.05,
      hueSeparation: 25,
    },
    semantics: SEMANTIC_HUES,
    neutral: { preset: 'neutral', fromTheme: { chromaShare: 0 }, stepRatio: 'functional' },
    surface: {
      canvasLight: 'neutral.100',
      canvasDark: 'neutral.950',
      canvasSymmetry: 1.2,
      faceContrast: { card: 1.1, overlay: 1.14, sunken: 1.07 },
      tintLight: '#FFFFFF',
      tintDark: '#FFFFFF',
      themeMix: 0,
      alpha: {
        light: { card: 0.62, overlay: 0.84, sunken: 0.06, block: 0.08, blockLight: 0.04, blockStrong: 0.12 },
        dark: { card: 0.06, overlay: 0.1, sunken: 0.55, block: 0.35, blockLight: 0.22, blockStrong: 0.45 },
      },
      scrimAlpha: 0.42,
    },
  },
  skeleton: {
    radius: { base: 4, levels: 9 },
    fontSize: { base: 10, steps: [0, 2, 4, 6, 8, 10, 14, 22, 30] },
    font: {
      family: 'system-ui, "PingFang SC", sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    },
  },
  light: {
    azimuthAngle: 0,
    altitudeAngle: 60,
    blurBase: 8,
    blurRatio: 2,
    inkUnit: 4,
    ambientTint: null,
    lightTint: null,
    rimAlpha: 0.058,
    bevel: {
      light: { highlight: 0.2, shade: 0.14 },
      dark: { highlight: 0.14, shade: 0.2 },
    },
  },
  motion: {
    duration: { unit: 100, count: 6 },
    loop: { base: 1000, ratio: 2, count: 3 },
    delay: { base: 50, ratio: 2, count: 3 },
    easing: { t: 0.42 },
  },
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** 递归合并：数组整体替换，`null` 视为显式值（允许关闭可选项）。 */
function merge<T>(base: T, patch: unknown): T {
  if (patch === undefined) return base
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch as T
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    out[key] = merge((base as Record<string, unknown>)[key], value)
  }
  return out as T
}

/** 合并后的 seed：唯一入口；构建 / 契约 / 配置器共用。 */
export function resolveSeed(input: SeedInput = {}): CoreSeed {
  const seed = merge(DEFAULT_SEED, input)
  /* 语义色允许写成数字（只给色相）；归一成对象，派生不分支。 */
  seed.color.semantics = Object.fromEntries(
    Object.entries(seed.color.semantics).map(([name, value]) => [
      name,
      typeof value === 'number' ? { hue: value } : value,
    ]),
  )
  return seed
}

/** 稳定序列化：键排序、无空白，用于 seed 指纹。 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

/** FNV-1a 32 位：短、确定、零依赖；只用于 manifest 指纹，不做安全用途。 */
export function seedHash(seed: CoreSeed): string {
  const text = stableStringify(seed)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

/** 读 JSONC：允许行注释与块注释（seed 模板要能写说明）。 */
export function readJsonc(raw: string): unknown {
  let out = ''
  let inStr = false
  let esc = false
  let inLine = false
  let inBlock = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    const next = raw[i + 1]
    if (inLine) {
      if (ch === '\n') {
        inLine = false
        out += ch
      }
      continue
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false
        i++
      }
      continue
    }
    if (inStr) {
      out += ch
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') {
      inStr = true
      out += ch
      continue
    }
    if (ch === '/' && next === '/') {
      inLine = true
      i++
      continue
    }
    if (ch === '/' && next === '*') {
      inBlock = true
      i++
      continue
    }
    out += ch
  }
  return JSON.parse(out)
}
