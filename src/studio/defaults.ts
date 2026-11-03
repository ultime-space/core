/**
 * defaults.ts — 配置默认值
 * ---------------------------------------------------------------------------
 * 默认 seed 与 `theme.example.json` 同源；示例项目只改品牌时从这里起。
 */

import { DEFAULT_SEED, type SeedInput } from '../seed'
import { SUBSET_DEFAULTS } from '../tools'
import type { TokenPlatform } from '../tools'
import type { ThemeStudioConfig } from './types'

export const EXAMPLE_SEED: SeedInput = JSON.parse(JSON.stringify(DEFAULT_SEED)) as SeedInput

export const DEFAULT_SUBSET = JSON.parse(JSON.stringify(SUBSET_DEFAULTS)) as typeof SUBSET_DEFAULTS

export const DEFAULT_PLATFORMS: TokenPlatform[] = ['css', 'json', 'dtcg']
export const DEFAULT_OUTPUT = 'ultime-tokens'

export const THEME_DEFAULTS: ThemeStudioConfig = {
  tokens: {
    seed: EXAMPLE_SEED,
    subset: DEFAULT_SUBSET,
    platforms: DEFAULT_PLATFORMS,
    output: DEFAULT_OUTPUT,
  },
}
