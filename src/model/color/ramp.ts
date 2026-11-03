/**
 * ramp.ts — 中性灰阶：感知明度轴 + 每模式色温
 * ---------------------------------------------------------------------------
 * toneCurve（OKLCH tone 表）→ 12 档中性色；浅 / 深各有自己的色温配方。
 * 画布可以从灰阶档位引用，也可以直接给 hex；两端对称由 `canvasSymmetry` 反解。
 */

import { fromOklch } from './oklch'
import { clamp, contrast } from './math'
import { LINE_TARGETS } from './targets'

/** 档位名与 toneCurve 顺序一一对应（50 → 950）。 */
export const NEUTRAL_STEPS = [50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 950]

/** 默认感知明度轴：严格递减（OKLCH tone）。 */
export const DEFAULT_TONE_CURVE = [98.5, 97, 95.5, 93.5, 89.5, 84, 76, 65, 54.5, 43, 32, 26]

export interface NeutralRecipe {
  hue: number
  chroma: number
  hueShift?: number
}

export interface NeutralConfig {
  toneCurve: number[]
  light: NeutralRecipe
  dark: NeutralRecipe
}

export type NeutralRamp = Record<number, string>

export interface NeutralModeInput {
  temperature?: string
  hue?: number | 'primary'
  chroma?: number
  hueShift?: number
}

export interface NeutralInput {
  preset?: string
  toneCurve?: number[]
  hue?: number | 'primary'
  chroma?: number
  light?: string | NeutralModeInput
  dark?: string | NeutralModeInput
  fromTheme?: { chromaShare?: number }
  stepRatio?: StepRatio
}

export const NEUTRAL_RECIPES: Record<string, { light: NeutralRecipe; dark: NeutralRecipe }> = {
  neutral: {
    light: { hue: 240, chroma: 0, hueShift: 0 },
    dark: { hue: 240, chroma: 0, hueShift: 0 },
  },
  'paper-night': {
    light: { hue: 70, chroma: 0.008, hueShift: -6 },
    dark: { hue: 250, chroma: 0.01, hueShift: 4 },
  },
  'same-warm': {
    light: { hue: 60, chroma: 0.008, hueShift: 0 },
    dark: { hue: 60, chroma: 0.008, hueShift: 0 },
  },
  cool: {
    light: { hue: 245, chroma: 0.008, hueShift: 4 },
    dark: { hue: 245, chroma: 0.008, hueShift: 4 },
  },
  sepia: {
    light: { hue: 60, chroma: 0.015, hueShift: -8 },
    dark: { hue: 45, chroma: 0.012, hueShift: -4 },
  },
}

export const NEUTRAL_RECIPE_NAMES = Object.keys(NEUTRAL_RECIPES)

export const NEUTRAL_TEMPERATURES: Record<string, { light: NeutralRecipe; dark: NeutralRecipe }> = {
  neutral: {
    light: { hue: 240, chroma: 0, hueShift: 0 },
    dark: { hue: 240, chroma: 0, hueShift: 0 },
  },
  warm: {
    light: { hue: 70, chroma: 0.008, hueShift: -6 },
    dark: { hue: 45, chroma: 0.01, hueShift: -4 },
  },
  cool: {
    light: { hue: 245, chroma: 0.008, hueShift: 4 },
    dark: { hue: 250, chroma: 0.01, hueShift: 4 },
  },
}

export const NEUTRAL_TEMPERATURE_NAMES = Object.keys(NEUTRAL_TEMPERATURES)

/** 画布档位：浅色取第 2 档、深色取最深档。 */
export const CANVAS_STEPS = { light: 100, dark: 950 }

export type StepRatio = 'functional' | 'band-geo' | 'band-geo-3'
export const STEP_RATIOS: StepRatio[] = ['functional', 'band-geo', 'band-geo-3']

export const NEUTRAL_LIMITS = { chroma: 0.06, hueShift: 30, chromaShare: 0.3 }

/** 解析 seed 里的 `neutral`：preset / 每模式温度 / 局部覆盖 / 主题彩度参与。 */
export function resolveNeutral(
  neutral: NeutralInput = {},
  theme: { primaryHue?: number | null; themeChroma?: number } = {},
): NeutralConfig {
  const recipe = NEUTRAL_RECIPES[neutral.preset!] ?? NEUTRAL_RECIPES.neutral
  const legacy: { hue?: number | 'primary'; chroma?: number } = {
    ...(neutral.hue != null ? { hue: neutral.hue } : {}),
    ...(neutral.chroma != null ? { chroma: neutral.chroma } : {}),
  }
  const share = clamp(neutral.fromTheme?.chromaShare ?? 0, 0, NEUTRAL_LIMITS.chromaShare)
  const themeC = clamp(theme.themeChroma ?? 0, 0, 1)
  const side = (name: 'light' | 'dark'): NeutralRecipe => {
    const input = neutral[name]
    const tempName = typeof input === 'string' ? input : input?.temperature
    if (tempName != null && !NEUTRAL_TEMPERATURES[tempName]) {
      throw new Error(
        `neutral.${name} 温度必须是 ${NEUTRAL_TEMPERATURE_NAMES.join(' / ')}，当前 ${JSON.stringify(tempName)}`,
      )
    }
    const temp = tempName ? NEUTRAL_TEMPERATURES[tempName][name] : null
    const { temperature: _ignored, ...inputObj } = ((typeof input === 'object' && input) || {}) as NeutralModeInput
    const base = typeof input === 'string' ? (temp ?? recipe[name]) : { ...(temp ?? recipe[name]), ...inputObj }
    const raw: { hue: number | 'primary'; chroma: number; hueShift?: number } = { ...base, ...legacy }
    const hue = raw.hue === 'primary' ? (theme.primaryHue ?? (base.hue as number)) : raw.hue
    const chroma = clamp(raw.chroma + themeC * share, 0, NEUTRAL_LIMITS.chroma)
    const hueShift = clamp(raw.hueShift ?? 0, -NEUTRAL_LIMITS.hueShift, NEUTRAL_LIMITS.hueShift)
    return { hue, chroma, hueShift }
  }
  return {
    toneCurve: neutral.toneCurve ?? DEFAULT_TONE_CURVE,
    light: side('light'),
    dark: side('dark'),
  }
}

/** toneCurve + 模式温度 → 12 档中性色。 */
export function neutralRamp({
  toneCurve = DEFAULT_TONE_CURVE,
  hue = 240,
  chroma = 0,
  hueShift = 0,
}: { toneCurve?: number[]; hue?: number; chroma?: number; hueShift?: number } = {}): NeutralRamp {
  if (toneCurve.length !== NEUTRAL_STEPS.length) {
    throw new Error(`toneCurve 必须是 ${NEUTRAL_STEPS.length} 档，当前 ${toneCurve.length}`)
  }
  for (let i = 1; i < toneCurve.length; i++) {
    if (!(toneCurve[i] < toneCurve[i - 1])) {
      throw new Error(`toneCurve 必须严格递减，第 ${i} 档 ${toneCurve[i]} 不小于 ${toneCurve[i - 1]}`)
    }
  }
  const first = toneCurve[0]
  const last = toneCurve[toneCurve.length - 1]
  const span = first - last
  return Object.fromEntries(
    NEUTRAL_STEPS.map((step, i) => {
      const t = toneCurve[i]
      const p = span === 0 ? i / (NEUTRAL_STEPS.length - 1) : (first - t) / span
      return [step, fromOklch(t, chroma, (hue + hueShift * p + 360) % 360)]
    }),
  )
}

/** 一次生成两套灰阶。 */
export function neutralRamps(
  config: NeutralInput,
  { primaryHue = null, themeChroma = 0 }: { primaryHue?: number | null; themeChroma?: number } = {},
): { config: NeutralConfig; light: NeutralRamp; dark: NeutralRamp } {
  const resolved = resolveNeutral(config, { primaryHue, themeChroma })
  return {
    config: resolved,
    light: neutralRamp({ toneCurve: resolved.toneCurve, ...resolved.light }),
    dark: neutralRamp({ toneCurve: resolved.toneCurve, ...resolved.dark }),
  }
}

/** 反解「与给定底色对比度恰为 k」的 tone。 */
export function solveToneFor(
  k: number,
  recipe: NeutralRecipe,
  fixedHex: string,
  { lo = 0, hi = 100 }: { lo?: number; hi?: number } = {},
): number {
  const at = (t: number) => contrast(fromOklch(t, recipe.chroma, recipe.hue), fixedHex)
  const rising = at(hi) > at(lo)
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    const tooMuch = at(mid) > k
    if (rising === tooMuch) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

/** 反解「到纯白 / 纯黑的对比度恰为 k」的 tone。 */
export function solveCanvasTone(k: number, recipe: NeutralRecipe, endpoint: 'white' | 'black'): number {
  return +solveToneFor(k, recipe, endpoint === 'white' ? '#FFFFFF' : '#000000').toFixed(3)
}

/** 两端画布对称：到各自极点取同一对比度，其余档保持原对比关系。 */
export function symmetricCanvasCurve(
  toneCurve: number[],
  k: number | { light: number; dark: number },
  lightRecipe: NeutralRecipe,
  darkRecipe: NeutralRecipe,
) {
  const iLight = NEUTRAL_STEPS.indexOf(CANVAS_STEPS.light)
  const iDark = NEUTRAL_STEPS.indexOf(CANVAS_STEPS.dark)
  const kLight = typeof k === 'object' ? k.light : k
  const kDark = typeof k === 'object' ? k.dark : k
  const lightTone = solveCanvasTone(kLight, lightRecipe, 'white')
  const darkTone = solveCanvasTone(kDark, darkRecipe, 'black')
  const at = (t: number) => fromOklch(t, lightRecipe.chroma, lightRecipe.hue)
  const oldLight = at(toneCurve[iLight])
  const newLight = at(lightTone)
  const remapped = toneCurve.map((t, i) => {
    if (i === iLight) return lightTone
    if (i === iDark) return darkTone
    const target = contrast(oldLight, at(t))
    const range = t > toneCurve[iLight] ? { lo: lightTone, hi: 100 } : { lo: 0, hi: lightTone }
    return +solveToneFor(target, lightRecipe, newLight, range).toFixed(3)
  })
  for (let i = iDark - 1; i > iLight; i--) {
    if (remapped[i] <= remapped[i + 1] + 0.05) remapped[i] = +(remapped[i + 1] + 0.05).toFixed(3)
  }
  return { toneCurve: remapped, lightTone, darkTone }
}

/**
 * 档差梯度：两端不动，按规则重新分配中间档。
 * `functional` 用 toneCurve 原值；`band-geo` 两段等比；`band-geo-3` 三段等比。
 */
export function ladderCurve(config: NeutralConfig, ratio: StepRatio): number[] {
  if (ratio === 'functional') return config.toneCurve
  const iLight = NEUTRAL_STEPS.indexOf(CANVAS_STEPS.light)
  const iDark = NEUTRAL_STEPS.indexOf(CANVAS_STEPS.dark)
  const lightTone = config.toneCurve[iLight]
  const darkTone = config.toneCurve[iDark]
  const at = (t: number) => fromOklch(t, config.light.chroma, config.light.hue)
  const lightHex = at(lightTone)
  const span = Math.log(contrast(lightHex, at(darkTone)))
  const divider = Math.log(LINE_TARGETS[1])
  const control = Math.log(LINE_TARGETS[2])
  const logs =
    ratio === 'band-geo-3'
      ? [...Array(3).fill(divider / 3), control - divider, ...Array(6).fill((span - control) / 6)]
      : [...Array(4).fill(Math.log(1.22) / 4), ...Array(6).fill((span - Math.log(1.22)) / 6)]
  const tones = [lightTone]
  let cum = 0
  for (const gap of logs) {
    cum += gap
    tones.push(+solveToneFor(Math.exp(cum), config.light, lightHex, { lo: 0, hi: lightTone }).toFixed(3))
  }
  tones[tones.length - 1] = darkTone
  const preRatio = contrast(lightHex, at(config.toneCurve[0]))
  const preTone = +solveToneFor(preRatio, config.light, lightHex, { lo: lightTone, hi: 100 }).toFixed(3)
  return [preTone, ...tones]
}
