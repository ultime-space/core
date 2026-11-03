/**
 * contracts.ts — 内核合同（只校验，不改值）
 * ---------------------------------------------------------------------------
 * 模型合同回答四件事：
 *   · 派生是否与 seed 一致（时长 / 圆环 / 圆角 / 字号步长）；
 *   · 曲线是否合法（控制点、镜像、对称、无过冲）；
 *   · 树是否只含原料（没有 role / mass / profile 这类语义节点）；
 *   · 颜色配对是否达标（复用 derive 的报告）。
 *
 * 合同失败即构建失败；报告写进 manifest。
 */

import type { CoreSeed } from './seed'
import type { ColorResult, ColorReportRow, ReportLevel } from './model/color/derive'
import type { LightResult } from './model/light'
import type { MotionResult } from './model/motion'
import type { SkeletonResult } from './model/skeleton'
import { isModeValue, isToken, walk, type Group, type Node } from './tree'

export interface ContractRow {
  id: string
  label: string
  actual: number | string | null
  target: number | string | null
  pass: boolean
  note?: string
  level?: ReportLevel
  blocking: boolean
}

export interface ContractReport {
  rows: ContractRow[]
  total: number
  failed: number
  ids: string[]
}

export interface ContractInput {
  seed: CoreSeed
  tree: Group
  skeleton: SkeletonResult
  color: ColorResult
  light: LightResult
  motion: MotionResult
}

const row = (
  id: string,
  label: string,
  actual: number | string | null,
  target: number | string | null,
  pass: boolean,
  note?: string,
  level?: ReportLevel,
  blocking = true,
): ContractRow => ({
  id,
  label,
  actual,
  target,
  pass,
  note,
  level: level ?? (pass ? 'pass' : 'deviation'),
  blocking,
})

const monotonic = (values: number[]): boolean => values.every((v, i) => i === 0 || v > values[i - 1])

const nearly = (a: number, b: number, tol = 1e-6): boolean => Math.abs(a - b) <= tol

function bezierValid(points: number[]): boolean {
  return points.length === 4 && points.every((v) => v >= 0 && v <= 1)
}

/** `accelerate` 是 `decelerate` 的时间反转；`standard` 自身对称；linear 固定。 */
function easingFamilyValid(easing: MotionResult['easing']): boolean {
  const [s0, s1, s2, s3] = easing.standard
  const [d0, d1, d2, d3] = easing.decelerate
  const [a0, a1, a2, a3] = easing.accelerate
  return (
    nearly(s0, 1 - s2) &&
    nearly(s1, 0) &&
    nearly(s3, 1) &&
    nearly(d0, 0) &&
    nearly(d1, 0) &&
    nearly(a0, 1 - d2) &&
    nearly(a1, 0) &&
    nearly(a2, d3) &&
    nearly(a3, 1) &&
    nearly(a0, s0) &&
    nearly(d2, s2)
  )
}

/** 树里不得出现语义节点：role / mass / profile。 */
function semanticNodes(tree: Node): string[] {
  const found: string[] = []
  walk(tree, (path, node) => {
    const last = path[path.length - 1]
    if (last && /^(role|roles|mass|profile|profiles)$/i.test(last)) found.push(path.join('.'))
    if (isToken(node)) {
      const value = node.$value
      if (typeof value === 'string' && /^(role|mass|profile)$/i.test(value)) found.push(path.join('.'))
    }
  })
  return found
}

/** 模式值必须两端完整；单值不能伪装成模式值。 */
function modeCompleteness(tree: Node): string[] {
  const bad: string[] = []
  walk(tree, (path, node) => {
    if (!isToken(node)) return
    if (isModeValue(node.$value)) {
      const value = node.$value as { light?: unknown; dark?: unknown }
      if (value.light == null || value.dark == null) bad.push(path.join('.'))
    }
  })
  return bad
}

/** 值里不得出现载体语法；模型只存量纲与数字。 */
function carrierSyntax(tree: Node): string[] {
  const bad: string[] = []
  walk(tree, (path, node) => {
    if (!isToken(node)) return
    const text = JSON.stringify(node.$value)
    if (/var\(|color-mix|--[a-z]/i.test(text)) bad.push(path.join('.'))
  })
  return bad
}

function colorRows(report: ColorReportRow[]): ContractRow[] {
  return report.map((r) =>
    row(
      `color/${r.id}`,
      `${r.pair}（${r.mode}）`,
      r.ratio,
      r.level === 'pass' ? `≥ ${r.target}` : r.level === 'warn' ? `${r.floor}–${r.target}` : `< ${r.floor}`,
      r.level === 'pass' || r.level === 'warn',
      r.reason,
      r.level,
      false,
    ),
  )
}

export function auditContracts({ seed, tree, skeleton, color, light, motion }: ContractInput): ContractReport {
  const rows: ContractRow[] = []

  /* 几何 */
  rows.push(
    row(
      'space-monotonic',
      'space 严格递增且为正',
      skeleton.primitives.space.join(' / '),
      '18 档',
      skeleton.primitives.space.length === 18 &&
        monotonic(skeleton.primitives.space) &&
        skeleton.primitives.space.every((v) => v > 0),
    ),
  )
  rows.push(
    row(
      'size-monotonic',
      'size 5 档、8 步递增',
      skeleton.primitives.size.join(' / '),
      '24…56',
      skeleton.primitives.size.length === 5 &&
        skeleton.primitives.size.every((v, i) => i === 0 || v - skeleton.primitives.size[i - 1] === 8),
    ),
  )
  const radius = skeleton.primitives.radius
  const radiusOk =
    radius.length === seed.skeleton.radius.levels && radius.every((v, i) => nearly(v, i * seed.skeleton.radius.base))
  rows.push(
    row('radius-derive', 'radius = (n−1) × base', radius.join(' / '), `${seed.skeleton.radius.levels} 档`, radiusOk),
  )
  const fs = skeleton.primitives.fontSize
  const fsBase = seed.skeleton.fontSize.base
  const fsSteps = seed.skeleton.fontSize.steps
  const fsOk =
    fs.length === 9 &&
    fsSteps.length === 9 &&
    fs.every((v, i) => v === fsBase + fsSteps[i]) &&
    fs.every((v) => Number.isInteger(v) && v > 0) &&
    monotonic(fs)
  rows.push(
    row('type-steps', '字号 = base + steps（9 档、正整数、递增）', fs.join(' / '), `base ${fsBase} + steps[9]`, fsOk),
  )
  rows.push(
    row(
      'type-line-height',
      '行高 4 档',
      skeleton.primitives.lineHeight.join(' / '),
      '1.2 / 1.4 / 1.6 / 1.8',
      skeleton.primitives.lineHeight.join(',') === '1.2,1.4,1.6,1.8',
    ),
  )
  rows.push(
    row(
      'type-letter-spacing',
      '字距 5 档',
      skeleton.primitives.letterSpacing.join(' / '),
      '−0.02…0.08',
      skeleton.primitives.letterSpacing.join(',') === '-0.02,0,0.02,0.04,0.08',
    ),
  )

  /* 动效 */
  const duration = motion.duration
  rows.push(
    row(
      'duration-derive',
      'duration = unit × n',
      duration.join(' / '),
      `unit ${seed.motion.duration.unit} × n`,
      duration.every((v, i) => v === seed.motion.duration.unit * (i + 1)) && monotonic(duration),
    ),
  )
  rows.push(
    row(
      'duration-floor',
      'duration 下限 ≥ 100ms',
      seed.motion.duration.unit,
      '≥ 100',
      seed.motion.duration.unit >= 100,
    ),
  )
  rows.push(
    row(
      'loop-derive',
      'loop = base × ratio^(n−1)',
      motion.loop.join(' / '),
      `${seed.motion.loop.base} × ${seed.motion.loop.ratio}^(n−1)`,
      motion.loop.every((v, i) => nearly(v, seed.motion.loop.base * seed.motion.loop.ratio ** i)),
    ),
  )
  rows.push(
    row(
      'delay-derive',
      'delay = base × ratio^(n−1)',
      motion.delay.join(' / '),
      `${seed.motion.delay.base} × ${seed.motion.delay.ratio}^(n−1)`,
      motion.delay.every((v, i) => nearly(v, seed.motion.delay.base * seed.motion.delay.ratio ** i)),
    ),
  )
  const easing = motion.easing
  const validCurves = Object.values(easing).every(bezierValid)
  const familyOk = motion.easingSource === 'family' ? easingFamilyValid(easing) : true
  rows.push(
    row('easing-family', '曲线 4 点、镜像与对称成立', validCurves ? '合法' : '非法', 'x / y ∈ [0,1]', validCurves),
  )
  rows.push(
    row(
      'easing-mirror',
      'accelerate = mirror(decelerate)；standard 对称',
      familyOk ? '成立' : '不成立',
      '成立',
      familyOk,
    ),
  )
  if (motion.easingSource === 'family') {
    const easingSeed = seed.motion.easing
    const t = 't' in easingSeed ? easingSeed.t : 0.42
    rows.push(row('easing-t', 't ∈ [0.2, 0.8]', t, '0.2–0.8', t >= 0.2 && t <= 0.8))
  }

  /* 光影 */
  const shadowLevels = Object.keys(light.tree.shadow).filter((k) => k !== 'color')
  rows.push(
    row(
      'shadow-levels',
      'shadow 4 档，level 1 为两槽',
      shadowLevels.join(' / '),
      '1 / 2 / 3 / 4',
      shadowLevels.length === 4 && light.layers[1].length === 2 && [2, 3, 4].every((n) => light.layers[n].length === 3),
    ),
  )
  rows.push(
    row(
      'occlusion-levels',
      'occlusion 4 档、单层',
      Object.keys(light.tree.occlusion).join(' / '),
      '1 / 2 / 3 / 4',
      Object.keys(light.tree.occlusion).length === 4,
    ),
  )

  /* 树结构 */
  const semantic = semanticNodes(tree)
  rows.push(
    row(
      'no-semantic-nodes',
      'core 不含 role / mass / profile 节点',
      semantic.join(', ') || '无',
      '无',
      semantic.length === 0,
    ),
  )
  const modes = modeCompleteness(tree)
  rows.push(row('mode-complete', '模式值两端完整', modes.join(', ') || '完整', '完整', modes.length === 0))
  const carriers = carrierSyntax(tree)
  rows.push(
    row(
      'no-carrier-syntax',
      '模型值不含 var() / color-mix / --',
      carriers.join(', ') || '无',
      '无',
      carriers.length === 0,
    ),
  )

  /* 颜色 */
  rows.push(
    row(
      'surface-canvas-opaque',
      'surface.canvas 不透明',
      color.tree.surface.canvas.light.alpha,
      '1',
      color.tree.surface.canvas.light.alpha === 1 && color.tree.surface.canvas.dark.alpha === 1,
    ),
  )
  rows.push(row('scrim-single', 'scrim 单值、不随模式', color.tree.scrim.hex, '单值', !isModeValue(color.tree.scrim)))
  rows.push(...colorRows(color.report))

  const failed = rows.filter((r) => r.blocking && !r.pass).length
  return { rows, total: rows.length, failed, ids: [...new Set(rows.map((r) => r.id))] }
}

/** 按顶层类别统计 token 数。 */
export function countByCategory(tree: Group): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, node] of Object.entries(tree)) {
    let n = 0
    walk(node, (_path, current) => {
      if (isToken(current)) n++
    })
    out[key] = n
  }
  return out
}
