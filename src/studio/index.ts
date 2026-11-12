/**
 * index.ts — core 级配置器定义（`@ultime/core/studio`）
 * ---------------------------------------------------------------------------
 * 只保留领域定义：字段 / 默认值 / 预设 / 校验映射 / 预览 / 导出编排。
 * 配置解析与导出走 `tools/pipeline`；CLI 与库 API 都调同一条路径，
 * 本文件不另存默认值、校验或产物组装。
 */

import { defineConfigurator, type ConfiguratorDefinition, type Diagnostic, type Preset } from '@ultime/studio'
import { THEME_DEFAULTS, exportTheme, type ThemeConfig } from '../tools'
import { ENGINE_VERSION } from '../version'
import { toStudioDiagnostics } from './diagnostics'
import { THEME_FIELDS, THEME_GROUPS } from './fields'

export type { ThemeStudioConfig } from './types'
export type {
  DerivationConfig,
  DerivedTree,
  SelectedBuild,
  SelectionCategory,
  SelectionConfig,
  SelectionStep,
  ThemeConfig,
} from '../tools'
export {
  DEFAULT_OUTPUT,
  DEFAULT_PLATFORMS,
  EXAMPLE_SEED,
  THEME_DEFAULTS,
  deriveTree,
  exportTheme,
  exportThemeArtifacts,
  resolveThemeConfig,
  selectBuild,
  selectTree,
} from '../tools'
export { THEME_FIELDS, THEME_GROUPS } from './fields'
export {
  GRADIENT_RULES,
  planGradient,
  type GradientInput,
  type GradientPlan,
  type GradientRules,
} from '../model/color/gradient'

function variant(mutate: (draft: ThemeConfig) => void): ThemeConfig {
  const draft = JSON.parse(JSON.stringify(THEME_DEFAULTS)) as ThemeConfig
  mutate(draft)
  return draft
}

const PRESETS: Preset<ThemeConfig>[] = [
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

export const themeStudio: ConfiguratorDefinition<ThemeConfig> = defineConfigurator({
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
      diagnostics.push(...toStudioDiagnostics(exportTheme(config).diagnostics))
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
    const result = exportTheme(config)
    return {
      counts: structuredClone(result.selected?.counts ?? result.build.core.counts),
      contracts: { total: result.build.core.contracts.total, failed: result.build.core.contracts.failed },
      /* 基线构建是共享的：manifest / diagnostics 复制后再给出，调用方改动不会污染后续结果 */
      manifest: structuredClone(result.build.manifest),
      artifacts: result.artifacts.map(({ path, bytes }) => ({ path, bytes })),
      diagnostics: result.diagnostics.map((item) => ({ ...item })),
      ...(result.selected
        ? { custom: true, selection: config.selection ?? {}, derivation: config.derivation ?? {} }
        : {}),
    }
  },
  preview(config) {
    try {
      if (!config.tokens.platforms.length || !config.tokens.output.trim()) return { css: '', scenarios: SCENARIOS }
      const css = exportTheme(config)
        .artifacts.filter((file) => file.path.endsWith('.css'))
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
    return { files: exportTheme(config).artifacts.map(({ path, content }) => ({ path, content })) }
  },
})
