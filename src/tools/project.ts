/**
 * project.ts — 项目构建计划（唯一构建事实）
 * ---------------------------------------------------------------------------
 * `planProject` 只派生一次：CoreResult → artifacts / manifest / diagnostics。
 * CLI、inspect、scripts 与 studio 的 validate / preview / export 都消费这一份。
 */

import { buildCore, buildManifest, type CoreResult } from '../build'
import type { SeedInput } from '../seed'
import { validateConfig, type UltimeConfig } from './config'
import { exportSemantics, resolveSemantics, validateSemantics, type SemanticsConfig } from './semantics'
import { DEFAULT_DIR, DEFAULT_PLATFORMS, emitTokens, type TokenPlatform } from './tokens'
import type { OutputFile } from './types'

export interface ProjectConfig {
  seed: SeedInput
  platforms: TokenPlatform[]
  output: string
  semantics?: SemanticsConfig
}

export interface PlannedArtifact extends OutputFile {
  bytes: number
}

export type BuildDiagnosticLevel = 'error' | 'warn' | 'info'

export interface BuildDiagnostic {
  level: BuildDiagnosticLevel
  code: string
  message: string
  path?: string
}

export interface ProjectBuild {
  config: ProjectConfig
  core: CoreResult
  manifest: ReturnType<typeof buildManifest>
  artifacts: PlannedArtifact[]
  diagnostics: BuildDiagnostic[]
}

const bytes = (text: string): number => new TextEncoder().encode(text).length

function resolveInputSeed(tokens: NonNullable<UltimeConfig['tokens']>, seed?: SeedInput): SeedInput {
  if (seed !== undefined) return seed
  if (typeof tokens.seed === 'string') {
    throw new Error('tokens.seed 是文件路径：请先读取成对象再调用 planProject（CLI 负责读盘）')
  }
  return tokens.seed ?? {}
}

function contractDiagnostics(core: CoreResult): BuildDiagnostic[] {
  return core.contracts.rows
    .filter((row) => !row.pass)
    .map((row) => ({
      level: row.blocking ? ('error' as const) : ('warn' as const),
      code: `contract.${row.id}`,
      message: `${row.label}：实测 ${String(row.actual)}，目标 ${String(row.target)}`,
      path: '/tokens/seed',
    }))
}

/** 一次构建计划：core 只派生一次，所有产物与诊断来自同一份结果。 */
export function planProject(input: UltimeConfig, seed?: SeedInput): ProjectBuild {
  const issues = validateConfig(input)
  if (issues.length) throw new Error(`配置：${issues.join('；')}`)

  const tokens = input.tokens
  if (!tokens) throw new Error('配置里没有 tokens 区')

  const inputSeed = resolveInputSeed(tokens, seed)
  const config: ProjectConfig = {
    seed: inputSeed,
    platforms: tokens.platforms ?? DEFAULT_PLATFORMS,
    output: tokens.output ?? DEFAULT_DIR,
    semantics: tokens.semantics,
  }

  const core = buildCore(inputSeed)
  const artifacts = emitTokens(core, { platforms: config.platforms, output: config.output })
  const diagnostics = contractDiagnostics(core)

  if (config.semantics) {
    try {
      const table = resolveSemantics(config.semantics)
      const semanticsIssues = validateSemantics(table, core.tree)
      if (semanticsIssues.length) {
        diagnostics.push({
          level: 'error',
          code: 'semantics.invalid',
          message: `语义表无效：${semanticsIssues.join('；')}`,
          path: '/tokens/semantics',
        })
      } else {
        artifacts.push(...exportSemantics(table, { output: config.output }))
      }
    } catch (error) {
      diagnostics.push({
        level: 'error',
        code: 'semantics.invalid',
        message: (error as Error).message,
        path: '/tokens/semantics',
      })
    }
  }

  return {
    config,
    core,
    manifest: buildManifest(core),
    artifacts: artifacts.map((file) => ({ ...file, bytes: bytes(file.content) })),
    diagnostics,
  }
}

/** 兼容入口：返回文件清单；有 error 时抛出，与旧 `exportArtifacts` 行为一致。 */
export function exportArtifacts(input: UltimeConfig, seed?: SeedInput): OutputFile[] {
  if (!input.tokens) return []
  const build = planProject(input, seed)
  const errors = build.diagnostics.filter((diagnostic) => diagnostic.level === 'error')
  if (errors.length) throw new Error(errors.map((diagnostic) => diagnostic.message).join('；'))
  return build.artifacts.map(({ path, content }) => ({ path, content }))
}
