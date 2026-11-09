/**
 * types.ts — 配置形状（core 级）
 * ---------------------------------------------------------------------------
 * 只放选择 + seed 覆盖，不放派生值。
 */

import type { SeedInput } from '../seed'
import type { SemanticsConfig, TokenPlatform } from '../tools'

export interface ThemeStudioConfig {
  tokens: {
    /** 内核 seed：只写要改的项 */
    seed: SeedInput
    platforms: TokenPlatform[]
    output: string
    /** 可选：语义表模板 / 覆盖；没有就不产 semantics.json */
    semantics?: SemanticsConfig
  }
}
