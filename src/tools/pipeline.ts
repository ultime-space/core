/**
 * pipeline.ts — core 的统一配置 / 导出路径
 * ---------------------------------------------------------------------------
 * 一份配置 → 一次解析 / 校验 → 一次 `planProject` → 一份 artifacts / diagnostics。
 * CLI、`core/studio` 与库 API 都调这里；默认配置与自定义配置没有分支，只有「覆盖了多少默认值」。
 * 本文件不读盘、不写盘：文件路径与落盘归 CLI。
 */

import { stableStringify, type SeedInput } from '../seed'
import { validateConfig, type TokensConfig, type UltimeConfig } from './config'
import { THEME_DEFAULTS } from './defaults'
import type { DerivationConfig } from './derivation'
import { planProject, type BuildDiagnostic, type PlannedArtifact, type ProjectBuild } from './project'
import { selectBuild, type SelectedBuild, type SelectionConfig } from './selection'
import type { SemanticsConfig } from './semantics'
import type { TokenPlatform } from './tokens'

/** 完整配置：默认值已合并，可直接派生。 */
export interface ThemeConfig {
  tokens: {
    seed: SeedInput
    platforms: TokenPlatform[]
    output: string
    semantics?: SemanticsConfig
  }
  /** 省略 = 全量（含 kernel.json） */
  selection?: SelectionConfig
  /** 省略 = 静态默认 */
  derivation?: DerivationConfig
}

export interface ResolvedTheme {
  config: ThemeConfig
  diagnostics: BuildDiagnostic[]
}

export interface ThemeExport {
  build: ProjectBuild
  /** 配置了 selection / derivation 时的定制导出 */
  selected?: SelectedBuild
  /** 实际产物：全量或定制后的清单 */
  artifacts: PlannedArtifact[]
  diagnostics: BuildDiagnostic[]
}

const BASELINE_TOKENS = stableStringify(THEME_DEFAULTS.tokens)
let baselineBuild: ProjectBuild | undefined

function derive(config: ThemeConfig): ProjectBuild {
  return planProject({
    tokens: {
      seed: config.tokens.seed,
      platforms: config.tokens.platforms,
      output: config.tokens.output,
      semantics: config.tokens.semantics,
    },
  })
}

/** core 原版的派生只算一次；其余配置每次独立派生，不持有跨调用状态。 */
function buildFor(config: ThemeConfig): ProjectBuild {
  const isBaseline = config.selection === undefined && config.derivation === undefined
  if (isBaseline && stableStringify(config.tokens) === BASELINE_TOKENS) {
    baselineBuild ??= derive(config)
    return baselineBuild
  }
  return derive(config)
}

/**
 * 合并默认值并校验；schema 错误以 diagnostics 返回，不抛异常。
 * `tokens.seed` 是文件路径时由调用方先读成对象。
 */
export function resolveThemeConfig(input: UltimeConfig = {}, options: { seed?: SeedInput } = {}): ResolvedTheme {
  const diagnostics: BuildDiagnostic[] = validateConfig(input).map((message) => ({
    level: 'error' as const,
    code: 'config.invalid',
    message,
    path: '/',
  }))

  const tokens: TokensConfig = input.tokens ?? {}
  let seed = options.seed ?? tokens.seed ?? THEME_DEFAULTS.tokens.seed
  if (typeof seed === 'string') {
    diagnostics.push({
      level: 'error',
      code: 'config.seed-path',
      message: 'tokens.seed 是文件路径：请先读取成对象再传入',
      path: '/tokens/seed',
    })
    seed = THEME_DEFAULTS.tokens.seed
  }

  const config: ThemeConfig = {
    tokens: {
      seed,
      platforms: tokens.platforms ?? THEME_DEFAULTS.tokens.platforms,
      output: tokens.output ?? THEME_DEFAULTS.tokens.output,
      ...(tokens.semantics === undefined ? {} : { semantics: tokens.semantics }),
    },
    ...(input.selection === undefined ? {} : { selection: input.selection as SelectionConfig }),
    ...(input.derivation === undefined ? {} : { derivation: input.derivation as DerivationConfig }),
  }

  return { config, diagnostics }
}

/** 一次派生 + 一次选择；默认与自定义同一条出口。 */
export function exportTheme(config: ThemeConfig): ThemeExport {
  const build = buildFor(config)

  if (config.selection === undefined && config.derivation === undefined) {
    return { build, artifacts: build.artifacts, diagnostics: build.diagnostics }
  }

  const selected = selectBuild(build, config.selection ?? {}, config.derivation ?? {})
  return { build, selected, artifacts: selected.artifacts, diagnostics: selected.diagnostics }
}

/** 兼容入口：只要文件清单；有 error 时抛出。 */
export function exportThemeArtifacts(config: ThemeConfig): Array<{ path: string; content: string }> {
  const result = exportTheme(config)
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.level === 'error')
  if (errors.length) throw new Error(errors.map((diagnostic) => diagnostic.message).join('；'))
  return result.artifacts.map(({ path, content }) => ({ path, content }))
}
