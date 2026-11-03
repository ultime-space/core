/**
 * motion.ts — 动效四轴：duration / loop / delay / easing
 * ---------------------------------------------------------------------------
 * seed 只记录步长与档数：
 *   duration.n = unit × n
 *   loop.n     = base × ratio^(n−1)
 *   delay.n    = base × ratio^(n−1)
 *   easing     = 一个 t 派生的三条曲线 + 固定 linear
 *
 * 角色（enter / exit / press…）与编排规则属于语义表 / 上层语言，
 * 不进 core；core 只给可复算的时间与曲线。
 */

import type { MotionSeed } from '../seed'
import { duration, token, type Group } from '../tree'

export type EasingSet = {
  standard: number[]
  decelerate: number[]
  accelerate: number[]
  linear: number[]
}

/** `t = 0.42` 时正好是 CSS ease-in-out / ease-out / ease-in 与 Apple Core Animation。 */
export function easingFamily(t: number): EasingSet {
  const complement = +(1 - t).toFixed(4)
  return {
    standard: [t, 0, complement, 1],
    decelerate: [0, 0, complement, 1],
    accelerate: [t, 0, 1, 1],
    linear: [0, 0, 1, 1],
  }
}

export interface MotionResult {
  tree: Group
  duration: number[]
  loop: number[]
  delay: number[]
  easing: EasingSet
  /** seed 里 `easing` 是参数（t）还是显式三条曲线。 */
  easingSource: 'family' | 'custom'
}

const bezier = (points: number[], note: string) => token('cubicBezier', points, note)

export function deriveMotion(seed: MotionSeed): MotionResult {
  const durationValues = Array.from({ length: seed.duration.count }, (_, i) => seed.duration.unit * (i + 1))
  const loopValues = Array.from({ length: seed.loop.count }, (_, i) => seed.loop.base * seed.loop.ratio ** i)
  const delayValues = Array.from({ length: seed.delay.count }, (_, i) => seed.delay.base * seed.delay.ratio ** i)

  const custom = 'standard' in seed.easing
  const explicit = seed.easing as { standard: number[]; decelerate: number[]; accelerate: number[] }
  const parametric = seed.easing as { t: number }
  const easing: EasingSet = custom
    ? {
        standard: explicit.standard,
        decelerate: explicit.decelerate,
        accelerate: explicit.accelerate,
        linear: [0, 0, 1, 1],
      }
    : easingFamily(parametric.t)

  const durationTree: Group = Object.fromEntries(
    durationValues.map((ms, i) => [String(i + 1), token('duration', duration(ms), `${ms}ms`)]),
  )
  const loopTree: Group = Object.fromEntries(
    loopValues.map((ms, i) => [String(i + 1), token('duration', duration(ms), `${ms}ms：周期循环`)]),
  )
  const delayTree: Group = Object.fromEntries(
    delayValues.map((ms, i) => [String(i + 1), token('duration', duration(ms), `${ms}ms：编排偏移`)]),
  )

  const easingTree: Group = {
    standard: bezier(easing.standard, '屏内移动 / 展开收起 / 尺寸变化'),
    decelerate: bezier(easing.decelerate, '进入'),
    accelerate: bezier(easing.accelerate, '离开'),
    linear: bezier(easing.linear, '进度 / 加载 / 旋转：只能给连续量'),
  }

  return {
    tree: {
      duration: durationTree,
      loop: loopTree,
      delay: delayTree,
      easing: easingTree,
    },
    duration: durationValues,
    loop: loopValues,
    delay: delayValues,
    easing,
    easingSource: custom ? 'custom' : 'family',
  }
}
