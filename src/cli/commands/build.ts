/**
 * build.ts — `ultime-core build` / `build --check`
 * ---------------------------------------------------------------------------
 * 两种模式只差「写不写盘」：
 *   · build        → 按统一管线产物写入；
 *   · build --check → 在内存重算，逐字节比对磁盘，不写盘。
 * 读盘、写盘归 CLI；解析、派生、产物与诊断来自 `tools/pipeline`。
 */

import fs from 'node:fs'
import path from 'node:path'
import type { CliContext } from '@ultime/cli'
import { exportTheme } from '../../tools/index.ts'
import { loadResolvedConfig } from '../load.ts'

export interface BuildOptions {
  configPath: string
  check: boolean
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(2)} KB`

export function runBuild(ctx: CliContext, options: BuildOptions): number {
  const loaded = loadResolvedConfig(options.configPath)
  if (!loaded.ok) {
    for (const message of loaded.errors) ctx.err(`✗ ${message}`)
    return 1
  }

  let result
  try {
    result = exportTheme(loaded.config)
  } catch (error) {
    ctx.err(`✗ ${(error as Error).message}`)
    return 1
  }

  for (const diagnostic of result.diagnostics) {
    if (diagnostic.level === 'warn') ctx.err(`△ ${diagnostic.message}`)
  }
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.level === 'error')
  if (errors.length) {
    for (const error of errors) ctx.err(`✗ ${error.message}`)
    return 1
  }

  const changed: { path: string; bytes: number }[] = []
  for (const file of result.artifacts) {
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
    ctx.out(`✓ 产物与配置一致（${result.artifacts.length} 个）`)
    return 0
  }

  ctx.out(`✓ 已生成 ${changed.length} 个产物`)
  for (const file of changed) ctx.out(`  ${file.path}  ${kb(file.bytes)}`)
  return 0
}
