/**
 * derive.ts — 颜色派生：seed → 画布 / 面阶 / 墨 / 线 / 状态 / 色族矩阵
 * ---------------------------------------------------------------------------
 * 派生链固定：
 *   1. 中性灰 + 画布对称 → 画布；
 *   2. 面阶 = 画布 + tint，按面对画布的目标反解 alpha；
 *   3. 色族 = 基底色相 → 实心填充按 solidTarget 反解 → 软底 / 描边 / 墨；
 *   4. 墨与线按声明底反解 alpha，目标是设计值；
 *   5. 模式成对输出：同一名字在 light / dark 下两个值。
 *
 * 本文件只产出平台无关的颜色值；载体语法在 exporters。
 */

import type { ColorSeed } from '../../seed'
import { color, mode, type ColorValue, type ModeValue } from '../../tree'
import {
  CONTRAST,
  clamp,
  composite,
  contrast,
  hslToRgb,
  mix,
  mixBlack,
  mixWhite,
  parseHex,
  rgbToHsl,
  solveAlpha,
  solveCoverage,
  solveLightnessOnDark,
  solveLightnessOnLight,
  solveToneAgainst,
} from './math'
import { chromaMax, fromOklch, toOklch } from './oklch'
import { CANVAS_STEPS, ladderCurve, neutralRamps, symmetricCanvasCurve, type NeutralRamp } from './ramp'
import { FOREGROUND_TARGET, INK_TARGETS, LINE_TARGETS, TONE_TARGETS, type LineStep } from './targets'

/* ==========================================================================
   1. 基础工具
   ========================================================================== */

const shortestArc = (from: number, to: number): number => ((to - from + 540) % 360) - 180

/** 主题色参与：按与主题色相的角度占比分配识别预算，不做 clamp。 */
function pullHue(anchor: number, themeHue: number | null, pull: number, budget: number): number {
  if (themeHue == null) return anchor
  const arc = shortestArc(anchor, themeHue)
  return (anchor + (arc / 180) * budget * pull + 360) % 360
}

function toneColor(tone: number, hue: number, chromaRatio: number): string {
  const max = chromaMax(tone, hue)
  return fromOklch(tone, Math.min(chromaRatio * max, max), hue)
}

/** 浅底上按对比目标反解一个色（保持色相 / 饱和度）。 */
function textOn(base: string, background: string, need: number): string {
  if (contrast(base, background) >= need) return base
  const [h, s] = rgbToHsl(parseHex(base))
  return solveLightnessOnLight({ hue: h, saturation: s, background, need })
}

/** 深底上按对比目标反解一个色。 */
function textOnDark(base: string, background: string, need: number): string {
  if (contrast(base, background) >= need) return base
  const [h, s] = rgbToHsl(parseHex(base))
  return solveLightnessOnDark({ hue: h, saturation: s, background, need })
}

const towardBg = (hex: string, ratio: number, side: 'light' | 'dark') =>
  side === 'light' ? mixWhite(hex, ratio) : mixBlack(hex, ratio)

const awayFromBg = (hex: string, ratio: number, side: 'light' | 'dark') =>
  side === 'light' ? mixBlack(hex, ratio) : mixWhite(hex, ratio)

/** 在基色与白之间取一档，使它对给定软的对比度尽量接近目标（描边 1.38）。 */
function mixForContrast(base: string, background: string, target: number): string {
  let best = base
  let bestDiff = Infinity
  for (let i = 0; i <= 50; i++) {
    const hex = mixWhite(base, i / 50)
    const diff = Math.abs(contrast(hex, background) - target)
    if (diff < bestDiff) {
      best = hex
      bestDiff = diff
    }
  }
  return best
}

/** 反解填充 tone：浅字从白往暗扫，深字反之；给了锚点时取可行域内离锚点最近的值。 */
function solveFillTone({
  hue,
  chromaRatio,
  onSide,
  onColor,
  target,
  preferredTone = null,
}: {
  hue: number
  chromaRatio: number
  onSide: 'light' | 'dark'
  onColor: string
  target: number
  preferredTone?: number | null
}): { tone: number; hex: string } | null {
  const light = onSide === 'light'
  const dir = light ? -1 : 1
  const start = light ? 100 : 0
  let limit: number | null = null
  for (let i = 0; i <= 200; i++) {
    const tone = start + dir * i * 0.5
    const hex = toneColor(tone, hue, chromaRatio)
    if (contrast(onColor, hex) >= target) {
      limit = tone
      break
    }
  }
  if (limit == null) return null
  if (preferredTone == null) return { tone: limit, hex: toneColor(limit, hue, chromaRatio) }
  const tone = light ? Math.min(preferredTone, limit) : Math.max(preferredTone, limit)
  return { tone, hex: toneColor(tone, hue, chromaRatio) }
}

/* ==========================================================================
   2. 色族
   ========================================================================== */

const FAMILY_RECIPE = {
  soft: 0.92,
  softOnDark: 0.72,
  softHover: 0.9,
  softActive: 0.87,
  softHoverOnDarkWhite: 0.08,
  softActiveOnDarkWhite: 0.14,
  disabledWhite: 0.55,
  textWeak: 0.25,
  textStrong: 0.2,
  borderWeak: 0.35,
  borderStrong: 0.2,
  inkHoverBlack: 0.06,
  inkActiveBlack: 0.1,
}

export interface FamilyMode {
  side: 'light' | 'dark'
  base: string
  soft: string
  border: string
  text: string
  softHover: string
  softActive: string
  hover: string
  active: string
  disabled: string
  foreground: string
  textWeak: string
  textStrong: string
  borderWeak: string
  borderStrong: string
  strong: string
  tone: number | null
}

export interface Family {
  name: string
  light: FamilyMode
  dark: FamilyMode
  meta: { hue: number; chromaRatio: number }
}

/** 弱档：在 soft 底上求仍满足目标的最接近底色的值。 */
function weakTone(base: string, background: string, mode: 'light' | 'dark', need: number): string {
  const [hue, saturation] = rgbToHsl(parseHex(base))
  return mode === 'light'
    ? solveLightnessOnLight({ hue, saturation, background, need })
    : solveLightnessOnDark({ hue, saturation, background, need })
}

/** 强档：从当前文字色继续远离底色，直到满足目标。 */
function strongTone(base: string, background: string, mode: 'light' | 'dark', need: number): string {
  let hex = base
  for (let i = 0; i < 50; i++) {
    if (contrast(hex, background) >= need) return hex
    hex = mode === 'light' ? mixBlack(hex, 0.02) : mixWhite(hex, 0.02)
  }
  return hex
}

/** 从基色派生软底三件套与交互态；模式决定底与反解方向。 */
function familyParts(base: string, mode: 'light' | 'dark') {
  const R = FAMILY_RECIPE
  if (mode === 'light') {
    const soft = mixWhite(base, R.soft)
    const border = mixForContrast(base, soft, TONE_TARGETS.border)
    const text = textOn(base, soft, TONE_TARGETS.text)
    return {
      soft,
      border,
      text,
      softHover: mixWhite(base, R.softHover),
      softActive: mixWhite(base, R.softActive),
      textWeak: weakTone(text, soft, 'light', 5.0),
      textStrong: strongTone(text, soft, 'light', 7.2),
      borderWeak: towardBg(border, R.borderWeak, 'light'),
      borderStrong: awayFromBg(border, R.borderStrong, 'light'),
    }
  }
  const soft = mixBlack(base, R.softOnDark)
  const border = mixForContrast(soft, soft, TONE_TARGETS.border)
  const text = textOnDark(base, soft, TONE_TARGETS.text)
  return {
    soft,
    border,
    text,
    softHover: mixWhite(soft, R.softHoverOnDarkWhite),
    softActive: mixWhite(soft, R.softActiveOnDarkWhite),
    textWeak: weakTone(text, soft, 'dark', 5.0),
    textStrong: strongTone(text, soft, 'dark', 7.2),
    borderWeak: towardBg(border, R.borderWeak, 'dark'),
    borderStrong: awayFromBg(border, R.borderStrong, 'dark'),
  }
}

function deriveFamilyMode({
  mode,
  hue,
  chromaRatio,
  preferredTone,
  side,
  onColor,
  target,
  stateSteps,
}: {
  mode: 'light' | 'dark'
  hue: number
  chromaRatio: number
  preferredTone: number | null
  side: 'light' | 'dark'
  onColor: string
  target: number
  stateSteps: number[]
}): { mode: FamilyMode; solved: boolean } {
  const solved = solveFillTone({ hue, chromaRatio, onSide: side, onColor, target, preferredTone })
  const fallbackTone = side === 'light' ? 0 : 100
  const tone = solved?.tone ?? fallbackTone
  const base = solved?.hex ?? toneColor(tone, hue, chromaRatio)
  const parts = familyParts(base, mode)
  const dir = side === 'light' ? -1 : 1
  const at = (t: number) => toneColor(clamp(t, 0, 100), hue, chromaRatio)
  const R = FAMILY_RECIPE
  return {
    solved: !!solved,
    mode: {
      side,
      base,
      ...parts,
      hover: at(tone + dir * stateSteps[0]),
      active: at(tone + dir * stateSteps[1]),
      disabled: mode === 'light' ? mixWhite(base, R.disabledWhite) : mixBlack(base, 0.4),
      foreground: onColor,
      strong: base,
      tone,
    },
  }
}

function deriveAccentFamily({
  name,
  seedColor,
  chromaRatio,
  themeHue = null,
  pull = 1,
  identityBudget = 2,
  onSide,
  onColors,
  target = FOREGROUND_TARGET,
  stateSteps = [3, 6],
  chromaFloor = 0,
  preferredTone = null,
}: {
  name: string
  seedColor: string
  chromaRatio: number | null
  themeHue?: number | null
  pull?: number
  identityBudget?: number
  onSide: { light: 'light' | 'dark'; dark: 'light' | 'dark' }
  onColors: { light: string; dark: string }
  target?: number
  stateSteps?: number[]
  chromaFloor?: number
  preferredTone?: number | null
}): { family: Family; solved: { light: boolean; dark: boolean } } {
  const anchor = toOklch(seedColor)
  const hue = pullHue(anchor.hue, themeHue, pull, identityBudget)
  const anchorMax = Math.max(chromaMax(anchor.tone, anchor.hue), 1e-6)
  const baseChroma = chromaRatio == null ? anchor.chroma : chromaRatio * anchorMax
  const ratio = clamp(Math.max(baseChroma, chromaFloor) / anchorMax, 0, 1)
  const common = { hue, chromaRatio: ratio, preferredTone, target, stateSteps }
  const light = deriveFamilyMode({
    ...common,
    mode: 'light',
    side: onSide.light,
    onColor: onColors[onSide.light],
  })
  const dark = deriveFamilyMode({
    ...common,
    mode: 'dark',
    side: onSide.dark,
    onColor: onColors[onSide.dark],
  })
  return {
    family: { name, light: light.mode, dark: dark.mode, meta: { hue, chromaRatio: ratio } },
    solved: { light: light.solved, dark: dark.solved },
  }
}

/** 墨色主色族：主色取灰阶最深 / 最浅档，与中性面同源。 */
function inkFamily({
  neutralLight,
  neutralDark,
  onSide,
  onColors,
}: {
  neutralLight: NeutralRamp
  neutralDark: NeutralRamp
  onSide: { light: 'light' | 'dark'; dark: 'light' | 'dark' }
  onColors: { light: string; dark: string }
}): Family {
  const R = FAMILY_RECIPE
  const make = (mode: 'light' | 'dark', base: string): FamilyMode => {
    const side = onSide[mode]
    const foreground = onColors[side]
    const parts = familyParts(base, mode)
    return {
      side,
      base,
      ...parts,
      hover: mode === 'light' ? mixBlack(base, R.inkHoverBlack) : mixWhite(base, R.inkHoverBlack),
      active: mode === 'light' ? mixBlack(base, R.inkActiveBlack) : mixWhite(base, R.inkActiveBlack),
      disabled: mode === 'light' ? mixWhite(base, R.disabledWhite) : mixBlack(base, 0.4),
      foreground,
      strong: base,
      tone: null,
    }
  }
  return {
    name: 'primary',
    light: make('light', neutralLight[900]),
    dark: make('dark', neutralDark[100]),
    meta: { hue: 0, chromaRatio: 0 },
  }
}

/* ==========================================================================
   3. 矩阵与报告
   ========================================================================== */

export type ReportLevel = 'pass' | 'warn' | 'deviation' | 'unverified'

/** 对比度分级；`unverified` 留给未知底，不在 core 的声明面上产生。 */
export function classifyContrast(ratio: number, target: number, floor: number): ReportLevel {
  return ratio >= target ? 'pass' : ratio >= floor ? 'warn' : 'deviation'
}

export interface ColorReportRow {
  id: string
  pair: string
  token: string
  against: string
  ratio: number
  need: number
  target: number
  floor: number
  level: ReportLevel
  mode: 'light' | 'dark' | 'both'
  reason?: string
  apca?: number
  tolerance?: number
}

export interface SurfaceValues {
  canvas: ModeValue<ColorValue>
  raised: ModeValue<ColorValue>
  overlay: ModeValue<ColorValue>
  inset: ModeValue<ColorValue>
  block: {
    weak: ModeValue<ColorValue>
    base: ModeValue<ColorValue>
    strong: ModeValue<ColorValue>
  }
}

export interface ColorResult {
  tree: {
    surface: SurfaceValues
    ink: Record<'primary' | 'secondary' | 'tertiary' | 'disabled', ModeValue<ColorValue>>
    line: Record<LineStep, ModeValue<ColorValue>>
    tone: Record<string, Record<string, unknown>>
    state: Record<'hover' | 'pressed' | 'disabled' | 'selected', ModeValue<ColorValue>>
    scrim: ColorValue
    brand: Record<string, ColorValue>
  }
  families: Record<string, Family>
  neutral: NeutralRamp
  neutralDark: NeutralRamp
  canvas: { light: string; dark: string }
  controlBg: { light: string; dark: string }
  shadowInk: { hex: string; tone: number; chroma: number; hue: number }
  onSide: { light: 'light' | 'dark'; dark: 'light' | 'dark' }
  report: ColorReportRow[]
}

const rgbaValue = (hex: string, alpha: number): ColorValue => color(hex, alpha)

function toneMatrix(family: Family) {
  const pair = (light: string, dark: string): ModeValue<ColorValue> => mode(color(light), color(dark))
  const l = family.light
  const d = family.dark
  const strong = (m: FamilyMode) => (m.side === 'light' ? '#FFFFFF' : '#000000')

  const solidFill = {
    rest: pair(l.base, d.base),
    hover: pair(l.hover, d.hover),
    focus: pair(l.base, d.base),
    pressed: pair(l.active, d.active),
    selected: pair(l.base, d.base),
    disabled: pair(l.disabled, d.disabled),
    dragged: pair(l.active, d.active),
    'drop-target': pair(l.base, d.base),
  }
  const softFill = {
    rest: pair(l.soft, d.soft),
    hover: pair(l.softHover, d.softHover),
    focus: pair(l.soft, d.soft),
    pressed: pair(l.softActive, d.softActive),
    selected: pair(l.soft, d.soft),
    disabled: pair(mixWhite(l.base, 0.55), mixBlack(d.soft, 0.4)),
    dragged: pair(l.softActive, d.softActive),
    'drop-target': pair(l.softHover, d.softHover),
  }

  const inkSolid = {
    weak: pair(mix(l.foreground, l.base, 0.25), mix(d.foreground, d.base, 0.25)),
    base: pair(l.foreground, d.foreground),
    strong: pair(strong(l), strong(d)),
  }
  const inkSoft = {
    weak: pair(l.textWeak, d.textWeak),
    base: pair(l.text, d.text),
    strong: pair(l.textStrong, d.textStrong),
  }
  const inkBare = { ...inkSoft }
  const lineSolid = {
    weak: pair(mix(l.foreground, l.base, 0.25), mix(d.foreground, d.base, 0.25)),
    base: pair(l.foreground, d.foreground),
    strong: pair(strong(l), strong(d)),
  }
  const lineSoft = {
    weak: pair(l.borderWeak, d.borderWeak),
    base: pair(l.border, d.border),
    strong: pair(l.borderStrong, d.borderStrong),
  }
  const lineBare = { ...lineSoft, strong: pair(l.strong, d.strong) }

  return {
    solid: { fill: solidFill, ink: inkSolid, line: lineSolid, foreground: pair(l.foreground, d.foreground) },
    soft: { fill: softFill, ink: inkSoft, line: lineSoft },
    bare: { ink: inkBare, line: lineBare },
  }
}

/** 主入口。 */
export function deriveColor(seed: ColorSeed): ColorResult {
  const surfaceSeed = seed.surface
  if (typeof seed.onSide !== 'object' || !seed.onSide.light || !seed.onSide.dark) {
    throw new Error('color.onSide 必须是 { light, dark }；0.4.0 起不再接受字符串 / auto')
  }

  const primaryHsl = hslToRgb(seed.primaryHue, 1, seed.lightness)
  const primaryOklch = seed.chromaRatio > 0 ? toOklch(primaryHsl) : null
  const primarySeed = primaryOklch ? toneColor(primaryOklch.tone, primaryOklch.hue, seed.chromaRatio) : null

  /* 中性灰：两端对称 + 档差梯度。 */
  let ramps = neutralRamps(seed.neutral, {
    primaryHue: primaryOklch?.hue ?? null,
    themeChroma: primaryOklch?.chroma ?? 0,
  })
  if (surfaceSeed.canvasSymmetry != null) {
    if (
      (typeof surfaceSeed.canvasLight === 'string' && !surfaceSeed.canvasLight.startsWith('neutral.')) ||
      (typeof surfaceSeed.canvasDark === 'string' && !surfaceSeed.canvasDark.startsWith('neutral.'))
    ) {
      throw new Error('surface.canvasSymmetry 只能配 `neutral.*` 画布引用；显式 hex 请直接写两端值')
    }
    const { toneCurve } = symmetricCanvasCurve(
      ramps.config.toneCurve,
      surfaceSeed.canvasSymmetry,
      ramps.config.light,
      ramps.config.dark,
    )
    ramps = neutralRamps(
      { ...seed.neutral, toneCurve },
      { primaryHue: primaryOklch?.hue ?? null, themeChroma: primaryOklch?.chroma ?? 0 },
    )
  }
  if (seed.neutral.stepRatio && seed.neutral.stepRatio !== 'functional') {
    const toneCurve = ladderCurve(ramps.config, seed.neutral.stepRatio)
    ramps = neutralRamps(
      { ...seed.neutral, toneCurve },
      { primaryHue: primaryOklch?.hue ?? null, themeChroma: primaryOklch?.chroma ?? 0 },
    )
  }

  const resolveCanvas = (value: string, fallback: number, ramp: NeutralRamp, label: string): string => {
    if (typeof value === 'string' && value.startsWith('neutral.')) {
      const step = Number(value.slice('neutral.'.length))
      if (ramp[step] == null) throw new Error(`档位缺口：${label} 引用了不存在的 neutral.${step}`)
      return ramp[step]
    }
    return value ?? ramp[fallback]
  }
  const canvasLight = resolveCanvas(surfaceSeed.canvasLight, CANVAS_STEPS.light, ramps.light, 'surface.canvasLight')
  const canvasDark = resolveCanvas(surfaceSeed.canvasDark, CANVAS_STEPS.dark, ramps.dark, 'surface.canvasDark')

  const onSide = seed.onSide
  const accentOptions = {
    onSide,
    onColors: seed.onColors,
    target: seed.solidTarget,
    pull: seed.accent.pull,
    identityBudget: seed.accent.identityBudget,
    stateSteps: seed.accent.stateSteps,
    chromaFloor: seed.accent.chromaFloor,
  }

  const familyWarnings: Array<{ name: string; mode: 'light' | 'dark'; reason: string }> = []
  const collect = (name: string, result: { family: Family; solved: { light: boolean; dark: boolean } }): Family => {
    if (!result.solved.light) familyWarnings.push({ name, mode: 'light', reason: '填充目标不可达' })
    if (!result.solved.dark) familyWarnings.push({ name, mode: 'dark', reason: '填充目标不可达' })
    return result.family
  }

  const primary =
    seed.chromaRatio > 0
      ? collect(
          'primary',
          deriveAccentFamily({
            name: 'primary',
            seedColor: primarySeed!,
            chromaRatio: seed.chromaRatio,
            preferredTone: primaryOklch?.tone ?? null,
            ...accentOptions,
          }),
        )
      : inkFamily({
          neutralLight: ramps.light,
          neutralDark: ramps.dark,
          onSide,
          onColors: seed.onColors,
        })

  const themeHue = primaryOklch?.hue ?? null
  const families: Record<string, Family> = { primary }
  for (const [name, semantic] of Object.entries(seed.semantics)) {
    const hue = typeof semantic === 'number' ? semantic : semantic.hue
    /* seed 里的色相按 CSS / HSL 理解（0 = 红），进 OKLCH 前先转换。 */
    const hueOklch = toOklch(hslToRgb(hue, 1, 0.5)).hue
    const chromaRatio = 0.9
    const seedColor = toneColor(60, hueOklch, chromaRatio)
    families[name] = collect(
      name,
      deriveAccentFamily({
        name,
        seedColor,
        chromaRatio,
        themeHue,
        preferredTone: 60,
        ...accentOptions,
      }),
    )
  }

  /* 表面 tint 与面阶：抬升变亮、下沉变暗，两模式各自反解 alpha。 */
  const primaryBase = families.primary.light.base
  const primaryDarkBase = families.primary.dark.base
  const tintLight = surfaceSeed.themeMix > 0 ? mixWhite(primaryBase, 1 - surfaceSeed.themeMix) : surfaceSeed.tintLight
  const tintDark = surfaceSeed.themeMix > 0 ? mixBlack(primaryDarkBase, 1 - surfaceSeed.themeMix) : surfaceSeed.tintDark
  const alphaLight = { ...surfaceSeed.alpha.light }
  const alphaDark = { ...surfaceSeed.alpha.dark }
  if (surfaceSeed.faceContrast) {
    const target = surfaceSeed.faceContrast
    if (target.card != null) {
      alphaLight.card = solveCoverage(tintLight, canvasLight, target.card)
      alphaDark.card = solveCoverage(tintDark, canvasDark, target.card)
    }
    if (target.overlay != null) {
      alphaLight.overlay = solveCoverage(tintLight, canvasLight, target.overlay)
      alphaDark.overlay = solveCoverage(tintDark, canvasDark, target.overlay)
    }
    if (target.sunken != null) {
      alphaLight.sunken = solveCoverage('#000000', canvasLight, target.sunken)
      alphaDark.sunken = solveCoverage('#000000', canvasDark, target.sunken)
    }
  }
  const controlBgLight = composite(tintLight, alphaLight.card, canvasLight)
  const controlBgDark = composite(tintDark, alphaDark.card, canvasDark)

  /* 强档：对控件面 3:1；浅深各一次。 */
  for (const family of Object.values(families)) {
    family.light.strong = solveToneAgainst(family.light.base, controlBgLight, CONTRAST.graphic)
    family.dark.strong = solveToneAgainst(family.dark.base, controlBgDark, CONTRAST.graphic)
  }

  const surface: SurfaceValues = {
    canvas: mode(color(canvasLight), color(canvasDark)),
    raised: mode(rgbaValue(tintLight, alphaLight.card), rgbaValue(tintDark, alphaDark.card)),
    overlay: mode(rgbaValue(tintLight, alphaLight.overlay), rgbaValue(tintDark, alphaDark.overlay)),
    inset: mode(rgbaValue('#000000', alphaLight.sunken), rgbaValue('#000000', alphaDark.sunken)),
    block: {
      weak: mode(
        rgbaValue('#000000', surfaceSeed.alpha.light.blockLight),
        rgbaValue('#000000', surfaceSeed.alpha.dark.blockLight),
      ),
      base: mode(
        rgbaValue('#000000', surfaceSeed.alpha.light.block),
        rgbaValue('#000000', surfaceSeed.alpha.dark.block),
      ),
      strong: mode(
        rgbaValue('#000000', surfaceSeed.alpha.light.blockStrong),
        rgbaValue('#000000', surfaceSeed.alpha.dark.blockStrong),
      ),
    },
  }

  /* 墨：主档固定 0.65（对白 7:1）；其余档次按声明底反解，跌破时只微调该档 alpha。 */
  const inkHex = { light: '#000000', dark: '#FFFFFF' }
  const faces = {
    light: [
      canvasLight,
      controlBgLight,
      composite(tintLight, alphaLight.overlay, canvasLight),
      composite('#000000', alphaLight.sunken, canvasLight),
    ],
    dark: [
      canvasDark,
      controlBgDark,
      composite(tintDark, alphaDark.overlay, canvasDark),
      composite('#000000', alphaDark.sunken, canvasDark),
    ],
  }
  const inkNeed = INK_TARGETS
  const inkAlpha = { light: {} as Record<string, number>, dark: {} as Record<string, number> }
  for (const level of ['primary', 'secondary', 'tertiary', 'disabled'] as const) {
    const base = { primary: 0.65, secondary: 0.55, tertiary: 0.45, disabled: 0.35 }[level]
    inkAlpha.light[level] = Math.max(base, ...faces.light.map((face) => solveAlpha(inkHex.light, face, inkNeed[level])))
    inkAlpha.dark[level] = Math.max(base, ...faces.dark.map((face) => solveAlpha(inkHex.dark, face, inkNeed[level])))
  }
  const ink = {
    primary: mode(rgbaValue(inkHex.light, inkAlpha.light.primary), rgbaValue(inkHex.dark, inkAlpha.dark.primary)),
    secondary: mode(rgbaValue(inkHex.light, inkAlpha.light.secondary), rgbaValue(inkHex.dark, inkAlpha.dark.secondary)),
    tertiary: mode(rgbaValue(inkHex.light, inkAlpha.light.tertiary), rgbaValue(inkHex.dark, inkAlpha.dark.tertiary)),
    disabled: mode(rgbaValue(inkHex.light, inkAlpha.light.disabled), rgbaValue(inkHex.dark, inkAlpha.dark.disabled)),
  }

  /* 线：墨量叠当前面；目标是设计值，alpha 是结果。 */
  const lineAlpha = {
    light: {
      1: solveCoverage('#000000', canvasLight, LINE_TARGETS[1]),
      2: solveCoverage('#000000', canvasLight, LINE_TARGETS[2]),
      3: solveCoverage('#000000', canvasLight, LINE_TARGETS[3]),
    },
    dark: {
      1: solveCoverage('#FFFFFF', canvasDark, LINE_TARGETS[1]),
      2: solveCoverage('#FFFFFF', canvasDark, LINE_TARGETS[2]),
      3: solveCoverage('#FFFFFF', canvasDark, LINE_TARGETS[3]),
    },
  }
  const line = {
    1: mode(rgbaValue('#000000', lineAlpha.light[1]), rgbaValue('#FFFFFF', lineAlpha.dark[1])),
    2: mode(rgbaValue('#000000', lineAlpha.light[2]), rgbaValue('#FFFFFF', lineAlpha.dark[2])),
    3: mode(rgbaValue('#000000', lineAlpha.light[3]), rgbaValue('#FFFFFF', lineAlpha.dark[3])),
  } as Record<LineStep, ModeValue<ColorValue>>

  /* 状态：中性叠墨随模式翻转；selected 混主色。 */
  const state = {
    hover: mode(rgbaValue(inkHex.light, 0.08), rgbaValue(inkHex.dark, 0.08)),
    pressed: mode(rgbaValue(inkHex.light, 0.12), rgbaValue(inkHex.dark, 0.12)),
    disabled: mode(rgbaValue(inkHex.light, 0.04), rgbaValue(inkHex.dark, 0.04)),
    selected: mode(color(primaryBase, 0.08), color(primaryDarkBase, 0.08)),
  }

  /* 阴影墨：暗于两端画布；带中性色温，彩度上限 0.02。 */
  const mid = ramps.light[500]
  const midOklch = toOklch(mid)
  const lightTone = toOklch(canvasLight).tone
  const darkTone = toOklch(canvasDark).tone
  const shadowTone = Math.max(0, Math.min(22, lightTone - 12, darkTone - 6))
  const shadowInk = {
    tone: +shadowTone.toFixed(1),
    chroma: +Math.min(midOklch.chroma, 0.02).toFixed(4),
    hue: +midOklch.hue.toFixed(1),
    hex: fromOklch(shadowTone, Math.min(midOklch.chroma, 0.02), midOklch.hue),
  }

  /* 报告：只证明被登记的配对；颜色项不阻断。 */
  const report: ColorReportRow[] = []
  const enabled = new Set(seed.modes.length ? seed.modes : ['light', 'dark'])
  const push = (row: {
    id: string
    token: string
    against: string
    ratio: number
    target: number
    floor: number
    mode: 'light' | 'dark' | 'both'
    tolerance?: number
    reason?: string
  }) => {
    const level =
      row.tolerance != null
        ? Math.abs(row.ratio - row.target) <= row.tolerance
          ? 'pass'
          : row.ratio >= row.floor
            ? 'warn'
            : 'deviation'
        : classifyContrast(row.ratio, row.target, row.floor)
    report.push({
      ...row,
      need: row.floor,
      pair: `${row.token} @ ${row.against}`,
      level,
    })
  }

  for (const mode of ['light', 'dark'] as const) {
    if (!enabled.has(mode)) continue
    const canvas = mode === 'light' ? canvasLight : canvasDark
    const surfaces: Array<[string, string]> = [
      [
        'surface.raised',
        composite(mode === 'light' ? tintLight : tintDark, (mode === 'light' ? alphaLight : alphaDark).card, canvas),
      ],
      [
        'surface.overlay',
        composite(mode === 'light' ? tintLight : tintDark, (mode === 'light' ? alphaLight : alphaDark).overlay, canvas),
      ],
      ['surface.inset', composite('#000000', (mode === 'light' ? alphaLight : alphaDark).sunken, canvas)],
    ]
    for (const [name, hex] of surfaces) {
      const target = name.endsWith('raised') ? TONE_TARGETS.soft : name.endsWith('overlay') ? 1.14 : 1.07
      push({
        id: 'surface-target',
        token: name,
        against: 'surface.canvas',
        ratio: +contrast(hex, canvas).toFixed(2),
        target,
        floor: target - 0.03,
        tolerance: 0.03,
        mode,
      })
    }

    for (const step of [1, 2, 3] as const) {
      const alpha = (mode === 'light' ? lineAlpha.light : lineAlpha.dark)[step]
      const hex = mode === 'light' ? '#000000' : '#FFFFFF'
      push({
        id: 'line-target',
        token: `line.${step}`,
        against: 'surface.canvas',
        ratio: +contrast(composite(hex, alpha, canvas), canvas).toFixed(2),
        target: LINE_TARGETS[step],
        floor: LINE_TARGETS[step] - 0.12,
        tolerance: 0.12,
        mode,
      })
    }

    const inkFaces: Array<[string, string]> = [['surface.canvas', canvas], ...surfaces]
    for (const level of ['primary', 'secondary', 'tertiary', 'disabled'] as const) {
      const alpha = (mode === 'light' ? inkAlpha.light : inkAlpha.dark)[level]
      const hex = mode === 'light' ? inkHex.light : inkHex.dark
      const target = INK_TARGETS[level]
      const floor = level === 'disabled' ? 2.0 : CONTRAST.text
      for (const [name, bg] of inkFaces) {
        push({
          id: 'ink-contrast',
          token: `ink.${level}`,
          against: name,
          ratio: +contrast(composite(hex, alpha, bg), bg).toFixed(2),
          target,
          floor,
          mode,
        })
      }
    }
  }

  for (const [name, family] of Object.entries(families)) {
    for (const mode of ['light', 'dark'] as const) {
      if (!enabled.has(mode)) continue
      const f = family[mode]
      const soft = `tone.${name}.soft.fill.rest`
      const softText = contrast(f.text, f.soft)
      push({
        id: 'tone-text',
        token: `tone.${name}.soft.ink.base`,
        against: soft,
        ratio: +softText.toFixed(2),
        target: TONE_TARGETS.text,
        floor: CONTRAST.text,
        mode,
      })
      push({
        id: 'tone-text-weak',
        token: `tone.${name}.soft.ink.weak`,
        against: soft,
        ratio: +contrast(f.textWeak, f.soft).toFixed(2),
        target: 5.0,
        floor: CONTRAST.text,
        mode,
      })
      push({
        id: 'tone-text-strong',
        token: `tone.${name}.soft.ink.strong`,
        against: soft,
        ratio: +contrast(f.textStrong, f.soft).toFixed(2),
        target: 7.2,
        floor: CONTRAST.text,
        mode,
      })
      push({
        id: 'tone-foreground',
        token: `tone.${name}.solid.foreground`,
        against: `tone.${name}.solid.fill.rest`,
        ratio: +contrast(f.foreground, f.base).toFixed(2),
        target: FOREGROUND_TARGET,
        floor: FOREGROUND_TARGET,
        mode,
      })

      const borderNeed = TONE_TARGETS.border
      push({
        id: 'tone-border',
        token: `tone.${name}.soft.line.base`,
        against: soft,
        ratio: +contrast(f.border, f.soft).toFixed(2),
        target: borderNeed,
        floor: borderNeed - 0.08,
        tolerance: 0.08,
        mode,
      })
      push({
        id: 'tone-strong',
        token: `tone.${name}.bare.line.strong`,
        against: 'surface.raised',
        ratio: +contrast(f.strong, mode === 'light' ? controlBgLight : controlBgDark).toFixed(2),
        target: CONTRAST.graphic,
        floor: CONTRAST.graphic,
        mode,
      })
    }
  }

  if (primaryOklch && seed.chromaRatio > 0) {
    for (const family of Object.values(families)) {
      if (family.name === 'primary') continue
      const separation = Math.abs(((family.meta.hue - primaryOklch.hue + 540) % 360) - 180)
      report.push({
        id: 'hue-separation',
        pair: `${family.name}.hue @ primary.hue`,
        token: `${family.name}.hue`,
        against: 'primary.hue',
        ratio: +separation.toFixed(1),
        need: seed.accent.hueSeparation,
        target: seed.accent.hueSeparation,
        floor: 0,
        level: separation < seed.accent.hueSeparation ? 'warn' : 'pass',
        mode: 'both',
        reason: separation < seed.accent.hueSeparation ? '主色与语义色色相过近' : undefined,
      })
    }
  }

  for (const warning of familyWarnings) {
    report.push({
      id: 'tone-fill-unreachable',
      pair: `tone.${warning.name}.solid.fill.rest @ foreground`,
      token: `tone.${warning.name}.solid.fill.rest`,
      against: 'foreground',
      ratio: 0,
      need: seed.solidTarget,
      target: seed.solidTarget,
      floor: seed.solidTarget,
      level: 'deviation',
      mode: warning.mode,
      reason: warning.reason,
    })
  }

  for (const mode of ['light', 'dark'] as const) {
    if (!enabled.has(mode)) continue
    const hex = seed.onColors[mode === 'light' ? seed.onSide.light : seed.onSide.dark]
    const tone = toOklch(hex).tone
    const delta = mode === 'light' ? 100 - tone : tone
    report.push({
      id: 'foreground-endpoint',
      pair: `foreground.endpoint(${mode}) @ pole`,
      token: 'foreground.endpoint',
      against: 'pole',
      ratio: +delta.toFixed(2),
      need: 3,
      target: 3,
      floor: 0,
      level: delta <= 3 ? 'pass' : 'warn',
      mode,
      reason: delta <= 3 ? undefined : '端点离极超过 Δ 3',
    })
  }

  for (const allow of seed.contrastAllow) {
    for (const row of report) {
      if (row.pair === allow.pair && row.level === 'deviation' && row.ratio >= allow.min) {
        row.level = 'warn'
      }
    }
  }

  return {
    tree: {
      surface,
      ink,
      line,
      tone: Object.fromEntries(Object.entries(families).map(([name, family]) => [name, toneMatrix(family)])),
      state,
      scrim: rgbaValue('#000000', surfaceSeed.scrimAlpha),
      brand: {},
    },
    families,
    neutral: ramps.light,
    neutralDark: ramps.dark,
    canvas: { light: canvasLight, dark: canvasDark },
    controlBg: { light: controlBgLight, dark: controlBgDark },
    shadowInk,
    onSide,
    report,
  }
}
