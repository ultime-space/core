/**
 * selection.ts — 配置器选择模型（无头）
 * ---------------------------------------------------------------------------
 * 从 core 的完整树里选择要启用的类别与档位，产出定制 tokens。
 * 选择是配置器的配置，不是 core 的构建输入：`ProjectBuild.core.tree` 保持全量，
 * 本文件只在一次构建的结果上做过滤与再导出。
 */

import type { CoreResult } from '../build'
import { countByCategory } from '../contracts'
import { getNode, isToken, type Group } from '../tree'
import type { BuildDiagnostic, PlannedArtifact, ProjectBuild } from '../tools/project'
import { emitTokens } from '../tools/tokens'
import { deriveTree, type DerivationConfig } from './derivation'

export type SelectionCategory = 'skeleton' | 'color' | 'light' | 'motion'

export type SelectionStep =
  | 'space'
  | 'size'
  | 'radius'
  | 'fontSize'
  | 'lineHeight'
  | 'letterSpacing'
  | 'shadow'
  | 'occlusion'
  | 'motionDuration'
  | 'motionDelay'
  | 'motionLoop'

export interface SelectionConfig {
  /** 省略 = 全部类别；空数组 = 不启用任何类别。 */
  categories?: SelectionCategory[]
  /** 按档位裁剪；省略 = 该组全量，空数组 = 去掉该组所有数字档位（保留非档位 token）。 */
  steps?: Partial<Record<SelectionStep, number[]>>
}

export interface SelectedBuild {
  selection: SelectionConfig
  derivation: DerivationConfig
  /** 完整派生结果；过滤后的树看 `tree`，`core.tree` 保持全量。 */
  core: CoreResult
  tree: Group
  counts: { total: number; byCategory: Record<string, number> }
  artifacts: PlannedArtifact[]
  diagnostics: BuildDiagnostic[]
}

const CATEGORY_ORDER: SelectionCategory[] = ['skeleton', 'color', 'light', 'motion']

const CATEGORY_KEYS: Record<string, readonly string[]> = {
  skeleton: ['space', 'size', 'radius', 'fs', 'lh', 'ls', 'font'],
  color: ['color'],
  light: ['shadow', 'occlusion', 'highlight', 'shade'],
  motion: ['motion'],
}

/** 选择维度 → 树路径；`motion*` 落在 motion 子组上。 */
const STEP_PATHS: Record<string, readonly string[]> = {
  space: ['space'],
  size: ['size'],
  radius: ['radius'],
  fontSize: ['fs'],
  lineHeight: ['lh'],
  letterSpacing: ['ls'],
  shadow: ['shadow'],
  occlusion: ['occlusion'],
  motionDuration: ['motion', 'duration'],
  motionDelay: ['motion', 'delay'],
  motionLoop: ['motion', 'loop'],
}

const STEP_NAMES = Object.keys(STEP_PATHS) as SelectionStep[]

interface StepRule {
  levels?: Set<number>
  groups?: Record<string, StepRule>
}

interface NormalizedSelection {
  categories: SelectionCategory[]
  rules: Map<string, StepRule>
  levels: Map<SelectionStep, number[]>
  diagnostics: BuildDiagnostic[]
}

const byteLength = (text: string): number => new TextEncoder().encode(text).length

function mergeRule(base: StepRule, incoming: StepRule): StepRule {
  const groups = { ...(base.groups ?? {}) }
  for (const [key, value] of Object.entries(incoming.groups ?? {})) {
    groups[key] = groups[key] ? mergeRule(groups[key], value) : value
  }
  return {
    levels: incoming.levels ?? base.levels,
    groups: Object.keys(groups).length ? groups : undefined,
  }
}

function stepRule(path: readonly string[], levels: number[]): StepRule {
  const [head, ...rest] = path
  if (!head) return { levels: new Set(levels) }
  return { groups: { [head]: stepRule(rest, levels) } }
}

function normalizeSelection(selection: SelectionConfig): NormalizedSelection {
  const diagnostics: BuildDiagnostic[] = []
  const empty = {
    categories: [] as SelectionCategory[],
    rules: new Map<string, StepRule>(),
    levels: new Map<SelectionStep, number[]>(),
    diagnostics,
  }

  if (selection === null || typeof selection !== 'object' || Array.isArray(selection)) {
    diagnostics.push({ level: 'error', code: 'selection.invalid', message: 'selection 必须是对象', path: '/selection' })
    return empty
  }
  if (selection.categories !== undefined && !Array.isArray(selection.categories)) {
    diagnostics.push({
      level: 'error',
      code: 'selection.invalid',
      message: 'selection.categories 必须是数组',
      path: '/selection/categories',
    })
    return empty
  }
  if (
    selection.steps !== undefined &&
    (selection.steps === null || typeof selection.steps !== 'object' || Array.isArray(selection.steps))
  ) {
    diagnostics.push({
      level: 'error',
      code: 'selection.invalid',
      message: 'selection.steps 必须是对象',
      path: '/selection/steps',
    })
    return empty
  }

  const requested = selection.categories ?? CATEGORY_ORDER
  const categories = [
    ...new Set(
      requested.filter((category) => {
        if (CATEGORY_KEYS[category]) return true
        diagnostics.push({
          level: 'error',
          code: 'selection.category.unknown',
          message: `未知选择类别：${String(category)}（可用：${CATEGORY_ORDER.join(' / ')}）`,
        })
        return false
      }),
    ),
  ]

  const rules = new Map<string, StepRule>()
  const levels = new Map<SelectionStep, number[]>()

  for (const [name, values] of Object.entries(selection.steps ?? {})) {
    const path = STEP_PATHS[name]
    if (!path) {
      diagnostics.push({
        level: 'error',
        code: 'selection.step.unknown',
        message: `未知选择档位：${name}（可用：${STEP_NAMES.join(' / ')}）`,
      })
      continue
    }
    if (!Array.isArray(values) || values.some((value) => !Number.isInteger(value) || value <= 0)) {
      diagnostics.push({
        level: 'error',
        code: 'selection.step.invalid',
        message: `${name} 的档位必须是正整数数组`,
        path: `/${path.join('/')}`,
      })
      continue
    }

    const unique = [...new Set(values)]
    levels.set(name as SelectionStep, unique)
    const [head, ...rest] = path
    rules.set(head, mergeRule(rules.get(head) ?? {}, stepRule(rest, unique)))
  }

  return { categories, rules, levels, diagnostics }
}

function filterGroup(group: Group, rule?: StepRule): Group {
  const out: Group = {}
  for (const [key, child] of Object.entries(group)) {
    if (rule?.levels && /^\d+$/.test(key) && !rule.levels.has(Number(key))) continue
    if (isToken(child)) {
      out[key] = child
      continue
    }
    const next = rule?.groups?.[key]
    out[key] = next ? filterGroup(child, next) : child
  }
  return out
}

function selectFrom(tree: Group, categories: SelectionCategory[], rules: Map<string, StepRule>): Group {
  const keys = new Set(categories.flatMap((category) => CATEGORY_KEYS[category] ?? []))
  const out: Group = {}
  for (const [key, node] of Object.entries(tree)) {
    if (!keys.has(key)) continue
    out[key] = isToken(node) ? node : filterGroup(node, rules.get(key))
  }
  return out
}

/** 纯过滤：从完整树里选类别与档位；未知项被忽略，诊断见 `selectBuild`。 */
export function selectTree(tree: Group, selection: SelectionConfig = {}): Group {
  const normalized = normalizeSelection(selection)
  return selectFrom(tree, normalized.categories, normalized.rules)
}

/** 基于一次 `ProjectBuild` 的选择 / 派生导出；不重新派生 core，产物不含 `kernel.json`。 */
export function selectBuild(
  build: ProjectBuild,
  selection: SelectionConfig = {},
  derivation: DerivationConfig = {},
): SelectedBuild {
  const normalized = normalizeSelection(selection)
  const derived = deriveTree(build, derivation)
  const tree = selectFrom(derived.tree, normalized.categories, normalized.rules)
  const byCategory = countByCategory(tree)
  const total = Object.values(byCategory).reduce((sum, count) => sum + count, 0)
  const counts = { total, byCategory }

  const diagnostics: BuildDiagnostic[] = build.diagnostics.filter(
    (diagnostic) => !diagnostic.code.startsWith('semantics.'),
  )
  diagnostics.push(...derived.diagnostics)
  diagnostics.push(...normalized.diagnostics)

  if (build.config.semantics) {
    diagnostics.push({
      level: 'warn',
      code: 'selection.semantics',
      message: '选择导出不生成 semantics.json；需要语义表时使用 planProject 的全量产物',
      path: '/tokens/semantics',
    })
  }

  for (const [step, requested] of normalized.levels) {
    const path = STEP_PATHS[step]
    const node = getNode(build.core.tree, [...path])
    if (!node || isToken(node)) continue
    const available = Object.keys(node)
      .filter((key) => /^\d+$/.test(key))
      .map(Number)
    const missing = requested.filter((level) => !available.includes(level))
    if (missing.length) {
      diagnostics.push({
        level: 'error',
        code: 'selection.step.missing',
        message: `${step} 没有档位 ${missing.join(' / ')}（可用：${available.join(' / ') || '无'}）`,
        path: `/${path.join('/')}`,
      })
    }
  }

  if (total === 0) {
    diagnostics.push({
      level: 'error',
      code: 'selection.empty',
      message: '选择结果为空：至少保留一个类别或档位',
      path: '/',
    })
  }

  const result: CoreResult = { ...build.core, tree, counts }
  const artifacts: PlannedArtifact[] =
    total === 0
      ? []
      : emitTokens(result, {
          platforms: build.config.platforms,
          output: build.config.output,
          includeManifest: false,
        }).map((file) => ({ ...file, bytes: byteLength(file.content) }))

  return { selection, derivation, core: build.core, tree, counts, artifacts, diagnostics }
}
