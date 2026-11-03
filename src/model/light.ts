/**
 * light.ts — 光影：shadow / occlusion / rim / bevel
 * ---------------------------------------------------------------------------
 * 一束方向光：
 *   · shadow = 接触层 + 过渡层 + 环境层（4 档，三槽位）；
 *   · occlusion = 居中四边的环境光遮蔽（Frame / Overlay 容器用）；
 *   · rim = 白色 5.8% 的掠射高光（浅色占位、深色生效）；
 *   · bevel = 内层受光 / 遮光，由同一光源方向推出。
 *
 * 方向在生成时烘焙成静态值：产物里没有运行时角度 / 距离变量。
 */

import type { LightSeed } from '../seed'
import { color, mode, shadow, token, type ColorValue, type Group, type Node, type ShadowLayerValue } from '../tree'

export interface LightResult {
  tree: {
    shadow: Group
    occlusion: Group
    rim: Node
    bevel: Group
  }
  /** 阴影墨（与颜色族共用一枚，不按层分色）。 */
  ink: { hex: string; tone: number; chroma: number; hue: number }
  layers: Record<number, ShadowLayerValue[]>
}

const px = (value: number) => ({ value: +value.toFixed(2), unit: 'px' as const })

/** 四档：由端点 8 / 64 推出 log2(64/8)+1。 */
const LEVELS = [1, 2, 3, 4]

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

  const shadowTree: Group = {
    color: token('color', color(ink.hex), '全项目一枚阴影墨；深浅共用'),
    ...Object.fromEntries(LEVELS.map((n) => [String(n), token('shadow', shadow(layers[n]), `level ${n}`)])),
  }

  const occlusionTree: Group = Object.fromEntries(
    LEVELS.map((n) => [
      String(n),
      token('shadow', shadow([layer(0, halo(n), n * unit)]), `blur ${halo(n)} · alpha ${n * seed.inkUnit}%`),
    ]),
  )

  const rim = shadow([layer(0, 0, seed.rimAlpha, false, color('#FFFFFF', seed.rimAlpha))])
  /* rim 是 1px 环：用 spread 表达，不借 border 宽度。 */
  rim[0].spread = px(1)

  const highlight = (side: 'light' | 'dark') => color('#FFFFFF', seed.bevel[side].highlight)
  const shade = (side: 'light' | 'dark') => color('#000000', seed.bevel[side].shade)
  const bevelLayer = (side: 'light' | 'dark', kind: 'highlight' | 'shade', sign: 1 | -1): ShadowLayerValue => ({
    color: kind === 'highlight' ? highlight(side) : shade(side),
    offsetX: px(0),
    offsetY: px(sign),
    blur: px(0),
    spread: px(0),
    inset: true,
  })
  const bevelPair = (side: 'light' | 'dark', raised: boolean): ShadowLayerValue[] => {
    const top = raised ? 'highlight' : 'shade'
    const bottom = raised ? 'shade' : 'highlight'
    return [bevelLayer(side, top, 1), bevelLayer(side, bottom, -1)]
  }

  return {
    tree: {
      shadow: shadowTree,
      occlusion: occlusionTree,
      rim: token('shadow', rim, '白色高光环：浅色占位、深色生效'),
      bevel: {
        highlight: token('color', mode(highlight('light'), highlight('dark')), '受光边镜面'),
        shade: token('color', mode(shade('light'), shade('dark')), '背光边遮光'),
        raised: token('shadow', mode(bevelPair('light', true), bevelPair('dark', true)), '表面凸起'),
        sunken: token('shadow', mode(bevelPair('light', false), bevelPair('dark', false)), '表面凹陷'),
      },
    },
    ink,
    layers,
  }
}
