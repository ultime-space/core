/**
 * build.ts — `ultime build` / `build --check`
 * ---------------------------------------------------------------------------
 * 两种模式只差「写不写盘」：
 *   · build        → 按 ProjectBuild 产物写入；
 *   · build --check → 在内存重算，逐字节比对磁盘，不写盘。
 * 读盘、写盘归 CLI；派生、产物与诊断来自 `planProject`。
 */

import fs from 'node:fs'
import path from 'node:path'
import type { CliContext } from '@ultime/cli'
import type { SeedInput } from '../../seed.ts'
import { planProject, validateConfig } from '../../tools/index.ts'
import { readConfig, readSeedFile, resolveFromConfig } from '../config-file.ts'

export interface BuildDeps {
  /** 省略 seed 时读 core 的 `theme.example.json` */
  defaultSeed: () => SeedInput
}

export interface BuildOptions {
  configPath: string
  check: boolean
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(2)} KB`

export function runBuild(ctx: CliContext, deps: BuildDeps, options: BuildOptions): number {
  const config = readConfig(options.configPath)
  const issues = validateConfig(config)
  if (issues.length) {
    for (const issue of issues) ctx.err(`✗ 配置：${issue}`)
    ctx.err('  字段拼错不会被静默忽略 —— 修完再跑。')
    return 1
  }
  if (!config.tokens) {
    ctx.err('✗ 配置里没有 tokens 区（本版 CLI 只产出 token 产物）')
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

  for (const diagnostic of build.diagnostics) {
    if (diagnostic.level === 'warn') ctx.err(`△ ${diagnostic.message}`)
  }
  const errors = build.diagnostics.filter((diagnostic) => diagnostic.level === 'error')
  if (errors.length) {
    for (const error of errors) ctx.err(`✗ ${error.message}`)
    return 1
  }

  const changed: { path: string; bytes: number }[] = []
  for (const file of build.artifacts) {
    const abs = path.resolve(path.dirname(options.configPath), file.path)
    if (options.check) {
      if (!fs.existsSync(abs) || fs.readFileSync(abs, 'utf8') !== file.content) {
        ctx.err(`✗ 产物过期：${file.path}`)
        return 1
      }
      continue
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, file.content)
    changed.push({ path: file.path, bytes: file.bytes })
  }

  if (options.check) {
    ctx.out(`✓ 产物与配置一致（${build.artifacts.length} 个）`)
    return 0
  }

  ctx.out(`✓ 已生成 ${changed.length} 个产物`)
  for (const file of changed) ctx.out(`  ${file.path}  ${kb(file.bytes)}`)
  return 0
}
