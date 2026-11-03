/**
 * types.ts — 配置形状（core 级）
 * ---------------------------------------------------------------------------
 * 只放选择 + seed 覆盖 + 子集，不放派生值。
 */

import type { SeedInput } from '../seed'
import type { SubsetConfig, TokenPlatform } from '../tools'

export interface ThemeStudioConfig {
  tokens: {
    /** 内核 seed：只写要改的项 */
    seed: SeedInput
    /** 项目子集：维度 → 允许出现的档位 */
    subset: SubsetConfig
    platforms: TokenPlatform[]
    output: string
  }
}
