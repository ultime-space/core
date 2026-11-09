/**
 * schema.ts — `ultime schema`
 * ---------------------------------------------------------------------------
 * 字段清单与配置器同源：全部从 studio 与 tools 取，CLI 不自维护第二份 schema。
 */

import type { CliContext } from '@ultime/cli'
import { THEME_FIELDS, THEME_GROUPS } from '../../studio/index.ts'
import { DEFAULT_DIR, DEFAULT_PLATFORMS, DEFAULT_SEMANTICS, SEMANTICS_TEMPLATES } from '../../tools/index.ts'

export function schemaJson() {
  return {
    seed: { groups: THEME_GROUPS, fields: THEME_FIELDS },
    project: { platforms: DEFAULT_PLATFORMS, output: DEFAULT_DIR },
    semantics: {
      templates: Object.keys(SEMANTICS_TEMPLATES),
      default: DEFAULT_SEMANTICS,
    },
  }
}

export function runSchema(ctx: CliContext, json: boolean): number {
  const schema = schemaJson()

  if (json) {
    ctx.out(JSON.stringify(schema, null, 2))
    return 0
  }

  ctx.out(`seed · ${schema.seed.groups.length} 组 / ${schema.seed.fields.length} 项`)
  for (const group of schema.seed.groups) {
    const count = schema.seed.fields.filter((field) => field.group === group.key).length
    ctx.out(`  ${group.key.padEnd(12)} ${group.label}  ${count} 项`)
  }

  ctx.out(`出口 · ${schema.project.platforms.join(' / ')} · 默认 ${schema.project.output}`)
  const roles = Object.keys(schema.semantics.default)
  ctx.out(`语义表 · 模板 ${schema.semantics.templates.join(' / ')} · ${roles.length} 组用途`)
  for (const role of roles) {
    ctx.out(
      `  ${role.padEnd(12)} ${Object.keys(schema.semantics.default[role as keyof typeof schema.semantics.default]).join(' / ')}`,
    )
  }
  return 0
}
