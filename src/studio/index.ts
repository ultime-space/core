/**
 * index.ts — core 级配置器定义（`@ultime/core/studio`）
 * ---------------------------------------------------------------------------
 * 无头：字段 / 默认值 / 预设 / 校验 / 预览 / 导出。
 * 预览与导出共用 `buildCore` + 出口，保证与 CLI 逐字节一致。
 */

import { defineConfigurator, type ConfiguratorDefinition, type Diagnostic, type Preset } from '@ultime/studio'
import { buildCore, buildManifest } from '../build'
import { exportTokens, validateSubset, SUBSET_DIMENSIONS } from '../tools'
import { THEME_DEFAULTS } from './defaults'
import { THEME_FIELDS, THEME_GROUPS } from './fields'
import type { ThemeStudioConfig } from './types'

export type { ThemeStudioConfig } from './types'
export { DEFAULT_OUTPUT, DEFAULT_PLATFORMS, DEFAULT_SUBSET, EXAMPLE_SEED, THEME_DEFAULTS } from './defaults'
export { THEME_FIELDS, THEME_GROUPS } from './fields'

/** 产物清单：与 CLI 共用 `exportTokens`。 */
export function exportThemeArtifacts(config: ThemeStudioConfig) {
  return exportTokens({
    seed: config.tokens.seed,
    subset: config.tokens.subset,
    platforms: config.tokens.platforms,
    output: config.tokens.output,
  })
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

function subsetDiagnostics(config: ThemeStudioConfig): Diagnostic[] {
  return validateSubset(config.tokens.subset).map((message) => ({
    level: 'error' as const,
    code: 'core/subset',
    message,
    path: '/tokens/subset',
  }))
}

export const themeStudio: ConfiguratorDefinition<ThemeStudioConfig> = defineConfigurator({
  id: 'core.theme',
  title: '设计系统 · core',
  version: '2.0.0',
  defaults: THEME_DEFAULTS,
  fields: THEME_FIELDS,
  groups: THEME_GROUPS,
  presets: PRESETS,
  unknownPolicy: 'reject',
  validate(config) {
    const diagnostics: Diagnostic[] = [...subsetDiagnostics(config)]

    try {
      const result = buildCore(config.tokens.seed)
      for (const row of result.contracts.rows.filter((item) => !item.pass).slice(0, 12)) {
        diagnostics.push({
          level: row.blocking ? 'error' : 'warn',
          code: row.blocking ? 'core/contract' : 'core/color',
          message: `${row.id}：${row.label}（实测 ${String(row.actual)}，目标 ${String(row.target)}，${row.level ?? 'deviation'}）`,
          path: '/tokens/seed',
        })
      }
    } catch (error) {
      diagnostics.push({
        level: 'error',
        code: 'core/derive',
        message: error instanceof Error ? error.message : String(error),
        path: '/tokens/seed',
      })
    }

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

    return diagnostics
  },
  inspect(config) {
    const result = buildCore(config.tokens.seed)
    return {
      counts: result.counts,
      contracts: { total: result.contracts.total, failed: result.contracts.failed },
      manifest: buildManifest(result),
    }
  },
  preview(config) {
    const css = exportThemeArtifacts(config)
      .filter((file) => file.path.endsWith('.css'))
      .map((file) => file.content)
      .join('\n')
    return {
      css,
      scenarios: [
        { id: 'light', label: '浅色' },
        { id: 'dark', label: '深色' },
      ],
    }
  },
  export(config) {
    return { files: exportThemeArtifacts(config) }
  },
})

/** 子集维度（表单可能复用）。 */
export { SUBSET_DIMENSIONS }
