/**
 * semantics.ts — 语义表（工具层产物，不是内核树）
 * ---------------------------------------------------------------------------
 * 语义表只写「用途名 → 原料路径」：`gap.card → space.6`、`type.body → fs.4`。
 * 它不含值、不派生，所以内核升级时不会与树漂移；合同（对比度 / 配对）
 * 可以声明在这张表上，由上层按需取用。
 *
 * 与内核的边界：树里永远没有 role 节点；这里是 core 工具的**可选产物**，
 * 官方只给模板与默认表，项目可整表替换或局部覆盖。
 */

import { isToken, walk, type Group } from '../tree'
import type { OutputFile } from './types'

/** 一个槽位的值：原料路径，或 `@role.slot` 形式的跨角色引用。 */
export type SemanticsValue = string | string[]

/** 一个用途下的若干槽位。 */
export interface SemanticsRole {
  [slot: string]: SemanticsValue
}

/** 语义表：用途名 → 槽位 → 路径。 */
export interface SemanticsTable {
  [role: string]: SemanticsRole
}

export interface SemanticsConfig {
  /** 官方模板名；省略 = `default` */
  template?: string
  /** 局部覆盖：`role.slot` → 路径（或引用） */
  overrides?: Record<string, SemanticsValue>
}

/** 官方默认语义表：只写路径，不写值。 */
export const DEFAULT_SEMANTICS: SemanticsTable = {
  gap: {
    inline: 'space.2',
    stack: 'space.4',
    section: 'space.8',
    page: 'space.12',
  },
  type: {
    caption: 'fs.2',
    body: 'fs.4',
    subtitle: 'fs.5',
    title: 'fs.6',
    display: 'fs.8',
  },
  border: {
    subtle: 'color.line.1',
    default: 'color.line.2',
    strong: 'color.line.3',
  },
  surface: {
    canvas: 'color.surface.canvas',
    card: 'color.surface.raised',
    overlay: 'color.surface.overlay',
  },
  ink: {
    primary: 'color.ink.primary',
    secondary: 'color.ink.secondary',
  },
  control: {
    compact: 'size.2',
    default: 'size.3',
    touch: 'size.4',
    prominent: 'size.5',
  },
}

/** 官方模板集合；`init` 与配置器从这里取起手表。 */
export const SEMANTICS_TEMPLATES: Record<string, SemanticsTable> = {
  default: DEFAULT_SEMANTICS,
}

const REFERENCE = /^@([a-z][a-z0-9-]*)\.([a-z][a-z0-9-]*)$/

/** 合并模板与局部覆盖；模板不存在时抛错（不静默退回默认）。 */
export function resolveSemantics(config: SemanticsConfig = {}): SemanticsTable {
  const name = config.template ?? 'default'
  const base = SEMANTICS_TEMPLATES[name]
  if (!base) {
    throw new Error(`未知语义表模板：${name}（可用：${Object.keys(SEMANTICS_TEMPLATES).join(' / ')}）`)
  }
  const table = JSON.parse(JSON.stringify(base)) as SemanticsTable
  for (const [key, value] of Object.entries(config.overrides ?? {})) {
    const [role, slot, ...rest] = key.split('.')
    if (!role || !slot || rest.length) throw new Error(`语义表覆盖键必须是 role.slot：${key}`)
    table[role] ??= {}
    table[role][slot] = value
  }
  return table
}

/** 收集树里所有 token 路径（点号形式）；树必须来自同一次构建。 */
export function tokenPaths(tree: Group): Set<string> {
  const paths = new Set<string>()
  walk(tree, (path, node) => {
    if (path.length && isToken(node)) paths.add(path.join('.'))
  })
  return paths
}

/**
 * 校验语义表：值必须是「树里存在的路径」或「表内存在的 @role.slot 引用」，
 * 且引用之间不能成环。
 */
export function validateSemantics(table: SemanticsTable, tree: Group): string[] {
  const issues: string[] = []
  const paths = tokenPaths(tree)
  const slots = new Map<string, SemanticsValue>()

  for (const [role, entries] of Object.entries(table)) {
    for (const [slot, value] of Object.entries(entries)) {
      const key = `${role}.${slot}`
      if (typeof value !== 'string' && !Array.isArray(value)) {
        issues.push(`${key}：值必须是字符串或字符串数组`)
        continue
      }
      const values = Array.isArray(value) ? value : [value]
      if (!values.length) issues.push(`${key}：值不能为空数组`)
      for (const item of values) {
        if (typeof item !== 'string' || !item.trim()) {
          issues.push(`${key}：值必须是非空字符串`)
          continue
        }
        const reference = REFERENCE.exec(item)
        if (!reference) {
          if (!paths.has(item)) issues.push(`${key}：${item} 不是树里的 token 路径`)
          continue
        }
        if (!table[reference[1]]?.[reference[2]]) issues.push(`${key}：引用了不存在的 @${reference[1]}.${reference[2]}`)
      }
      slots.set(key, value)
    }
  }

  /* 引用成环检测 */
  const visit = (key: string, stack: string[]): void => {
    if (stack.includes(key)) {
      issues.push(`引用成环：${[...stack, key].join(' → ')}`)
      return
    }
    const value = slots.get(key)
    if (!value) return
    for (const item of Array.isArray(value) ? value : [value]) {
      const reference = REFERENCE.exec(item)
      if (reference) visit(`${reference[1]}.${reference[2]}`, [...stack, key])
    }
  }
  for (const key of slots.keys()) visit(key, [])

  return [...new Set(issues)]
}

/** 语义表产物：JSON（只写路径，默认不发 CSS）。 */
export function exportSemantics(table: SemanticsTable, options: { output?: string } = {}): OutputFile[] {
  const dir = (options.output ?? 'ultime-tokens').replace(/\/+$/, '')
  const content = {
    $description: '语义表：用途名 → 原料路径（只写路径、不含值；可整表替换或局部覆盖）',
    roles: table,
  }
  return [{ path: `${dir}/semantics.json`, content: `${JSON.stringify(content, null, 2)}\n` }]
}
