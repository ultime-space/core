/**
 * index.ts — core 级配置器定义（`@ultime/core/studio`）
 * ---------------------------------------------------------------------------
 * 无头：字段 / 默认值 / 预设 / 校验 / 预览 / 导出 / 选择 / 派生。
 * core 原版配置（`THEME_DEFAULTS`，无 selection / derivation）的派生随版本固定，
 * 进程内只算一次，validate / inspect / preview / export 共用；用户自定义配置每次独立派生。
 * 供共享的基线构建在读取时复制（manifest / diagnostics / counts），调用方改动不会污染后续结果。
 */

import { defineConfigurator, type ConfiguratorDefinition, type Diagnostic, type Preset } from '@ultime/studio'
import { stableStringify } from '../seed'
import { planProject, type ProjectBuild } from '../tools'
import { ENGINE_VERSION } from '../version'
import { THEME_DEFAULTS } from './defaults'
import { toStudioDiagnostics } from './diagnostics'
import { THEME_FIELDS, THEME_GROUPS } from './fields'
import { selectBuild } from './selection'
import type { ThemeStudioConfig } from './types'

export type { ThemeStudioConfig } from './types'
export { DEFAULT_OUTPUT, DEFAULT_PLATFORMS, EXAMPLE_SEED, THEME_DEFAULTS } from './defaults'
export { THEME_FIELDS, THEME_GROUPS } from './fields'
export {
  selectBuild,
  selectTree,
  type SelectedBuild,
  type SelectionCategory,
  type SelectionConfig,
  type SelectionStep,
} from './selection'
export { deriveTree, type DerivationConfig, type DerivedTree } from './derivation'

const BASELINE_TOKENS = stableStringify(THEME_DEFAULTS.tokens)
let baselineBuild: ProjectBuild | undefined

/** core 原版的派生只算一次；其余配置每次独立派生，不持有跨调用状态。 */
function buildFor(config: ThemeStudioConfig): ProjectBuild {
  const isBaseline = config.selection === undefined && config.derivation === undefined
  if (isBaseline && stableStringify(config.tokens) === BASELINE_TOKENS) {
    baselineBuild ??= derive(config)
    return baselineBuild
  }
  return derive(config)
}

function derive(config: ThemeStudioConfig): ProjectBuild {
  return planProject({
    tokens: {
      seed: config.tokens.seed,
      platforms: config.tokens.platforms,
      output: config.tokens.output,
      semantics: config.tokens.semantics,
    },
  })
}

interface ThemeResult {
  build: ProjectBuild
  /** 配置了 selection / derivation 时走定制导出；否则保持全量产物（含 kernel）。 */
  selected?: ReturnType<typeof selectBuild>
}

function resultFor(config: ThemeStudioConfig): ThemeResult {
  const build = buildFor(config)
  if (config.selection === undefined && config.derivation === undefined) return { build }
  return { build, selected: selectBuild(build, config.selection ?? {}, config.derivation ?? {}) }
}

/** 产物清单：与 CLI 共用 `ProjectBuild.artifacts`；定制导出不含 `kernel.json`。 */
export function exportThemeArtifacts(config: ThemeStudioConfig) {
  const { build, selected } = resultFor(config)
  return (selected?.artifacts ?? build.artifacts).map(({ path, content }) => ({ path, content }))
}

function variant(mutate: (draft: ThemeStudioConfig) => void): ThemeStudioConfig {
  const draft = JSON.parse(JSON.stringify(THEME_DEFAULTS)) as ThemeStudioConfig
  mutate(draft)
  return draft
}

const PRESETS: Preset<ThemeStudioConfig>[] = [
  {
    id: 'brand-blue',
    label: '品牌蓝',
    description: '主色承载品牌身份（彩度 0.9）',
    config: variant((draft) => {
      draft.tokens.seed.color = {
        ...draft.tokens.seed.color,
        primaryHue: 250,
        lightness: 0.64,
        chromaRatio: 0.9,
      }
    }),
  },
  {
    id: 'compact',
    label: '紧凑 · 平板',
    description: '圆角基座 2 / 9 档',
    config: variant((draft) => {
      draft.tokens.seed.skeleton = {
        ...draft.tokens.seed.skeleton!,
        radius: { base: 2, levels: 9 },
      }
    }),
  },
  {
    id: 'paper-night',
    label: '纸夜中性',
    description: '中性灰走 paper-night 配方',
    config: variant((draft) => {
      draft.tokens.seed.color = {
        ...draft.tokens.seed.color,
        neutral: { ...draft.tokens.seed.color!.neutral, preset: 'paper-night' },
      }
    }),
  },
]

const SCENARIOS = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
]

export const themeStudio: ConfiguratorDefinition<ThemeStudioConfig> = defineConfigurator({
  id: 'core.theme',
  title: '设计系统 · core',
  version: ENGINE_VERSION,
  defaults: THEME_DEFAULTS,
  fields: THEME_FIELDS,
  groups: THEME_GROUPS,
  presets: PRESETS,
  unknownPolicy: 'reject',
  validate(config) {
    const diagnostics: Diagnostic[] = []

    if (!config.tokens.platforms.length) {
      diagnostics.push({
        level: 'error',
        code: 'core/platforms',
        message: '至少选一个出口格式',
        path: '/tokens/platforms',
      })
    }
    if (!config.tokens.output.trim()) {
      diagnostics.push({ level: 'error', code: 'core/output', message: '输出目录不能为空', path: '/tokens/output' })
    }
    if (diagnostics.length) return diagnostics

    try {
      const { build, selected } = resultFor(config)
      const source = selected?.diagnostics ?? build.diagnostics
      diagnostics.push(...toStudioDiagnostics(source))
    } catch (error) {
      diagnostics.push({
        level: 'error',
        code: 'core/derive',
        message: error instanceof Error ? error.message : String(error),
        path: '/tokens/seed',
      })
    }

    return diagnostics
  },
  inspect(config) {
    if (!config.tokens.platforms.length || !config.tokens.output.trim()) {
      return { artifacts: [], diagnostics: [] }
    }
    const { build, selected } = resultFor(config)
    const source = selected?.diagnostics ?? build.diagnostics
    return {
      counts: structuredClone(selected?.counts ?? build.core.counts),
      contracts: { total: build.core.contracts.total, failed: build.core.contracts.failed },
      /* 基线构建是共享的：manifest / diagnostics 复制后再给出，调用方改动不会污染后续结果 */
      manifest: structuredClone(build.manifest),
      artifacts: (selected?.artifacts ?? build.artifacts).map(({ path, bytes }) => ({ path, bytes })),
      diagnostics: source.map((item) => ({ ...item })),
      ...(selected ? { custom: true, selection: config.selection ?? {}, derivation: config.derivation ?? {} } : {}),
    }
  },
  preview(config) {
    try {
      if (!config.tokens.platforms.length || !config.tokens.output.trim()) return { css: '', scenarios: SCENARIOS }
      const css = exportThemeArtifacts(config)
        .filter((file) => file.path.endsWith('.css'))
        .map((file) => file.content)
        .join('\n')
      return { css, scenarios: SCENARIOS }
    } catch (error) {
      return {
        css: '',
        scenarios: SCENARIOS,
        diagnostics: [
          {
            level: 'warn',
            code: 'core/preview',
            message: `预览生成失败：${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      }
    }
  },
  export(config) {
    return { files: exportThemeArtifacts(config) }
  },
})
