/**
 * gradient.ts — 渐变规划
 * ---------------------------------------------------------------------------
 * 给两端色，判断插值空间、是否需要中间色标、阶梯纹风险与对比度采样点。
 * 只做计算与判断：不产 token、不拼 CSS、不带载体语法。
 *
 * 阈值是经验起点（见 GRADIENT_RULES），可整体替换；不随设备、长度或内容自适应。
 * 判断依据：色相距离决定中段是否穿过低彩度中心；端点色差与过渡长度决定台阶可见度。
 */

import { mix, parseHex } from './math'
import { toOklch } from './oklch'

export type GradientSpace = 'srgb' | 'oklch'
export type GradientHueMethod = 'shorter' | 'longer'
export type GradientBandingRisk = 'low' | 'medium' | 'high'
export type GradientContrastSampling = 'endpoints' | 'sample'

export interface GradientRules {
  /** 色相距离达到此值视为对立色相：直线路径可能穿过低彩度中心。 */
  opposedHue: number
  /** 中点彩度低于两端较小彩度的此比例，判为中段塌陷。 */
  midChromaFloor: number
  /** 单级台阶跨度超过此像素数时肉眼可见。 */
  stepPixels: number
  /** 两端明度差低于此值视为无明显层次。 */
  flatTone: number
  /** 两端彩度差低于此值视为无明显层次。 */
  flatChroma: number
  /** 两端色相距离低于此值才可能判为无明显层次；色相不同本身就是层次。 */
  flatHue: number
}

export const GRADIENT_RULES: GradientRules = {
  opposedHue: 120,
  midChromaFloor: 0.75,
  stepPixels: 8,
  flatTone: 6,
  flatChroma: 0.02,
  flatHue: 30,
}

export interface GradientInput {
  /** 起点色，`#RRGGBB`。 */
  from: string
  /** 终点色，`#RRGGBB`。 */
  to: string
  /** 过渡长度（px）；只影响台阶判断，默认 320。 */
  length?: number
  /** 渲染位数，默认 8。 */
  bitDepth?: 8 | 10 | 12
  /** 覆盖经验阈值；省略用 GRADIENT_RULES。 */
  rules?: Partial<GradientRules>
}

export interface GradientPlan {
  /** 两端在 OKLCH 的色相距离（0–180）。 */
  hueDistance: number
  /** 明度差（百分点）。 */
  toneDelta: number
  /** 彩度差。 */
  chromaDelta: number
  /** 中点彩度 / 两端较小彩度；越接近 1 越不容易发灰。 */
  midChromaRatio: number
  /** 单级台阶跨多少像素；两端同色时为 null。 */
  pixelsPerStep: number | null
  /** 建议的插值空间。 */
  space: GradientSpace
  /** 极坐标空间下的色相路径；只在 space 为 oklch 时生效。 */
  hueMethod: GradientHueMethod
  /** 是否需要在中间补一个保色色标。 */
  needsMidStop: boolean
  /** 两端是否接近同色，渐变几乎看不出层次。 */
  flat: boolean
  /** 阶梯纹风险。 */
  bandingRisk: GradientBandingRisk
  /** 对比度采样方式：亮度单调时只验端点，否则需沿整段采样。 */
  contrastSampling: GradientContrastSampling
  /** 诊断说明，可直接展示给使用者。 */
  notes: string[]
}

const round = (v: number, digits = 3): number => +v.toFixed(digits)

/** 两端色相的最小夹角（0–180）。 */
function hueDistanceOf(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360
  return raw > 180 ? 360 - raw : raw
}

/** 单通道最大差（8 位），用于估算可表示台阶数。 */
function channelSpan(from: string, to: string): number {
  const a = parseHex(from)
  const b = parseHex(to)
  return Math.max(...a.map((v, i) => Math.abs(v - b[i])))
}

export function planGradient(input: GradientInput): GradientPlan {
  const rules = { ...GRADIENT_RULES, ...input.rules }
  const length = input.length ?? 320
  const bitDepth = input.bitDepth ?? 8

  const from = toOklch(input.from)
  const to = toOklch(input.to)
  const hueDistance = round(hueDistanceOf(from.hue, to.hue), 2)
  const toneDelta = round(Math.abs(from.tone - to.tone), 2)
  const chromaDelta = round(Math.abs(from.chroma - to.chroma), 4)

  const midChroma = toOklch(mix(input.from, input.to, 0.5)).chroma
  const minChroma = Math.min(from.chroma, to.chroma)
  const midChromaRatio = minChroma < 1e-4 ? 1 : round(midChroma / minChroma)

  const flat = toneDelta < rules.flatTone && chromaDelta < rules.flatChroma && hueDistance < rules.flatHue
  const opposed = hueDistance >= rules.opposedHue
  const collapsed = midChromaRatio < rules.midChromaFloor

  const space: GradientSpace = opposed && collapsed ? 'oklch' : 'srgb'
  const needsMidStop = collapsed && !opposed

  const span = channelSpan(input.from, input.to)
  const bitScale = 2 ** (bitDepth - 8)
  // 位数越高，可表示台阶越多，单级台阶占的像素越少。
  const pixelsPerStep = span === 0 ? null : round(length / (span * bitScale), 1)
  const bandingRisk: GradientBandingRisk =
    flat || pixelsPerStep === null
      ? 'low'
      : pixelsPerStep > rules.stepPixels
        ? 'high'
        : pixelsPerStep > rules.stepPixels / 2
          ? 'medium'
          : 'low'

  const contrastSampling: GradientContrastSampling = space === 'srgb' ? 'endpoints' : 'sample'

  const notes: string[] = []
  if (flat) {
    notes.push('两端明度与彩度都接近，渐变几乎看不出层次；层级改由面阶、边界或字重承担。')
  }
  if (collapsed && opposed) {
    notes.push('色相距离大，直线插值会穿过低彩度中心，中段发灰；改用感知空间插值，或在中间加一个保色色标。')
    notes.push('目标环境不支持感知空间插值时，退回中间色标方案。')
  }
  if (needsMidStop) {
    notes.push('中点彩度低于两端，建议在中间补一个同色相色标，位置按实际过渡调整。')
  }
  if (bandingRisk === 'high') {
    notes.push(`单级台阶约 ${pixelsPerStep} 像素，平滑过渡可能被看见；缩短过渡、拉开色差，或叠一层细颗粒。`)
  }
  if (contrastSampling === 'sample') {
    notes.push('换空间后明度不再单调，文字对比度需沿整段采样，不能只看两端。')
  }

  return {
    hueDistance,
    toneDelta,
    chromaDelta,
    midChromaRatio,
    pixelsPerStep,
    space,
    hueMethod: 'shorter',
    needsMidStop,
    flat,
    bandingRisk,
    contrastSampling,
    notes,
  }
}
