/**
 * json.ts — 原生 JSON 快照
 * ---------------------------------------------------------------------------
 * 树形保留，值与 CSS 出口同源（同样的单位与颜色写法）。
 * 模式值输出为 `{ light, dark }`；单值直接是字符串。
 * 真源仍是 seed + 派生，本文件只是快照。
 */

import type { CoreResult } from '../build'
import { isModeValue, isToken, type Group, type Node, type Token } from '../tree'
import { cssValue } from './css'

const stringValue = (path: string[], token: Token): string => cssValue(path, token)

function mapNode(node: Node, path: string[]): unknown {
  if (isToken(node)) {
    if (isModeValue(node.$value)) {
      const pair = node.$value as { light: unknown; dark: unknown }
      return {
        light: stringValue(path, { ...node, $value: pair.light } as Token),
        dark: stringValue(path, { ...node, $value: pair.dark } as Token),
      }
    }
    return stringValue(path, node)
  }
  return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, mapNode(child, [...path, key])]))
}

export function treeToJson(result: CoreResult) {
  return {
    $description: 'Ultime core 快照 · 由 seed 派生；颜色模式值为 { light, dark }；真源是 seed + 引擎，不是本文件。',
    schemaVersion: '4.0.0',
    seed: result.seed,
    tokens: mapNode(result.tree as Group, []),
  }
}
