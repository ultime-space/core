/**
 * defaults.ts — 配置默认值
 * ---------------------------------------------------------------------------
 * 默认 seed 与 `theme.example.json` 同源；示例项目只改品牌时从这里起。
 */

import { DEFAULT_SEED, type SeedInput } from '../seed'
import { DEFAULT_DIR, DEFAULT_PLATFORMS as CORE_DEFAULT_PLATFORMS, type TokenPlatform } from './tokens'
import type { ThemeConfig } from './pipeline'

export const EXAMPLE_SEED: SeedInput = JSON.parse(JSON.stringify(DEFAULT_SEED)) as SeedInput

export const DEFAULT_PLATFORMS: TokenPlatform[] = [...CORE_DEFAULT_PLATFORMS]
export const DEFAULT_OUTPUT = DEFAULT_DIR

export const THEME_DEFAULTS: ThemeConfig = {
  tokens: {
    seed: EXAMPLE_SEED,
    platforms: DEFAULT_PLATFORMS,
    output: DEFAULT_OUTPUT,
  },
}
