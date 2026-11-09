/**
 * inspect.ts — `ultime inspect`
 * ---------------------------------------------------------------------------
 * 只读：渲染 `ProjectBuild` 的产物、模式、合同、颜色与诊断。
 * 不重新派生、不写盘、不生成设计系统内容。
 */

import path from 'node:path'
import type { CliContext } from '@ultime/cli'
import type { SeedInput } from '../../seed.ts'
import { planProject, validateConfig } from '../../tools/index.ts'
import { readConfig, readSeedFile, resolveFromConfig } from '../config-file.ts'

export interface InspectDeps {
  /** 省略 seed 时读 core 的 `theme.example.json` */
  defaultSeed: () => SeedInput
}

export interface InspectOptions {
  configPath: string
  json: boolean
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(2)} KB`

export function runInspect(ctx: CliContext, deps: InspectDeps, options: InspectOptions): number {
  const config = readConfig(options.configPath)
  const issues = validateConfig(config)
  if (issues.length) {
    for (const issue of issues) ctx.err(`✗ 配置：${issue}`)
    return 1
  }
  if (!config.tokens) {
    ctx.err('✗ 配置里没有 tokens 区')
    return 1
  }

  const raw = config.tokens.seed
  const seed: SeedInput =
    raw == null
      ? deps.defaultSeed()
      : typeof raw === 'string'
        ? readSeedFile(resolveFromConfig(options.configPath, raw))
        : raw

  let build
  try {
    build = planProject(config, seed)
  } catch (error) {
    ctx.err(`✗ ${(error as Error).message}`)
    return 1
  }

  if (options.json) {
    ctx.out(
      JSON.stringify(
        {
          artifacts: build.artifacts.map(({ path, bytes }) => ({ path, bytes })),
          platforms: build.config.platforms,
          modes: build.manifest.seed.color.modes,
          counts: build.core.counts,
          contracts: { total: build.core.contracts.total, failed: build.core.contracts.failed },
          color: build.manifest.color.levels,
          diagnostics: build.diagnostics,
        },
        null,
        2,
      ),
    )
    return 0
  }

  const totalBytes = build.artifacts.reduce((sum, file) => sum + file.bytes, 0)
  ctx.out(`构建检查 · ${path.basename(options.configPath)}`)
  ctx.out(`  产物 ${build.artifacts.length} 个 · ${kb(totalBytes)}`)
  for (const file of build.artifacts) ctx.out(`    ${file.path}  ${kb(file.bytes)}`)
  ctx.out(`  平台 ${build.config.platforms.join(' / ') || '—'}`)
  ctx.out(`  模式 ${build.manifest.seed.color.modes.join(' / ') || '—'}`)
  const categories = Object.entries(build.core.counts.byCategory)
    .map(([name, count]) => `${name} ${count}`)
    .join(' · ')
  ctx.out(`  类别 ${categories || '—'}`)
  ctx.out(`  合同 ${build.core.contracts.total} 条 / ${build.core.contracts.failed} 失败`)
  const levels = Object.entries(build.manifest.color.levels)
    .map(([level, count]) => `${level} ${count}`)
    .join(' · ')
  ctx.out(`  颜色 ${levels || '—'}`)

  if (build.diagnostics.length === 0) {
    ctx.out('  ✓ 无构建诊断')
    return 0
  }

  ctx.out(`  诊断 ${build.diagnostics.length}`)
  for (const diagnostic of build.diagnostics) {
    const mark = diagnostic.level === 'error' ? '✗' : diagnostic.level === 'warn' ? '△' : '·'
    ctx.out(`    ${mark} ${diagnostic.message}`)
  }
  return 0
}
