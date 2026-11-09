/**
 * index.ts — core 级配置器定义（`@ultime/core/studio`）
 * ---------------------------------------------------------------------------
 * 无头：字段 / 默认值 / 预设 / 校验 / 预览 / 导出。
 * 同一配置版本的 validate / inspect / preview / export 共享一份 ProjectBuild；
 * 改 seed 产生新配置版本，重新派生 —— 这是配置器的职责，不是重复计算。
 */

import { defineConfigurator, type ConfiguratorDefinition, type Diagnostic, type Preset } from '@ultime/studio'
import { planProject, type ProjectBuild } from '../tools'
import { ENGINE_VERSION } from '../version'
import { THEME_DEFAULTS } from './defaults'
import { THEME_FIELDS, THEME_GROUPS } from './fields'
import type { ThemeStudioConfig } from './types'

export type { ThemeStudioConfig } from './types'
export { DEFAULT_OUTPUT, DEFAULT_PLATFORMS, EXAMPLE_SEED, THEME_DEFAULTS } from './defaults'
export { THEME_FIELDS, THEME_GROUPS } from './fields'

let cached: { key: string; build: ProjectBuild } | undefined

/** 每个配置版本只构建一次；配置变化（含 seed）即重新派生。 */
function buildFor(config: ThemeStudioConfig): ProjectBuild {
  const key = JSON.stringify(config)
  if (cached?.key === key) return cached.build
  const build = planProject({
    tokens: {
      seed: config.tokens.seed,
      platforms: config.tokens.platforms,
      output: config.tokens.output,
      semantics: config.tokens.semantics,
    },
  })
  cached = { key, build }
  return build
}

/** 产物清单：与 CLI 共用 `ProjectBuild.artifacts`。 */
export function exportThemeArtifacts(config: ThemeStudioConfig) {
  return buildFor(config).artifacts.map(({ path, content }) => ({ path, content }))
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

function toStudioDiagnostic(diagnostic: ProjectBuild['diagnostics'][number]): Diagnostic {
  return {
    level: diagnostic.level,
    code: `core/${diagnostic.code}`,
    message: diagnostic.message,
    path: diagnostic.path ?? '/tokens/seed',
  }
}

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
      const build = buildFor(config)
      const contract = build.diagnostics.filter((item) => item.code.startsWith('contract.'))
      const other = build.diagnostics.filter((item) => !item.code.startsWith('contract.'))
      diagnostics.push(...other.map(toStudioDiagnostic))
      diagnostics.push(...contract.slice(0, 12).map(toStudioDiagnostic))
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
    const build = buildFor(config)
    return {
      counts: build.core.counts,
      contracts: { total: build.core.contracts.total, failed: build.core.contracts.failed },
      manifest: build.manifest,
      artifacts: build.artifacts.map(({ path, bytes }) => ({ path, bytes })),
      diagnostics: build.diagnostics,
    }
  },
  preview(config) {
    if (!config.tokens.platforms.length || !config.tokens.output.trim()) return { css: '', scenarios: SCENARIOS }
    try {
      const css = exportThemeArtifacts(config)
        .filter((file) => file.path.endsWith('.css'))
        .map((file) => file.content)
        .join('\n')
      return { css, scenarios: SCENARIOS }
    } catch {
      return { css: '', scenarios: SCENARIOS }
    }
  },
  export(config) {
    return { files: exportThemeArtifacts(config) }
  },
})
