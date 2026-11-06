/**
 * light.ts — 光影：shadow / occlusion / highlight / shade
 * ---------------------------------------------------------------------------
 * 一束方向光：
 *   · shadow = 接触层 + 过渡层 + 环境层（4 档，三槽位）；
 *   · occlusion = 居中四边的环境光遮蔽（Frame / Overlay 容器用）；
 *   · highlight.ambient = 环境高光环（方向边线的环境底）；
 *   · highlight.key / shade.key = 内层受光 / 遮光，由同一光源方向推出。
 *
 * 方向在生成时烘焙成静态值：产物里没有运行时角度 / 距离变量。
 * 静态 tokens 只表达默认形态 `convex`；`flat` / `concave` 走 `solve`。
 */

import type { LightSeed } from '../seed'
import { color, mode, shadow, token, type ColorValue, type Group, type ShadowLayerValue } from '../tree'

/** 已解析到 sRGB 的光色：主光染 key 高光，环境色染 ambient 高光与阴影墨。 */
export interface LightColors {
  key: string
  ambient: string
}

export type LightForm = 'flat' | 'convex' | 'concave'
export type LightDepth = 1 | 2 | 3 | 4

export interface LightSolveInput {
  /** 默认 `convex`；静态 tokens 只表达这一档。 */
  form?: LightForm
  /** 默认 2。 */
  depth?: LightDepth
  /** 默认 `light`。 */
  mode?: 'light' | 'dark'
}

export interface LightSolveResult {
  highlight: { key: ShadowLayerValue[]; ambient: ShadowLayerValue[] }
  shade: { key: ShadowLayerValue[] }
  shadow: ShadowLayerValue[]
  occlusion: ShadowLayerValue[]
}

export interface LightResult {
  tree: {
    shadow: Group
    occlusion: Group
    highlight: Group
    shade: Group
  }
  /** 阴影墨（与颜色族共用一枚，不按层分色）。 */
  ink: { hex: string; tone: number; chroma: number; hue: number }
  layers: Record<number, ShadowLayerValue[]>
  occlusionLayers: Record<number, ShadowLayerValue[]>
  /** 形态 / 深度 / 模式 → 五槽值；无参 = 默认 seed + convex + depth 2 + light。 */
  solve: (input?: LightSolveInput) => LightSolveResult
}

const px = (value: number) => ({ value: +value.toFixed(2), unit: 'px' as const })

/** 四档：由端点 8 / 64 推出 log2(64/8)+1。 */
const LEVELS = [1, 2, 3, 4] as const

type Edge = 'top' | 'right' | 'bottom' | 'left'
const EDGES: Edge[] = ['top', 'right', 'bottom', 'left']

/** 方位角 0° = 正上，顺时针；返回四条边的余弦权重。 */
function edgeWeights(azimuthAngle: number): Record<Edge, number> {
  const rad = (azimuthAngle * Math.PI) / 180
  return {
    top: Math.cos(rad),
    right: Math.sin(rad),
    bottom: -Math.cos(rad),
    left: -Math.sin(rad),
  }
}

/** 内嵌 1px 边的偏移：正值把内阴影推向该边。 */
function edgeOffset(edge: Edge): { x: number; y: number } {
  switch (edge) {
    case 'top':
      return { x: 0, y: 1 }
    case 'right':
      return { x: -1, y: 0 }
    case 'bottom':
      return { x: 0, y: -1 }
    case 'left':
      return { x: 1, y: 0 }
  }
}

function directionVector(offset: number, seed: LightSeed) {
  const azimuth = (seed.azimuthAngle * Math.PI) / 180
  const altitude = Math.min(89, Math.max(1, seed.altitudeAngle))
  /* 默认 60° 时系数为 1；仰角越低影越长。 */
  const factor = Math.tan((60 * Math.PI) / 180) / Math.tan((altitude * Math.PI) / 180)
  return {
    x: -offset * Math.sin(azimuth) * factor,
    y: offset * Math.cos(azimuth) * factor,
  }
}

export function deriveLight(
  seed: LightSeed,
  ink: { hex: string; tone: number; chroma: number; hue: number },
  colors: LightColors,
): LightResult {
  const unit = seed.inkUnit / 100
  const halo = (n: number) => seed.blurBase * seed.blurRatio ** (n - 1)
  const layer = (
    offset: number,
    blur: number,
    alpha: number,
    inset = false,
    fill: ColorValue = color(ink.hex, alpha),
  ): ShadowLayerValue => {
    const v = directionVector(offset, seed)
    return {
      color: fill,
      offsetX: px(v.x),
      offsetY: px(v.y),
      blur: px(blur),
      spread: px(0),
      inset,
    }
  }

  const layers: Record<number, ShadowLayerValue[]> = {}
  for (const n of LEVELS) {
    const contact = layer(1, seed.blurBase / 4, unit)
    const inner = n >= 2 ? layer(halo(n - 1) / 4, halo(n - 1), unit) : null
    const outer = layer(halo(n) / 4, halo(n), Math.max(1, n - 1) * unit)
    layers[n] = inner ? [contact, inner, outer] : [contact, outer]
  }

  const occlusionLayers: Record<number, ShadowLayerValue[]> = {}
  for (const n of LEVELS) occlusionLayers[n] = [layer(0, halo(n), n * unit)]

  const shadowTree: Group = {
    color: token('color', color(ink.hex), '全项目一枚阴影墨；深浅共用'),
    ...Object.fromEntries(LEVELS.map((n) => [String(n), token('shadow', shadow(layers[n]), `level ${n}`)])),
  }

  const occlusionTree: Group = Object.fromEntries(
    LEVELS.map((n) => [
      String(n),
      token('shadow', shadow(occlusionLayers[n]), `blur ${halo(n)} · alpha ${n * seed.inkUnit}%`),
    ]),
  )

  const ambientLayers = (): ShadowLayerValue[] => {
    const value = layer(0, 0, seed.ambientAlpha, false, color(colors.ambient, seed.ambientAlpha))
    value.spread = px(1)
    return [value]
  }

  /** 四边内嵌线：凸起时受光边亮、背光边暗；凹陷反过来；平面为空。 */
  const keyLayers = (side: 'light' | 'dark', form: LightForm, kind: 'highlight' | 'shade'): ShadowLayerValue[] => {
    if (form === 'flat') return []
    const weights = edgeWeights(seed.azimuthAngle)
    const base = seed.key[side][kind]
    const fill = kind === 'highlight' ? colors.key : ink.hex
    const layersOut: ShadowLayerValue[] = []
    for (const edge of EDGES) {
      const weight = weights[edge]
      const lit = weight > 0
      if (Math.abs(weight) < 0.01) continue
      const wantsLit = kind === 'highlight' ? form === 'convex' : form === 'concave'
      if (lit !== wantsLit) continue
      const offset = edgeOffset(edge)
      layersOut.push({
        color: color(fill, base * Math.abs(weight)),
        offsetX: px(offset.x),
        offsetY: px(offset.y),
        blur: px(0),
        spread: px(0),
        inset: true,
      })
    }
    return layersOut
  }

  const solve = (input: LightSolveInput = {}): LightSolveResult => {
    const form = input.form ?? 'convex'
    const depth = input.depth ?? 2
    const side = input.mode ?? 'light'
    const flat = form === 'flat'
    return {
      highlight: {
        key: keyLayers(side, form, 'highlight'),
        ambient: flat ? [] : ambientLayers(),
      },
      shade: { key: keyLayers(side, form, 'shade') },
      shadow: layers[depth],
      occlusion: occlusionLayers[depth],
    }
  }

  return {
    tree: {
      shadow: shadowTree,
      occlusion: occlusionTree,
      highlight: {
        key: token(
          'shadow',
          mode(keyLayers('light', 'convex', 'highlight'), keyLayers('dark', 'convex', 'highlight')),
          '受光边：按方位角投影，静态导出为 convex',
        ),
        ambient: token('shadow', ambientLayers(), '环境高光环：方向边线的环境底'),
      },
      shade: {
        key: token(
          'shadow',
          mode(keyLayers('light', 'convex', 'shade'), keyLayers('dark', 'convex', 'shade')),
          '背光边：按方位角投影，静态导出为 convex',
        ),
      },
    },
    ink,
    layers,
    occlusionLayers,
    solve,
  }
}
