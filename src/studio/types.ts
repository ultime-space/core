/**
 * types.ts — 配置形状（core 级）
 * ---------------------------------------------------------------------------
 * 只放「构建输入 + 配置器选择」，不放派生值。
 * `tokens` 可单独作为 CLI 配置；`selection` / `derivation` 归配置器，CLI 不读。
 */

import type { SeedInput } from '../seed'
import type { SemanticsConfig, TokenPlatform } from '../tools'
import type { DerivationConfig } from './derivation'
import type { SelectionConfig } from './selection'

export interface ThemeStudioConfig {
  tokens: {
    /** 内核 seed：只写要改的项 */
    seed: SeedInput
    platforms: TokenPlatform[]
    output: string
    /** 可选：语义表模板 / 覆盖；没有就不产 semantics.json */
    semantics?: SemanticsConfig
  }
  /** 可选：选择要启用的类别 / 档位；省略 = 全量（含 kernel.json） */
  selection?: SelectionConfig
  /** 可选：参数化引擎函数的派生参数；省略 = 静态默认 */
  derivation?: DerivationConfig
}
