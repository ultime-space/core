/**
 * tree.ts — 内核树的最小公共类型
 * ---------------------------------------------------------------------------
 * 内核只产出一棵树：`name → value`。节点只有两种：token 与 group。
 * 树用 DTCG 的形态表达（`$type` / `$value` / 嵌套 group），CSS / JSON / DTCG
 * 都是它的翻译，不是第二真源。
 *
 * 两类值：
 *   · 单值：一个平台无关的值（dimension / duration / color / shadow …）；
 *   · 模式值：`{ light, dark }`，表示同一名字在两种模式作用域下解析出两个值。
 *     模式不是名字的一部分，适配器决定作用域写法。
 *
 * 边界：本文件不出现任何载体语法（px / rem / var() 是适配器的事）；
 *       `dimension` 的 `unit` 只声明量纲，不声明交付写法。
 */

/** DTCG 类型（只保留内核实际用到的）。 */
export type TokenType =
  | 'dimension'
  | 'number'
  | 'duration'
  | 'color'
  | 'cubicBezier'
  | 'fontFamily'
  | 'shadow'
  | 'string'

/** 长度：数值 + 量纲。内核统一存逻辑 px；字距用 em；CSS 适配器决定 rem / px。 */
export interface DimensionValue {
  value: number
  unit: 'px' | 'em'
}

/** 时间：数值 + 量纲。 */
export interface DurationValue {
  value: number
  unit: 'ms'
}

/** 颜色：sRGB 分量（0–1）+ alpha；`hex` 是同一值的可读形式。 */
export interface ColorValue {
  colorSpace: 'srgb'
  components: [number, number, number]
  alpha: number
  hex: string
}

/** 一层阴影 / 内阴影。 */
export interface ShadowLayerValue {
  color: ColorValue
  offsetX: DimensionValue
  offsetY: DimensionValue
  blur: DimensionValue
  spread: DimensionValue
  inset: boolean
}

export type ShadowValue = ShadowLayerValue[]

/** 模式值：同一名字在两个模式作用域下的两个值。 */
export interface ModeValue<T> {
  light: T
  dark: T
}

/** 一个 token 节点。 */
export interface Token<T = unknown> {
  $type: TokenType
  $value: T
  $description?: string
}

/** 一个 group 节点。 */
export interface Group {
  [name: string]: Node
}

export type Node = Token | Group

/* ==========================================================================
   构造器
   ========================================================================== */

export const token = <T>($type: TokenType, $value: T, $description?: string): Token<T> =>
  $description ? { $type, $value, $description } : { $type, $value }

export const dimension = (value: number): DimensionValue => ({ value, unit: 'px' })

export const duration = (value: number): DurationValue => ({ value, unit: 'ms' })

export const mode = <T>(light: T, dark: T): ModeValue<T> => ({ light, dark })

/** '#RRGGBB' / '#RGB' → 0–255 分量。 */
export function parseHex(text: string): [number, number, number] {
  const v = String(text).replace('#', '').trim()
  const full =
    v.length === 3
      ? v
          .split('')
          .map((c) => c + c)
          .join('')
      : v
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

/** sRGB 颜色值；alpha 是 0–1。 */
export const color = (hex: string, alpha = 1): ColorValue => {
  const [r, g, b] = parseHex(hex)
  return {
    colorSpace: 'srgb',
    components: [r / 255, g / 255, b / 255],
    alpha,
    hex: `#${[r, g, b]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()}`,
  }
}

/** 半透明颜色（用于面阶 / 状态墨 / 阴影墨）。 */
export const rgba = (hex: string, alpha: number): ColorValue => color(hex, alpha)

export const shadow = (layers: ShadowLayerValue[]): ShadowValue => layers

/* ==========================================================================
   判定 / 遍历 / 合成
   ========================================================================== */

export const isToken = (node: Node): node is Token =>
  !!node && typeof node === 'object' && '$type' in node && '$value' in node

export const isModeValue = (value: unknown): value is ModeValue<unknown> =>
  !!value &&
  typeof value === 'object' &&
  'light' in (value as Record<string, unknown>) &&
  'dark' in (value as Record<string, unknown>)

/**
 * 深度优先遍历（稳定顺序：按写入顺序）。
 * `visit` 收到完整路径与节点；group 先访问自身再递归。
 */
export function walk(node: Node, visit: (path: string[], node: Token | Group) => void, path: string[] = []): void {
  visit(path, node)
  if (isToken(node)) return
  for (const [key, child] of Object.entries(node)) walk(child, visit, [...path, key])
}

/** 树的叶子数（ token 数，模式值算 1 个节点）。 */
export function countTokens(node: Node): number {
  let n = 0
  walk(node, (_path, current) => {
    if (isToken(current)) n++
  })
  return n
}

/** 取路径节点；不存在返回 undefined。 */
export function getNode(root: Node, path: string[]): Node | undefined {
  let current: Node | undefined = root
  for (const key of path) {
    if (!current || isToken(current)) return undefined
    current = current[key]
  }
  return current
}

/** 浅合并两棵树（overlay 覆盖 base；`null` 表示删除）。 */
export function mergeTrees(base: Group, overlay: Group): Group {
  const out: Group = { ...base }
  for (const [key, value] of Object.entries(overlay)) {
    const current = out[key]
    if (value === null) {
      delete out[key]
      continue
    }
    if (!isToken(value) && current && !isToken(current)) out[key] = mergeTrees(current, value)
    else out[key] = value
  }
  return out
}
