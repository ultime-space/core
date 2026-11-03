/**
 * skeleton.ts — 空间 / 尺寸 / 圆角 / 排版四个几何族
 * ---------------------------------------------------------------------------
 * 只给档与参数：
 *   · space.1..18：标量距离，0 用字面量；
 *   · size.1..5：控件视觉高度，不含目标尺寸；
 *   · radius.1..N：(n−1) × base，默认 9 档；
 *   · fs.1..9：base + steps[n]，档数固定 9；
 *   · lh.1..4 / ls.1..5：行高 / 字距。
 * 语义用法（gap / pad / type.*）属于语义表，不在 core。
 */

import type { SkeletonSeed } from '../seed'
import { dimension, token, type Group } from '../tree'

export const SPACE_TIERS = [2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 72, 80, 96, 120, 160]
export const SIZE_TIERS = [24, 32, 40, 48, 56]
export const LINE_HEIGHTS = [1.2, 1.4, 1.6, 1.8]
export const LETTER_SPACINGS = [-0.02, 0, 0.02, 0.04, 0.08]

/** 字体栈：接受 CSS 栈或数组，存为结构化名字（去掉外层引号，引号由适配器补）。 */
export function splitFontStack(value: string | string[]): string[] {
  const strip = (name: string): string =>
    name
      .trim()
      .replace(/^(["'])(.*)\1$/, '$2')
      .trim()
  if (Array.isArray(value)) return value.map(strip).filter(Boolean)
  return String(value).split(',').map(strip).filter(Boolean)
}

export interface SkeletonResult {
  tree: {
    space: Group
    size: Group
    radius: Group
    fs: Group
    lh: Group
    ls: Group
    font: Group
  }
  primitives: {
    space: number[]
    spaceInline: number[]
    size: number[]
    radius: number[]
    fontSize: number[]
    lineHeight: number[]
    letterSpacing: number[]
    fontWeight: number[]
  }
}

const key = (n: number): string => String(n)

const heightLabel = (px: number): string => `${px}px`

export function deriveSkeleton(seed: SkeletonSeed): SkeletonResult {
  const space: Group = Object.fromEntries(
    SPACE_TIERS.map((px, i) => [key(i + 1), token('dimension', dimension(px), heightLabel(px))]),
  )

  const size: Group = Object.fromEntries(
    SIZE_TIERS.map((px, i) => [key(i + 1), token('dimension', dimension(px), `控件视觉高度 ${px}px`)]),
  )

  const radiusValues = Array.from({ length: seed.radius.levels }, (_, i) => i * seed.radius.base)
  const radius: Group = Object.fromEntries(
    radiusValues.map((px, i) => [key(i + 1), token('dimension', dimension(px), px === 0 ? '0：直角' : `${px}px`)]),
  )

  const fontSize = seed.fontSize.steps.map((step) => seed.fontSize.base + step)
  const fs: Group = Object.fromEntries(
    fontSize.map((px, i) => [key(i + 1), token('dimension', dimension(px), `${px}px`)]),
  )
  const lh: Group = Object.fromEntries(
    LINE_HEIGHTS.map((value, i) => [key(i + 1), token('number', value, `行高 ${value}`)]),
  )
  const ls: Group = Object.fromEntries(
    LETTER_SPACINGS.map((value, i) => [
      key(i + 1),
      token('dimension', { value, unit: 'em' }, `${value === 0 ? '0' : `${value}em`}：em 相对字号`),
    ]),
  )

  const font: Group = {
    family: token('fontFamily', splitFontStack(seed.font.family)),
    mono: token('fontFamily', splitFontStack(seed.font.mono)),
  }

  return {
    tree: { space, size, radius, fs, lh, ls, font },
    primitives: {
      space: [...SPACE_TIERS],
      spaceInline: SPACE_TIERS.filter((n) => n <= 6),
      size: [...SIZE_TIERS],
      radius: radiusValues,
      fontSize,
      lineHeight: [...LINE_HEIGHTS],
      letterSpacing: [...LETTER_SPACINGS],
      fontWeight: [400, 500, 600],
    },
  }
}
