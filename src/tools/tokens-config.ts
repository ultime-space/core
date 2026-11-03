/**
 * tokens-config.ts — 项目子集声明（L3）
 * ---------------------------------------------------------------------------
 * 子集只能从内核原语集里选：选了不存在的档要在审计期报错，
 * 不允许静默混入一次性数值。
 */

import { buildCore } from '../build'
import { DEFAULT_SEED } from '../seed'

export interface SubsetConfig {
  space?: number[]
  size?: number[]
  radius?: number[]
  fontSize?: number[]
  lineHeight?: number[]
  letterSpacing?: number[]
  motionDuration?: number[]
  motionDelay?: number[]
  motionLoop?: number[]
}

export interface SubsetDimension {
  key: keyof SubsetConfig
  label: string
  unit?: string
  values: (string | number)[]
  hint?: string
}

const base = buildCore()

export const SUBSET_DIMENSIONS: SubsetDimension[] = [
  { key: 'space', label: '间距', unit: 'px', values: base.skeleton.primitives.space, hint: '18 档；0 用字面量' },
  {
    key: 'size',
    label: '尺寸（视觉高度）',
    unit: 'px',
    values: base.skeleton.primitives.size,
    hint: '5 档；目标尺寸归 kit',
  },
  { key: 'radius', label: '圆角', unit: 'px', values: base.skeleton.primitives.radius, hint: '由 base 派生' },
  { key: 'fontSize', label: '字号', unit: 'px', values: base.skeleton.primitives.fontSize, hint: '9 档' },
  { key: 'lineHeight', label: '行高', values: base.skeleton.primitives.lineHeight, hint: '4 档' },
  {
    key: 'letterSpacing',
    label: '字距',
    unit: 'em',
    values: base.skeleton.primitives.letterSpacing,
    hint: '5 档；中文不加负字距',
  },
  { key: 'motionDuration', label: '动效时长', unit: 'ms', values: base.motion.duration, hint: '一次过渡' },
  { key: 'motionDelay', label: '动效延迟', unit: 'ms', values: base.motion.delay, hint: '编排偏移' },
  { key: 'motionLoop', label: '循环周期', unit: 'ms', values: base.motion.loop, hint: '周期循环' },
]

export const SUBSET_DEFAULTS: SubsetConfig = {
  space: [4, 8, 12, 16, 24, 32, 40, 48, 64],
  size: [32, 40, 48, 56],
  radius: [4, 8, 12, 16, 24, 32],
  fontSize: [12, 14, 16, 18, 24, 32],
  lineHeight: [1.2, 1.4, 1.6],
  letterSpacing: [0, 0.02],
  motionDuration: [100, 200, 300, 400],
  motionDelay: [50, 100, 200],
  motionLoop: [1000, 2000, 4000],
}

/** 子集校验：每一档必须存在于当前 seed 的原语集。 */
export function validateSubset(subset: SubsetConfig, dimensions = SUBSET_DIMENSIONS): string[] {
  const issues: string[] = []
  for (const [key, values] of Object.entries(subset) as Array<[keyof SubsetConfig, number[] | undefined]>) {
    if (!values) continue
    const dimension = dimensions.find((item) => item.key === key)
    if (!dimension) {
      issues.push(`未知子集维度：${key}`)
      continue
    }
    for (const value of values) {
      if (!dimension.values.includes(value)) issues.push(`${dimension.label}：${value} 不在原语集内`)
    }
  }
  return issues
}

/** 子集声明文件；与 core 默认 seed 一起写出。 */
export function tokensConfigJson(subset: SubsetConfig = SUBSET_DEFAULTS): string {
  return `${JSON.stringify(
    {
      $description: '项目子集：只列允许出现的档位；必须从 core 原语集里选。审计读它做白名单。',
      seed: DEFAULT_SEED,
      subset,
    },
    null,
    2,
  )}\n`
}
