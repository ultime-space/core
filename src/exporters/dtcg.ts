/**
 * dtcg.ts — DTCG 交换格式
 * ---------------------------------------------------------------------------
 * 树 → DTCG 2025.10：真正嵌套 group，`$type` / `$value` 由标准定义。
 * 模式值导出为 `{ light, dark }` 两个 token；不造同名 group + token 的非法结构。
 * DTCG 只作交换格式，真源仍是 seed + 引擎。
 */

import type { CoreResult } from '../build'
import { ENGINE_VERSION, SCHEMA_VERSION } from '../version'
import { seedHash } from '../seed'
import {
  isModeValue,
  isToken,
  type ColorValue,
  type DimensionValue,
  type DurationValue,
  type Node,
  type ShadowLayerValue,
  type ShadowValue,
  type Token,
} from '../tree'

const dimension = (value: DimensionValue) => ({ value: value.value, unit: value.unit })

const duration = (value: DurationValue) => ({ value: value.value, unit: value.unit })

const color = (value: ColorValue) => ({
  colorSpace: 'srgb',
  components: value.components.map((c) => +c.toFixed(4)),
  alpha: value.alpha,
  hex: value.hex,
})

const shadowLayer = (layer: ShadowLayerValue) => ({
  color: color(layer.color),
  offsetX: dimension(layer.offsetX),
  offsetY: dimension(layer.offsetY),
  blur: dimension(layer.blur),
  spread: dimension(layer.spread),
  inset: layer.inset,
})

function dtcgToken(node: Token) {
  switch (node.$type) {
    case 'dimension':
      return { $type: 'dimension', $value: dimension(node.$value as DimensionValue) }
    case 'number':
      return { $type: 'number', $value: node.$value }
    case 'duration':
      return { $type: 'duration', $value: duration(node.$value as DurationValue) }
    case 'color':
      return { $type: 'color', $value: color(node.$value as ColorValue) }
    case 'cubicBezier':
      return { $type: 'cubicBezier', $value: node.$value }
    case 'fontFamily':
      return { $type: 'fontFamily', $value: node.$value }
    case 'shadow':
      return { $type: 'shadow', $value: (node.$value as ShadowValue).map(shadowLayer) }
    case 'string':
      return { $type: 'string', $value: node.$value }
    default:
      throw new Error(`未知 token：${JSON.stringify(node)}`)
  }
}

function mapNode(node: Node): unknown {
  if (isToken(node)) {
    if (isModeValue(node.$value)) {
      const pair = node.$value as { light: unknown; dark: unknown }
      return {
        light: dtcgToken({ ...node, $value: pair.light } as Token),
        dark: dtcgToken({ ...node, $value: pair.dark } as Token),
        $description: node.$description ? `${node.$description}（模式值：light / dark）` : '模式值：light / dark',
      }
    }
    return dtcgToken(node)
  }
  return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, mapNode(child)]))
}

export function treeToDtcg(result: CoreResult) {
  return {
    $description:
      '生成物 · 勿手改 —— 由 packages/core/scripts/build.ts 从 seed 派生。Ultime core · DTCG 导出。颜色模式值为 { light, dark } 两个 token；CSS 的无后缀开关是适配器行为，不在 DTCG 里复制。',
    $extensions: {
      'com.ultime.core': {
        schemaVersion: SCHEMA_VERSION,
        engineVersion: ENGINE_VERSION,
        seedHash: seedHash(result.seed),
        note: '真源是 seed + 引擎；本文件只是可交换快照。',
      },
    },
    ...(mapNode(result.tree) as Record<string, unknown>),
  }
}
