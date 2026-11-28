/**
 * css.ts — CSS 出口
 * ---------------------------------------------------------------------------
 * 树 → CSS 变量。单位口径固定：
 *   · space / size / radius / fs → rem（随根字号缩放）；
 *   · ls → em；lh → 无单位；
 *   · shadow / occlusion / highlight / shade / 描边 → px（不 rem 化）。
 *
 * 模式值写成一条 `light-dark(浅, 深)`：
 *   --color-surface-canvas: light-dark(#F2F2F2, #202020);
 * 颜色与光影只在颜色分量表达两端；不再输出 -light / -dark 值位与暗色重指块。
 *
 * reduce：duration → 0.01ms、delay → 0s；loop 不归零，由组件显式停。
 */

import type { CoreResult } from '../build'
import {
  isModeValue,
  isToken,
  parseHex,
  type ColorValue,
  type DimensionValue,
  type DurationValue,
  type Group,
  type ModeValue,
  type ShadowLayerValue,
  type ShadowValue,
  type Token,
} from '../tree'

const SCALABLE = new Set(['space', 'size', 'radius', 'fs'])

export interface FlatToken {
  path: string[]
  token: Token
}

/** 深度优先展开（保持写入顺序）。 */
export function flatten(root: Group): FlatToken[] {
  const out: FlatToken[] = []
  const visit = (node: Group | Token, path: string[]): void => {
    if (isToken(node)) {
      out.push({ path, token: node })
      return
    }
    for (const [key, child] of Object.entries(node)) visit(child, [...path, key])
  }
  visit(root, [])
  return out
}

const cssVar = (path: string[]): string => `--${path.join('-')}`

const quoteFont = (name: string): string => {
  if (
    /^(system-ui|ui-monospace|ui-sans-serif|ui-serif|sans-serif|serif|monospace|cursive|fantasy|math|emoji)$/i.test(
      name,
    )
  )
    return name
  return /[\s"']/.test(name) ? `"${name.replace(/"/g, '\\"')}"` : name
}

function cssColor(value: ColorValue): string {
  if (value.alpha >= 0.999) return value.hex
  const [r, g, b] = value.components.map((c) => Math.round(c * 255))
  const alpha = +value.alpha.toFixed(4)
  return `rgb(${r} ${g} ${b} / ${alpha})`
}

/** 阴影墨走一枚 CSS 变量；其它颜色（highlight / shade）直接烘焙。 */
function shadowColor(value: ColorValue, inkHex?: string): string {
  if (inkHex && value.hex === inkHex && value.alpha < 0.999) {
    return `rgb(var(--shadow-color-rgb) / ${+value.alpha.toFixed(4)})`
  }
  return cssColor(value)
}

function cssShadow(layers: ShadowLayerValue[], inkHex?: string, darkLayers?: ShadowLayerValue[]): string {
  if (!layers.length) return 'none'
  return layers
    .map((layer, index) => {
      const head = `${layer.inset ? 'inset ' : ''}${layer.offsetX.value}px ${layer.offsetY.value}px ${layer.blur.value}px ${layer.spread.value}px`
      const light = shadowColor(layer.color, inkHex)
      const dark = darkLayers?.[index] ? shadowColor(darkLayers[index]!.color, inkHex) : undefined
      return `${head} ${dark ? lightDark(light, dark) : light}`
    })
    .join(', ')
}

/** 阴影几何恒定；深浅只在颜色分量成对，结构不同视为设计错误。 */
function assertSameShadowGeometry(path: string[], light: ShadowValue, dark: ShadowValue): void {
  const name = `--${path.join('-')}`
  if (light.length !== dark.length) throw new Error(`${name}: 深浅阴影层数不同`)
  light.forEach((layer, index) => {
    const other = dark[index]!
    const same =
      layer.inset === other.inset &&
      layer.offsetX.value === other.offsetX.value &&
      layer.offsetY.value === other.offsetY.value &&
      layer.blur.value === other.blur.value &&
      layer.spread.value === other.spread.value
    if (!same) throw new Error(`${name}: 深浅阴影几何不同，模式差异只能存在于颜色分量`)
  })
}

function lightDark(light: string, dark: string): string {
  return `light-dark(${light}, ${dark})`
}

/** 模式值 → 一条 CSS 声明；嵌套的 var() 保持原样，交给浏览器解析。 */
function cssModeValue(
  path: string[],
  token: Token,
  pair: ModeValue<ColorValue | ShadowValue>,
  inkHex?: string,
): string {
  if (token.$type === 'color') {
    return lightDark(cssColor(pair.light as ColorValue), cssColor(pair.dark as ColorValue))
  }
  if (token.$type === 'shadow') {
    const light = pair.light as ShadowValue
    const dark = pair.dark as ShadowValue
    assertSameShadowGeometry(path, light, dark)
    return cssShadow(light, inkHex, dark)
  }
  throw new Error(`--${path.join('-')}: ${token.$type} 不支持模式值`)
}

/** 单个 token 值 → CSS 文本。 */
export function cssValue(path: string[], token: Token, { shadowInkHex }: { shadowInkHex?: string } = {}): string {
  const value = token.$value
  switch (token.$type) {
    case 'dimension': {
      const v = value as DimensionValue
      if (v.unit === 'em') return v.value === 0 ? '0' : `${v.value}em`
      if (SCALABLE.has(path[0])) return v.value === 0 ? '0' : `${+(v.value / 16).toFixed(5)}rem`
      return `${v.value}px`
    }
    case 'number':
      return String(value)
    case 'duration':
      return `${(value as DurationValue).value}ms`
    case 'color':
      return cssColor(value as ColorValue)
    case 'cubicBezier': {
      const points = value as number[]
      if (points.join(',') === '0,0,1,1') return 'linear'
      return `cubic-bezier(${points.join(', ')})`
    }
    case 'fontFamily':
      return (value as string[]).map(quoteFont).join(', ')
    case 'shadow':
      return cssShadow(value as ShadowValue, shadowInkHex)
    case 'string':
      return String(value)
    default:
      throw new Error(`未知 token：${JSON.stringify(token)}`)
  }
}

const SECTION_TITLES: Record<string, string> = {
  space: '间距',
  size: '尺寸（视觉高度）',
  radius: '圆角',
  fs: '字号',
  lh: '行高',
  ls: '字距',
  font: '字体栈',
  color: '颜色（模式值：light-dark 一条）',
  shadow: 'Scene 阴影（4 档 · 三槽位）',
  occlusion: '环境光遮蔽（4 档 · 单层）',
  highlight: '高光（key / ambient）',
  shade: '暗边（key）',
  motion: '动效（四轴）',
}

function header(): string {
  return `/* ============================================================================
   tokens.css — Ultime core
   ---------------------------------------------------------------------------
   生成物 · 勿手改 —— 由 packages/core/scripts/build.ts 从 seed 派生。
   改值改 seed（theme.example.json / 项目 seed），然后重跑：
        pnpm tokens

   定位：平台无关的原料快照；语义名（gap.* / type.* / border.*）属于语义表，
        不在本文件。角色与编排归上层，core 不定义用途。
   单位：space / size / radius / fs → rem；ls → em；lh → 无单位；光影 → px。
   模式：颜色与 highlight.key / shade.key 写成 light-dark(浅, 深)；无后缀变量就是唯一取值。
   reduce：duration → 0.01ms、delay → 0s；loop 不归零，由组件显式停。
   ============================================================================ */`
}

function sectionFor(top: string): string {
  const title = SECTION_TITLES[top]
  return title ? `\n  /* ───── ${title} ───── */` : ''
}

export interface CssOptions {
  /** 只输出某个类别（配置器预览用）；省略 = 全量。 */
  include?: string[]
}

export function treeToCss(result: CoreResult, { include }: CssOptions = {}): string {
  const flat = flatten(result.tree).filter(({ path }) => !include || include.includes(path[0]))
  const inkHex = result.color.shadowInk.hex
  const [inkR, inkG, inkB] = parseHex(inkHex)

  const rootLines: string[] = []
  let current = ''

  for (const { path, token } of flat) {
    if (path[0] !== current) {
      current = path[0]
      rootLines.push(sectionFor(current))
      if (current === 'shadow') rootLines.push(`  --shadow-color-rgb: ${inkR} ${inkG} ${inkB};`)
    }
    const name = cssVar(path)
    const value = token.$value
    if (isModeValue(value) && (token.$type === 'color' || token.$type === 'shadow')) {
      const pair = value as ModeValue<ColorValue | ShadowValue>
      rootLines.push(`  ${name}: ${cssModeValue(path, token, pair, inkHex)};`)
    } else {
      rootLines.push(`  ${name}: ${cssValue(path, token, { shadowInkHex: inkHex })};`)
    }
  }

  const reduced = flatten(result.tree)
    .filter(({ path }) => path[0] === 'motion' && (path[1] === 'duration' || path[1] === 'delay'))
    .map(({ path }) => {
      const name = cssVar(path)
      const reset = path[1] === 'duration' ? '0.01ms' : '0s'
      return `    ${name}: ${reset};`
    })

  return `${header()}

:root {
  color-scheme: light dark;
${rootLines.join('\n')}
}

/* 显式选择只改语境；light-dark() 的取值随 color-scheme 解析。 */
[data-color-mode="light"] {
  color-scheme: light;
}

[data-color-mode="dark"] {
  color-scheme: dark;
}

/* 减少动效：时长与延迟瞬时切换；loop 不归零，循环由组件显式停。 */
@media (prefers-reduced-motion: reduce) {
  :root {
${reduced.join('\n')}
  }
}
`
}
